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
import type { Room, RoomSettings, RoomView } from "./types";

export type RoomSummary = {
  code: string;
  name: string;
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
  listPublicRooms(): Promise<RoomSummary[]>;
  /** Join the fullest open table, or open a new one. */
  quickMatch(): Promise<Room>;
}

export function summarise(room: Room): RoomSummary {
  return {
    code: room.code,
    name: room.name,
    players: room.players.length,
    maxPlayers: room.settings.maxPlayers,
    acts: room.settings.acts,
    phase: room.phase,
  };
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
