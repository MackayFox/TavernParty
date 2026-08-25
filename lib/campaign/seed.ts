/**
 * THE HOUSE'S OWN CONTENT, put where people can find it. Server-only.
 *
 * Two things, and the difference between a builder somebody uses and one they
 * close:
 *
 *   * TWENTY ROOMS ON THE SHELF. A dungeon is about 1,100 words if you write
 *     every floor and a two minute job if you pick six off a shelf. On day one
 *     the only rooms that exist are the ones the house wrote, so they go on the
 *     shelf and the first stranger picks rather than writes. Note that a pool
 *     room may HAND a mark out and may never require one: authors combine them
 *     in any order, so a room whose door wants the lantern is a dead door in most
 *     dungeons.
 *   * ONE DUNGEON, WRITTEN PROPERLY. The Stone Walk, six floors, using Marks the
 *     way they are meant to be used. Nobody discovers a mechanic by reading a
 *     form, and a Hall with nothing in it teaches nothing.
 *
 * It runs the gate on the demo like anybody else's dungeon and refuses to publish
 * one that does not pass. If the house cannot clear its own bar, the answer is to
 * fix the dungeon rather than to wave it through.
 *
 * Called from two places for two reasons. The route is how it gets done against a
 * real database, once, by hand. Boot is how it gets done on a server with no
 * database, where the store dies with the process and every restart would
 * otherwise leave the shelf bare.
 */
import { reportFor, mechanicalHash } from "@/lib/campaign/gate";
import { designOf } from "@/lib/campaign/puzzle";
import { addPoolRoom, getStoredDungeon, listPool, saveDungeon } from "@/lib/campaign/store";
import { HOUSE_DEFS } from "@/lib/daily/deeprun";
import {
  DEMO_BASE_VIGOUR,
  DEMO_CALLINGS,
  DEMO_CODE,
  DEMO_INTRO,
  DEMO_KIT,
  DEMO_ROOMS,
  DEMO_TITLE,
} from "@/lib/content/demo-dungeon";
import type { DungeonRow } from "./types";
import type { Note } from "@/lib/campaign/gate";

export type DemoResult = {
  code: string;
  published?: boolean;
  already?: boolean;
  stale?: boolean;
  plays?: number;
  par?: number | null;
  difficulty?: string | null;
  out?: number;
  builds?: number;
  notes?: Note[];
  note?: string;
};

export async function seedHouseContent(): Promise<{
  rooms: number;
  added: number;
  demo: DemoResult;
}> {
  const before = await listPool();
  const have = new Set(before.map((r) => r.id));
  let added = 0;
  for (const room of HOUSE_DEFS) {
    const id = `p-house-${room.id}`;
    if (have.has(id)) continue;
    await addPoolRoom({
      id,
      authorId: null,
      authorName: "The house",
      room: { ...room, id },
      shared: true,
    });
    added++;
  }
  const after = await listPool();
  return { rooms: after.length, added, demo: await seedDemo() };
}

async function seedDemo(): Promise<DemoResult> {
  /*
   * The STORED row, not the one `getDungeon` will invent.
   *
   * `getDungeon` falls back to the bundle so that /d/LNGWLK cannot 404, which
   * means it always answers for this code. Asking it here made seeding a no-op
   * forever: it saw a published row, said "already", and never wrote the one the
   * Hall reads.
   */
  const existing = await getStoredDungeon(DEMO_CODE);
  if (existing?.publishedAt) {
    /**
     * Already up. Republish only if the bundle has changed AND nobody has played
     * it, which is the same rule an author gets from the PUT handler and for the
     * same reason: a published dungeon's par went out with its link, so changing
     * the rooms underneath somebody's score makes the score mean nothing.
     *
     * Once one person has run it, a change in the bundle is reported rather than
     * applied. The fix then is a new code, not a quiet edit.
     */
    const same =
      mechanicalHash(designOf({ ...existing, rooms: DEMO_ROOMS })) ===
      mechanicalHash(designOf(existing));
    if (same) {
      return { code: DEMO_CODE, already: true, par: existing.par, difficulty: existing.difficulty };
    }
    if (existing.plays > 0) {
      return {
        code: DEMO_CODE,
        already: true,
        stale: true,
        plays: existing.plays,
        note: "The bundle's version differs from the published one, and people have already run it. Publish a new code rather than changing this one underneath their scores.",
      };
    }
  }

  const now = new Date().toISOString();
  const row: DungeonRow = {
    code: DEMO_CODE,
    // The house owns it, and no person does. Nobody can edit it from the desk,
    // which is right: it is content in the bundle, and the bundle is where it
    // gets edited.
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
    chosenAt: existing?.chosenAt ?? now,
    par: null,
    difficulty: null,
    report: null,
    publishedAt: now,
    plays: existing?.plays ?? 0,
    finishes: existing?.finishes ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const report = reportFor(designOf(row));
  if (!report.ok) {
    // Loudly, and without publishing. A demo dungeon nobody can finish is worse
    // than an empty Hall.
    return { code: DEMO_CODE, published: false, notes: report.notes };
  }

  await saveDungeon({ ...row, par: report.par, difficulty: report.difficulty, report });
  return {
    code: DEMO_CODE,
    published: true,
    par: report.par,
    difficulty: report.difficulty,
    out: report.out,
    builds: report.builds,
    notes: report.notes,
  };
}
