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
import { reportFor } from "./gate";
import { designOf } from "./puzzle";
import {
  DEMO_BASE_VIGOUR,
  DEMO_CALLINGS,
  DEMO_CODE,
  DEMO_INTRO,
  DEMO_KIT,
  DEMO_ROOMS,
  DEMO_TITLE,
} from "@/lib/content/demo-dungeon";

const g = globalThis as unknown as {
  __tpDungeons?: Map<string, DungeonRow>;
  __tpPool?: Map<string, PoolRoom>;
};
const memDungeons: Map<string, DungeonRow> = (g.__tpDungeons ??= new Map());
const memPool: Map<string, PoolRoom> = (g.__tpPool ??= new Map());

/** A source that cannot repeat itself, for when the ambient one is misbehaving. */
function mixedRng(salt: number, stamp: number): () => number {
  let state = (salt * 2654435761 + stamp) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

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
    chosenAt: (r.chosen_at as string | null) ?? null,
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
    chosen_at: d.chosenAt,
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
  /**
   * A NEW DRAFT ARRIVES WITH THREE FLOORS ON IT, off the shared shelf.
   *
   * It used to open empty, which contradicted the page that sent you there: /write
   * promises "six of those is a real dungeon" and a two minute job, and then handed
   * over a blank card. The gate's first verdict was therefore a block, the sidebar
   * opened on "Not yet" in red, and the only instruction was to start from nothing.
   *
   * Three is the minimum a dungeon may have, so the desk opens on a REAL par and a
   * real difficulty word, and the job in front of the author is "make this yours"
   * rather than "begin". The desk's own comment says why that matters: nobody
   * abandons an edit, and plenty of people abandon a blank card.
   */
  const shelf = await listPool();
  const opening = shelf
    .filter((entry) => entry.shared)
    .slice(0, 3)
    .map((entry, i) => ({ ...entry.room, id: `r${i + 1}-${entry.id}` }));
  for (let attempt = 0; attempt < 8; attempt++) {
    /**
     * After a few unlucky rolls, stop trusting the roll.
     *
     * `generateDungeonCode` draws from Math.random, and a random source that
     * keeps returning the same value turns a retry loop into the same collision
     * eight times and then an error in somebody's face. Mixing the attempt in
     * guarantees a different code by the second try whatever the source is
     * doing, which is cheap insurance for something a person is waiting on.
     */
    const code =
      attempt < 2
        ? generateDungeonCode()
        : generateDungeonCode(mixedRng(attempt, Date.now()));
    const row: DungeonRow = {
      ...emptyDraft(code, authorName, ownerKey),
      // Ids are rewritten per draft so two authors editing the same shelf room
      // never collide, and so the gate's duplicate-id check has nothing to catch.
      rooms: opening,
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

/**
 * What is ACTUALLY STORED, with no fallback to the bundle.
 *
 * Exists because the fallback broke seeding in a way nothing noticed: `seedDemo`
 * asked `getDungeon(DEMO_CODE)`, got the bundled row back with `publishedAt`
 * already set, concluded the dungeon was up, and returned without ever writing
 * it. So the row `listByVisibility` reads never existed and the Hall was
 * permanently empty, on the surface the front page sells twice as the thing that
 * makes this site different.
 *
 * The lesson is narrow and worth stating: a read that invents a row must not be
 * the read a writer uses to decide whether to write.
 */
export async function getStoredDungeon(code: string): Promise<DungeonRow | null> {
  const key = code.toUpperCase();
  if (!supabaseConfigured()) return memDungeons.get(key) ?? null;
  const { data, error } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("code", key)
    .maybeSingle();
  if (error) {
    console.error("[campaign] getStoredDungeon failed", error);
    return null;
  }
  return data ? fromDb(data) : null;
}

export async function getDungeon(code: string): Promise<DungeonRow | null> {
  const key = code.toUpperCase();
  if (!supabaseConfigured()) return memDungeons.get(key) ?? houseDungeon(key);
  const { data, error } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("code", key)
    .maybeSingle();
  if (error) {
    console.error("[campaign] getDungeon failed", error);
    return houseDungeon(key);
  }
  return data ? fromDb(data) : houseDungeon(key);
}

/**
 * THE HOUSE'S OWN DUNGEON IS CONTENT, NOT DATA.
 *
 * The Stone Walk ships in the bundle. It had no business needing a database row
 * to be playable, and the day it did, a link to it went on the front page and the
 * header of a deployment whose database was not reachable yet, and both of them
 * answered 404. That is the bug this closes, and closing it here rather than at
 * each of the three routes that read a dungeon means none of them can forget.
 *
 * It is NOT a general fallback and must not become one. Somebody else's dungeon
 * is data: if the database is down, their dungeon is genuinely unavailable and
 * saying so is correct. Only the code that ships in this bundle is served from
 * this bundle.
 *
 * The par is computed once per process and kept, because the dice are pinned to
 * the code so the answer cannot change, and because a cold instance should not
 * pay a solve to show somebody a card.
 */
let houseCache: DungeonRow | null = null;

function houseDungeon(code: string): DungeonRow | null {
  if (code !== DEMO_CODE) return null;
  if (houseCache) return houseCache;
  const now = new Date().toISOString();
  const row: DungeonRow = {
    code: DEMO_CODE,
    ownerKey: "house",
    authorId: null,
    authorName: "The house",
    title: DEMO_TITLE,
    intro: DEMO_INTRO,
    rooms: DEMO_ROOMS,
    callingIds: DEMO_CALLINGS,
    kitIds: DEMO_KIT,
    baseVigour: DEMO_BASE_VIGOUR,
    visibility: "listed",
    chosenAt: now,
    par: null,
    difficulty: null,
    report: null,
    publishedAt: now,
    // Counters belong to the database. Served from the bundle they read zero,
    // which is honest: this copy has no idea how many people have played it.
    plays: 0,
    finishes: 0,
    createdAt: now,
    updatedAt: now,
  };
  const report = reportFor(designOf(row));
  houseCache = report.ok
    ? { ...row, par: report.par, difficulty: report.difficulty, report }
    : row;
  return houseCache;
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
  return listByVisibility("listed", limit);
}

/**
 * The one that was chosen most recently, or nothing.
 *
 * Read by a PAGE, never by `lib/daily/`. The daily itself stays a pure function
 * of the date, and this is a link that sits next to it.
 */
export async function chosenDungeon(): Promise<DungeonRow | null> {
  if (!supabaseConfigured()) {
    return (
      [...memDungeons.values()]
        .filter((d) => d.chosenAt && d.visibility === "listed")
        .sort((a, b) => (b.chosenAt ?? "").localeCompare(a.chosenAt ?? ""))[0] ?? null
    );
  }
  const { data } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("visibility", "listed")
    .not("chosen_at", "is", null)
    .order("chosen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? fromDb(data) : null;
}

/** The queue a human works through. Submitted, oldest first: nobody waits twice. */
export async function listSubmitted(limit = 50): Promise<DungeonRow[]> {
  if (!supabaseConfigured()) {
    return [...memDungeons.values()]
      .filter((d) => d.visibility === "submitted")
      .sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""))
      .slice(0, limit);
  }
  const { data } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("visibility", "submitted")
    .order("published_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map(fromDb);
}

async function listByVisibility(v: Visibility, limit: number): Promise<DungeonRow[]> {
  if (!supabaseConfigured()) {
    return [...memDungeons.values()]
      .filter((d) => d.visibility === v)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, limit);
  }
  const { data } = await adminClient()
    .from("dungeons")
    .select("*")
    .eq("visibility", v)
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
