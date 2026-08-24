/**
 * Postgres-backed store (Supabase). Room state is one JSONB row in `tables`,
 * with optimistic concurrency on `version`. Every access runs engine.tick()
 * first, because serverless has no timers, and version bumps are broadcast over
 * Supabase Realtime, where that is switched on, so clients refetch immediately.
 *
 * Reads go through a per-instance copy keyed on the version, because this row
 * being read every 2.5s per player is the entire cost of running the product.
 * The measurements are on `cache` below.
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

/**
 * Realtime is opt-in, because it is an accelerant and it is not free.
 *
 * A broadcast makes clients refetch a little sooner than their next 2.5s poll
 * and carries no state, so the game plays correctly with it off, misconfigured
 * or blocked. What it costs is a metered message per subscriber per version bump
 * and a held connection per player, against a free tier ceiling of 200 of them,
 * which is thirty-three six-player tables. Off unless somebody asks for it, and
 * the same variable gates the client's subscription.
 */
const REALTIME = process.env.NEXT_PUBLIC_REALTIME === "1";

/**
 * The last state this instance read, per table.
 *
 * A poll reads the room state and the room state almost never changes. Measured
 * on a full six-player run: 285 polls per player over twelve minutes, 1,710 for
 * the table, against 15 version bumps. Better than 99% of those reads pulled a
 * JSONB row identical to the one the same instance had read 2.5 seconds earlier,
 * at 7.4 KB a time, and that read is the product's whole Supabase egress bill.
 *
 * So a load asks for the version first, which is one integer, and pulls `state`
 * only when it differs from the copy already in hand.
 *
 * Best effort by construction: it is per instance, a serverless deployment has
 * many, and a cold one simply reads. Nothing hangs off it being right, because
 * `save` is still guarded on the version that was loaded, so a stale copy cannot
 * overwrite anybody: it loses the race and the retry loop re-reads.
 */
const cache = new Map<string, { room: Room; at: number }>();

/** One instance serves many tables. Bounded, oldest read evicted first. */
const CACHE_MAX = 64;

/**
 * A held copy is re-read in full this often whatever the version says.
 *
 * A version is only a safe key while the row it names is the same row, and
 * `cleanupStale` frees codes for `generateCode` to hand out again, with the
 * reissued table counting from the bottom. One in nine hundred million and
 * permanently wrong if it ever lands, against one full read per table per minute
 * to make it impossible.
 */
const CACHE_TTL_MS = 60_000;

function held(code: string): Room | null {
  const hit = cache.get(code);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.room;
}

/** Always a copy, both ways: callers mutate the room `load` hands them. */
function remember(code: string, room: Room): void {
  cache.set(code, { room: structuredClone(room), at: Date.now() });
  for (const oldest of cache.keys()) {
    if (cache.size <= CACHE_MAX) break;
    cache.delete(oldest);
  }
}

/** The row's version, or null when there is no row. */
async function currentVersion(code: string): Promise<number | null> {
  const { data, error } = await adminClient()
    .from("tables")
    .select("version")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new GameError("internal", "Could not reach the tavern. Try again.");
  return (data?.version as number | undefined) ?? null;
}

async function load(code: string): Promise<Room | null> {
  const key = code.toUpperCase();
  const mine = held(key);
  if (mine) {
    const version = await currentVersion(key);
    if (version === mine.version) return structuredClone(mine);
    cache.delete(key);
    // No row at all: the table was reaped. Say so rather than reading again.
    if (version === null) return null;
  }
  const { data, error } = await adminClient()
    .from("tables")
    .select("state")
    .eq("code", key)
    .maybeSingle();
  if (error) throw new GameError("internal", "Could not reach the tavern. Try again.");
  const room = (data?.state as Room) ?? null;
  if (room) remember(key, room);
  return room;
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
  if (!REALTIME) return;
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
      // This instance now knows exactly what the row holds, so the next poll
      // through here is a version check rather than another 7 KB read.
      remember(room.code, room);
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
      if (!error) {
        remember(code, room);
        return room;
      }
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
