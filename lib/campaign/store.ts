/**
 * Where dungeons live. Server-only.
 *
 * The same two-backend shape the game store uses: Postgres when Supabase is
 * configured, an in-memory map when it is not. That is not a dev convenience
 * here, it is the reason the whole feature can be built and played tonight
 * against a plan that does not exist until Friday.
 *
 * ponytail: the memory backend is per-process, so on a serverless deployment two
 * requests can land on different instances and disagree. Exactly the same
 * ceiling as `lib/game/memstore.ts`, for exactly the same reason, and it is
 * never the production path: `supabaseConfigured()` decides.
 */
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";
import type { RoomDef } from "@/lib/daily/deeprun-data";
import {
  emptyDraft,
  generateDungeonCode,
  type DungeonRow,
  type PoolRoom,
  type Visibility,
} from "./types";

const g = globalThis as unknown as {
  __tpDungeons?: Map<string, DungeonRow>;
  __tpPool?: Map<string, PoolRoom>;
};
const memDungeons: Map<string, DungeonRow> = (g.__tpDungeons ??= new Map());
const memPool: Map<string, PoolRoom> = (g.__tpPool ??= new Map());

/** Postgres columns to the shape the app uses. One place, so it cannot drift. */
type DbRow = Record<string, unknown>;
function fromDb(r: DbRow): DungeonRow {
  return {
    code: r.code as string,
    ownerKey: r.owner_key as string,
    authorId: (r.author_id as string | null) ?? null,
    authorName: r.author_name as string,
    title: r.title as string,
    intro: r.intro as string,
    rooms: (r.rooms as RoomDef[]) ?? [],
    callingIds: (r.calling_ids as string[]) ?? [],
    kitIds: (r.kit_ids as string[]) ?? [],
    baseVigour: r.base_vigour as number,
    visibility: r.visibility as Visibility,
    par: (r.par as number | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
    report: r.report ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    plays: (r.plays as number) ?? 0,
    finishes: (r.finishes as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toDb(d: DungeonRow): DbRow {
  return {
    code: d.code,
    owner_key: d.ownerKey,
    author_id: d.authorId,
    author_name: d.authorName,
    title: d.title,
    intro: d.intro,
    rooms: d.rooms,
    calling_ids: d.callingIds,
    kit_ids: d.kitIds,
    base_vigour: d.baseVigour,
    visibility: d.visibility,
    par: d.par,
    difficulty: d.difficulty,
    report: d.report,
    published_at: d.publishedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function createDungeon(
  authorName: string,
  authorId: string | null,
  ownerKey: string
): Promise<DungeonRow> {
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateDungeonCode();
    const row: DungeonRow = {
      ...emptyDraft(code, authorName, ownerKey),
      authorId,
      createdAt: now,
      updatedAt: now,
    };
    if (!supabaseConfigured()) {
      if (memDungeons.has(code)) continue;
      memDungeons.set(code, row);
      return row;
    }
    const { error } = await adminClient().from("dungeons").insert(toDb(row));
    if (!error) return row;
    // 23505 is a duplicate code. Roll another one.
    if (error.code !== "23505") {
      console.error("[campaign] createDungeon failed", error);
      throw new Error("Could not open a new one. Try again.");
    }
  }
  throw new Error("Could not open a new one. Try again.");
}

export async function getDungeon(code: string): Promise<DungeonRow | null> {
  const key = code.toUpperCase();
  if (!supabaseConfigured()) return memDungeons.get(key) ?? null;
  const { data, error } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("code", key)
    .maybeSingle();
  if (error) {
    console.error("[campaign] getDungeon failed", error);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function saveDungeon(row: DungeonRow): Promise<void> {
  const next = { ...row, updatedAt: new Date().toISOString() };
  if (!supabaseConfigured()) {
    memDungeons.set(row.code, next);
    return;
  }
  const { error } = await adminClient().from("dungeons").update(toDb(next)).eq("code", row.code);
  if (error) {
    console.error("[campaign] saveDungeon failed", error);
    throw new Error("Could not save that. Try again.");
  }
}

/** An author's own desk, newest first. */
export async function listByOwner(ownerKey: string): Promise<DungeonRow[]> {
  if (!supabaseConfigured()) {
    return [...memDungeons.values()]
      .filter((d) => d.ownerKey === ownerKey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const { data } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("owner_key", ownerKey)
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(fromDb);
}

/** One question, one place: is this person allowed to change this dungeon? */
export function ownedBy(row: DungeonRow, identityId: string | null | undefined): boolean {
  return !!identityId && row.ownerKey === identityId;
}

/** The Hall. Only ever listed rows, and only ever ones a person put there. */
export async function listPublished(limit = 40): Promise<DungeonRow[]> {
  if (!supabaseConfigured()) {
    return [...memDungeons.values()]
      .filter((d) => d.visibility === "listed")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, limit);
  }
  const { data } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("visibility", "listed")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(fromDb);
}

/**
 * Count a play, and a finish.
 *
 * Through a function in the database rather than a read-modify-write, so two
 * instances finishing at the same moment cannot lose one of the counts. Best
 * effort: a dropped counter must never stop somebody seeing their own result.
 */
export async function countPlay(code: string, finished: boolean): Promise<void> {
  if (!supabaseConfigured()) {
    const row = memDungeons.get(code.toUpperCase());
    if (row) {
      row.plays++;
      if (finished) row.finishes++;
    }
    return;
  }
  try {
    await adminClient().rpc("dungeon_played", { p_code: code.toUpperCase(), p_finished: finished });
  } catch (err) {
    console.warn("[campaign] countPlay failed", err);
  }
}

// ---------------------------------------------------------------------------
// The pool
// ---------------------------------------------------------------------------

export async function listPool(limit = 200): Promise<PoolRoom[]> {
  if (!supabaseConfigured()) {
    return [...memPool.values()].filter((r) => r.shared).slice(0, limit);
  }
  const { data } = await adminClient()
    .from("pool_rooms")
    .select("*")
    .eq("shared", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: DbRow) => ({
    id: r.id as string,
    authorId: (r.author_id as string | null) ?? null,
    authorName: r.author_name as string,
    room: r.room as RoomDef,
    shared: r.shared as boolean,
    pickups: (r.pickups as number) ?? 0,
    createdAt: r.created_at as string,
  }));
}

export async function addPoolRoom(entry: Omit<PoolRoom, "createdAt" | "pickups">): Promise<void> {
  const row: PoolRoom = { ...entry, pickups: 0, createdAt: new Date().toISOString() };
  if (!supabaseConfigured()) {
    memPool.set(row.id, row);
    return;
  }
  const { error } = await adminClient().from("pool_rooms").insert({
    id: row.id,
    author_id: row.authorId,
    author_name: row.authorName,
    room: row.room,
    shared: row.shared,
  });
  if (error && error.code !== "23505") {
    console.error("[campaign] addPoolRoom failed", error);
  }
}

/** Which pool rooms a published dungeon picked up. Their authors' quiet reward. */
export async function countPickups(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!supabaseConfigured()) {
    for (const id of ids) {
      const r = memPool.get(id);
      if (r) r.pickups++;
    }
    return;
  }
  try {
    await adminClient().rpc("pool_room_picked", { p_ids: ids });
  } catch (err) {
    console.warn("[campaign] countPickups failed", err);
  }
}
