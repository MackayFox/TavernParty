/**
 * Postgres-backed store (Supabase). Room state is one JSONB row in `tables`,
 * with optimistic concurrency on `version`. Every access runs engine.tick()
 * first, because serverless has no timers, and version bumps are broadcast over
 * Supabase Realtime so clients refetch immediately.
 */
import { adminClient } from "../supabase/admin";
import * as engine from "./engine";
import { persistRun } from "./persist";
import {
  generateCode,
  summarise,
  type CreateRoomOpts,
  type GameStore,
  type RoomSummary,
} from "./store";
import { GameError, type Room } from "./types";

/**
 * Active players poll every ~2.5s. A table untouched for this long has nobody at
 * it, in any phase, and can go. Thirty minutes rather than five: the earlier
 * sites in this network reaped a live game because `updated_at` only moves on a
 * version bump and a quiet phase does not bump it.
 */
const ABANDONED_AFTER_MS = 30 * 60 * 1000;

/**
 * Phase deadlines make every client poll at once, so optimistic-concurrency
 * conflicts burst exactly at phase boundaries. Enough retries with jitter to
 * outlast a full table stampeding.
 */
const MAX_RETRIES = 6;

async function load(code: string): Promise<Room | null> {
  const { data, error } = await adminClient()
    .from("tables")
    .select("state")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new GameError("internal", "Could not reach the tavern. Try again.");
  return (data?.state as Room) ?? null;
}

/** Persist only if nobody else wrote first. False means retry. */
async function save(room: Room, expectedVersion: number): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("tables")
    .update({
      state: room,
      version: room.version,
      visibility: room.visibility,
      phase: room.phase,
      players: room.players.length,
      max_players: room.settings.maxPlayers,
      name: room.name,
      acts: room.settings.acts,
      updated_at: new Date().toISOString(),
    })
    .eq("code", room.code)
    .eq("version", expectedVersion)
    .select("code");
  if (error) throw new GameError("internal", "Could not save the table. Try again.");
  return (data?.length ?? 0) > 0;
}

async function broadcast(code: string, version: number): Promise<void> {
  try {
    await adminClient()
      .channel(`tp:table:${code}`)
      .send({ type: "broadcast", event: "update", payload: { version } });
  } catch (err) {
    // Realtime is an accelerant. Polling still advances everything.
    console.warn(`[dbstore] broadcast failed for ${code}`, err);
  }
}

/**
 * Load, tick, work, save, broadcast, with an optimistic-concurrency retry so
 * `work` always runs against fresh state.
 */
async function withRoom<T>(code: string, work: (room: Room, now: number) => T): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const room = await load(code);
    if (!room) throw new GameError("not_found", "That table does not exist.");
    const v0 = room.version;
    const phase0 = room.phase;
    const now = Date.now();
    engine.tick(room, now);
    const result = work(room, now);
    if (room.version === v0) return result; // nothing changed, no write
    const justFinished = phase0 !== "FINAL" && room.phase === "FINAL";
    if (await save(room, v0)) {
      /**
       * The record is written AFTER the save wins, not before it.
       *
       * It used to run first, on the theory that the snapshot a client reads
       * should already be persisted. But `save` is version-guarded and can lose,
       * and the retry loop re-runs `work` and comes back here, so a contended
       * final tick wrote the same run to `runs` and `run_players` once per
       * attempt. Six retries, six copies of one night in the permanent record and
       * six times its contribution to everybody's stats. Losing the race means
       * another instance is committing this same transition, so it will persist it.
       */
      if (justFinished) await persistRun(room);
      void broadcast(room.code, room.version);
      return result;
    }
    // Somebody else won. Retry against fresh state, desynced from the herd.
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 75 * (attempt + 1)));
  }
  throw new GameError("conflict", "The table moved on. Try that again.");
}

export const dbStore: GameStore = {
  async createRoom(opts: CreateRoomOpts): Promise<Room> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const room = engine.createRoom({ code, ...opts }, Date.now());
      const { error } = await adminClient().from("tables").insert({
        code,
        state: room,
        version: room.version,
        visibility: room.visibility,
        phase: room.phase,
        players: 0,
        max_players: room.settings.maxPlayers,
        name: room.name,
        acts: room.settings.acts,
      });
      if (!error) return room;
      if (error.code !== "23505") {
        console.error("[dbstore] createRoom failed", error);
        throw new GameError("internal", "Could not open a table. Try again.");
      }
      // 23505 is a duplicate code. Roll another one.
    }
    throw new GameError("internal", "Could not open a table. Try again.");
  },

  async getRoom(code: string): Promise<Room | null> {
    return load(code);
  },

  async snapshot(code, playerId) {
    // Opportunistic reaping, so abandoned tables die even if nobody browses.
    if (Math.random() < 0.02) void cleanupStale();
    try {
      return await withRoom(code, (room, now) => {
        if (playerId) engine.heartbeat(room, playerId, now);
        return engine.viewFor(room, playerId);
      });
    } catch (err) {
      if (err instanceof GameError && err.code === "not_found") return null;
      throw err;
    }
  },

  async mutate(code, fn) {
    return withRoom(code, fn);
  },

  async listPublicRooms(): Promise<RoomSummary[]> {
    // Sampled, not every call. `cleanupStale` is an unbounded DELETE and this
    // method is reachable from an unauthenticated page load, so firing it on
    // every request handed any visitor a free write-amplification lever: hammer
    // the lobby list and every one of those requests runs a table scan and a
    // delete. One in twenty-five is plenty to keep the table tidy, and `snapshot`
    // already samples for the same reason.
    if (Math.random() < 0.04) void cleanupStale();
    const { data, error } = await adminClient()
      .from("tables")
      .select("code, name, players, max_players, acts, phase")
      .eq("visibility", "public")
      .eq("phase", "WAITING")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[dbstore] listPublicRooms failed", error);
      throw new GameError("internal", "Could not list the tables. Try again.");
    }
    return (data ?? []).map((r) => ({
      code: r.code,
      name: r.name,
      players: r.players,
      maxPlayers: r.max_players,
      acts: r.acts,
      phase: r.phase,
    }));
  },

  async quickMatch(): Promise<Room> {
    const open = (await this.listPublicRooms())
      .filter((r) => r.players < r.maxPlayers)
      .sort((a, b) => b.players - a.players);
    if (open[0]) {
      const room = await load(open[0].code);
      if (room && room.phase === "WAITING") return room;
    }
    return this.createRoom({ name: "The back room", visibility: "public" });
  },
};

async function cleanupStale(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString();
    await adminClient().from("tables").delete().lt("updated_at", cutoff);
  } catch (err) {
    console.warn("[dbstore] cleanup failed", err);
  }
}

export { summarise };
