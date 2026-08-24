/**
 * In-memory store. Offline dev and tests only.
 *
 * IMPORTANT: this is keyed on globalThis, so it is per-process. On a serverless
 * deployment each instance has its own copy, which means two players can land on
 * different instances and see different games. It looks perfect in one tab and
 * breaks the moment there are two, so it is never the production path: `store.ts`
 * only reaches for it when Supabase is not configured at all.
 */
import * as engine from "./engine";
import { generateCode, summarise, type CreateRoomOpts, type GameStore, type RoomSummary } from "./store";
import { GameError, type Room } from "./types";

const g = globalThis as unknown as { __tpMemRooms?: Map<string, Room> };
const rooms: Map<string, Room> = (g.__tpMemRooms ??= new Map());

/** No polls for this long means nobody is at the table and it can go. */
const ABANDONED_AFTER_MS = 30 * 60 * 1000;
const lastTouched = new Map<string, number>();

function load(code: string): Room | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export const memStore: GameStore = {
  async createRoom(opts: CreateRoomOpts): Promise<Room> {
    let code = generateCode();
    while (rooms.has(code)) code = generateCode();
    const room = engine.createRoom({ code, ...opts }, Date.now());
    rooms.set(code, room);
    lastTouched.set(code, Date.now());
    return room;
  },

  async getRoom(code: string): Promise<Room | null> {
    return load(code);
  },

  async snapshot(code, playerId) {
    const room = load(code);
    if (!room) return null;
    const now = Date.now();
    engine.tick(room, now);
    if (playerId) engine.heartbeat(room, playerId, now);
    lastTouched.set(room.code, now);
    return engine.viewFor(room, playerId);
  },

  async mutate(code, fn) {
    const room = load(code);
    if (!room) throw new GameError("not_found", "That table does not exist.");
    const now = Date.now();
    engine.tick(room, now);
    const result = fn(room, now);
    lastTouched.set(room.code, now);
    return result;
  },

  async listPublicRooms(): Promise<RoomSummary[]> {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - (lastTouched.get(code) ?? room.createdAt) > ABANDONED_AFTER_MS) rooms.delete(code);
    }
    return [...rooms.values()]
      .filter((r) => r.visibility === "public" && r.phase === "WAITING")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map(summarise);
  },

  async quickMatch(): Promise<Room> {
    const open = (await this.listPublicRooms())
      .filter((r) => r.players < r.maxPlayers)
      .sort((a, b) => b.players - a.players);
    if (open[0]) {
      const room = load(open[0].code);
      if (room && room.phase === "WAITING") return room;
    }
    return this.createRoom({ name: "The back room", visibility: "public" });
  },
};
