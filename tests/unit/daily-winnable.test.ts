/**
 * EVERY DAY OF THE DEEP RUN CAN BE FINISHED.
 *
 * The bug this guards was live and it was bad: about one day a month dealt six
 * poor dice, every door in the dungeon was shut, everybody paid the brace on all
 * six floors, and nineteen Vigour of tolls against a starting nine meant nobody
 * on earth could finish that day's daily. Nine days in two hundred and forty.
 *
 * It was found by playing the game rather than by reading it, which is the whole
 * argument for this file: no unit test asked "is tonight possible", so nothing
 * noticed.
 */
import { describe, expect, it } from "vitest";
import { anybodyGetsOut, puzzleFor } from "@/lib/daily/deeprun";
import { reportFor } from "@/lib/campaign/gate";
import { DEEP_BOSSES, DEEP_ROOMS, type RoomDef } from "@/lib/daily/deeprun-data";

const ALL: RoomDef[] = [...DEEP_ROOMS, ...DEEP_BOSSES];
const dateAt = (i: number) =>
  new Date(Date.UTC(2026, 8, 1) + i * 86400000).toISOString().slice(0, 10);

describe("a year of dailies", () => {
  it("can always be finished by somebody", () => {
    // Cheap and exact: no search, one pass per sample character. This is the same
    // check the assembly itself uses, so what it really asserts is that the
    // re-draw never runs out of patience.
    const bad: string[] = [];
    for (let i = 0; i < 365; i++) {
      const date = dateAt(i);
      if (!anybodyGetsOut(puzzleFor(date))) bad.push(date);
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it("agrees with the solver on a sample", () => {
    // The cheap check ignores knacks and takes one placement, so it is a lower
    // bound. The gate enumerates every character and plays each one properly. If
    // the cheap check says yes, the real answer has to be yes too.
    for (let i = 0; i < 365; i += 29) {
      const date = dateAt(i);
      const p = puzzleFor(date);
      const rep = reportFor({
        seed: p.seed,
        label: date,
        rooms: p.rooms.map((r) => ALL.find((d) => d.id === r.id)!),
        callingIds: p.callings.map((c) => c.id),
        kitIds: p.kit.map((k) => k.id),
        baseVigour: p.baseVigour,
      });
      expect(rep.out, `${date} had nobody get out`).toBeGreaterThan(0);
    }
    // Thirteen full enumerations. Two seconds alone and more when the suite is
    // running everything at once, so it states a budget rather than racing the
    // default and failing on a busy machine for no reason.
  }, 60_000);

  it("still gives everybody in the world the same dungeon", () => {
    // The re-draw must be a pure function of the date, or two people playing the
    // same day are playing different dungeons and the board means nothing.
    for (let i = 0; i < 40; i++) {
      const date = dateAt(i);
      const a = puzzleFor(date);
      const b = puzzleFor(date);
      expect(a.seed).toBe(b.seed);
      expect(a.rooms.map((r) => r.id)).toEqual(b.rooms.map((r) => r.id));
    }
  });

  it("keeps the date as the label, whatever the dice needed", () => {
    // The share text and the archive read the label. A re-drawn day must not post
    // "2026-11-08#3" into somebody's group chat.
    for (let i = 0; i < 120; i++) {
      const date = dateAt(i);
      expect(puzzleFor(date).label).toBe(date);
    }
  });
});
