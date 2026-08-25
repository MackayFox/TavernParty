/**
 * Store facade. Supabase configured -> Postgres (production, multi-instance
 * safe). Not configured -> in-memory (offline dev and tests).
 *
 * Both are poll-driven: there are no server timers. Every snapshot and every
 * mutate runs engine.tick() first, so clients polling every ~2.5s are what
 * advances the deadlines. Where NEXT_PUBLIC_REALTIME is on, the Postgres store
 * also broadcasts version bumps over Supabase Realtime so clients refetch
 * immediately rather than waiting for their next poll.
 */
import { supabaseConfigured } from "../supabase/admin";
import { occupiedSeats } from "./engine";
import type { Room, RoomSettings, RoomView } from "./types";

export type RoomSummary = {
  code: string;
  name: string;
  /**
   * Chairs somebody is in, NOT seats ever taken. See `engine.occupiedSeats`: a
   * closed tab holds a WAITING seat forever, so counting seats had the lobby
   * advertising twenty tables with nobody at any of them.
   */
  players: number;
  maxPlayers: number;
  acts: number;
  phase: string;
};

export type CreateRoomOpts = {
  name: string;
  visibility: "public" | "private";
  settings?: Partial<RoomSettings>;
};

export interface GameStore {
  createRoom(opts: CreateRoomOpts): Promise<Room>;
  getRoom(code: string): Promise<Room | null>;
  /** tick + viewer heartbeat + redacted view. The polling endpoint. */
  snapshot(code: string, playerId: string | null): Promise<RoomView | null>;
  /** tick, run the action, persist and broadcast on change. */
  mutate<T>(code: string, fn: (room: Room, now: number) => T): Promise<T>;
  /** Public tables somebody is actually sitting at, fresh first. */
  listPublicRooms(): Promise<RoomSummary[]>;
  /** Join the fullest live table, or open a new one. */
  quickMatch(): Promise<Room>;
}

export function summarise(room: Room): RoomSummary {
  return {
    code: room.code,
    name: room.name,
    players: occupiedSeats(room),
    maxPlayers: room.settings.maxPlayers,
    acts: room.settings.acts,
    phase: room.phase,
  };
}

/**
 * How many of the listed tables Quick Match will check properly before opening a
 * new one. Each check is one cached, version-guarded read.
 */
const QUICK_MATCH_TRIES = 3;

/**
 * Fullest live table first, and CHECKED before it is handed out.
 *
 * Shared by both stores, because which table a stranger is sent to is a matter of
 * policy and not of where the row is kept. It used to be six lines copied into
 * each of them, and both copies had the same two bugs: they trusted a
 * denormalised count that includes chairs nobody is in, and they sorted by it
 * DESCENDING, so the fullest abandoned table in the list was exactly the one the
 * next arrival was walked into, and the door then refused them because the seats
 * were full of people who had gone home.
 *
 * Fullest-first stays, because the point of a lobby is to fill one table rather
 * than scatter six players across six tables. What changed is that the count is
 * live humans and bots, and the summary is only a shortlist now: each candidate is
 * loaded and re-read against its real state before anybody is sent to it, because
 * a summary can be a few seconds stale and a door cannot.
 */
export async function pickTable(
  store: Pick<GameStore, "listPublicRooms" | "getRoom" | "createRoom">
): Promise<Room> {
  const shortlist = (await store.listPublicRooms())
    .filter((r) => r.players < r.maxPlayers)
    .sort((a, b) => b.players - a.players)
    .slice(0, QUICK_MATCH_TRIES);

  for (const summary of shortlist) {
    const room = await store.getRoom(summary.code);
    // `engine.join` frees a chair nobody is in, so a table under its own ceiling
    // on live occupants will seat the caller even when every seat is spoken for.
    if (room && room.phase === "WAITING" && occupiedSeats(room) < room.settings.maxPlayers)
      return room;
  }
  return store.createRoom({ name: "The back room", visibility: "public" });
}

/**
 * Resolved once per process, not once per call.
 *
 * Every exported function below goes through here, so this runs on every store
 * operation the product performs, and the answer cannot change under it: which
 * store this is, is decided by environment variables that are fixed at boot.
 */
let resolved: Promise<GameStore> | null = null;

function active(): Promise<GameStore> {
  return (resolved ??= supabaseConfigured()
    ? import("./dbstore").then((m) => m.dbStore)
    : import("./memstore").then((m) => m.memStore));
}

export const createRoom: GameStore["createRoom"] = async (o) => (await active()).createRoom(o);
export const getRoom: GameStore["getRoom"] = async (c) => (await active()).getRoom(c);
export const snapshot: GameStore["snapshot"] = async (c, p) => (await active()).snapshot(c, p);
export const mutate: GameStore["mutate"] = async (c, f) => (await active()).mutate(c, f);
export const listPublicRooms: GameStore["listPublicRooms"] = async () =>
  (await active()).listPublicRooms();
export const quickMatch: GameStore["quickMatch"] = async () => (await active()).quickMatch();

/** No 0/O/1/I/L: a six-character code has to survive being read aloud in a pub. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
}
