import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { HOUSE_DEFS } from "@/lib/daily/deeprun";
import { addPoolRoom, getDungeon, listPool, saveDungeon } from "@/lib/campaign/store";
import { mechanicalHash, reportFor } from "@/lib/campaign/gate";
import { designOf } from "@/lib/campaign/puzzle";
import {
  DEMO_BASE_VIGOUR,
  DEMO_CALLINGS,
  DEMO_CODE,
  DEMO_INTRO,
  DEMO_KIT,
  DEMO_ROOMS,
  DEMO_TITLE,
} from "@/lib/content/demo-dungeon";
import type { DungeonRow } from "@/lib/campaign/types";

/**
 * Put the house's own rooms on the shelf, and the house's own dungeon in the Hall.
 *
 * The cold-start answer, and the difference between a builder somebody uses and
 * one they close. Two halves:
 *
 *   * TWENTY ROOMS ON THE SHELF. A dungeon is about 1,100 words if you write
 *     every floor and a two minute job if you pick six off a shelf. On day one
 *     the only rooms that exist are the ones the house wrote, so they go on the
 *     shelf and the first stranger picks rather than writes. Note that pool rooms
 *     may HAND a mark out and may never require one: an author combines them in
 *     any order, so a room whose door wants the lantern would be a dead door in
 *     most dungeons.
 *   * ONE DUNGEON, WRITTEN PROPERLY. The Stone Walk, six floors, using Marks the
 *     way they are meant to be used. Nobody discovers a mechanic by reading a
 *     form, and a Hall with nothing in it teaches nothing.
 *
 * Idempotent, and deliberately not authenticated: everything it adds is fixed
 * content that already ships in the bundle, so there is nothing here an attacker
 * could want and nothing they could substitute. A second run is a no-op.
 *
 * It runs the gate on the demo like anybody else's dungeon and refuses to publish
 * one that does not pass. If the house cannot clear its own bar the answer is to
 * fix the dungeon, not to wave it through.
 */
export async function POST() {
  try {
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

    const demo = await seedDemo();
    return NextResponse.json({ added, total: after.length, demo });
  } catch (err) {
    return handleError(err);
  }
}

async function seedDemo() {
  const existing = await getDungeon(DEMO_CODE);
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
    const same = mechanicalHash(designOf({ ...existing, rooms: DEMO_ROOMS })) ===
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
    return { code: DEMO_CODE, published: false, report };
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
