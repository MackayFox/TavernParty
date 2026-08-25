/**
 * A YEAR OF EVERY DAILY, not eight dates.
 *
 * The existing suite checks each daily on eight hand-picked dates, which is the
 * right shape and the wrong size. The Deep Run had a generator that produced an
 * unfinishable dungeon about one day in thirty and eight samples never saw it:
 * a one-in-thirty fault has a 76% chance of hiding from eight draws. It was
 * eventually found by playing the game, which is a slow way to find a thing a
 * loop can find in ten seconds.
 *
 * So each daily's load-bearing property gets swept across a year. What counts as
 * load-bearing is specific to the game: a Ledger with two answers marks a correct
 * player wrong, a Muster nobody can beat is a day with no game in it, and a Long
 * Way Down with a par of nothing has no ceiling to aim at.
 */
import { describe, expect, it } from "vitest";
import * as ledger from "@/lib/daily/ledger";
import * as longway from "@/lib/daily/longway";
import * as muster from "@/lib/daily/muster";

/** A year from the first of September, one day at a time. */
const YEAR: string[] = Array.from({ length: 365 }, (_, i) =>
  new Date(Date.UTC(2026, 8, 1) + i * 86400000).toISOString().slice(0, 10)
);

describe("the Ledger, every day for a year", () => {
  it("has exactly one answer", () => {
    // Two answers means somebody reasons correctly to a grid the server calls
    // wrong, which is the worst failure a puzzle can have: it is invisible to
    // everybody except the person it happened to.
    const wrong: string[] = [];
    for (const date of YEAR) {
      if (ledger.solutionCount(date) !== 1) wrong.push(date);
    }
    expect(wrong).toEqual([]);
  }, 60_000);

  it("always sets four statements, and never the same one twice", () => {
    const wrong: string[] = [];
    for (const date of YEAR) {
      const p = ledger.puzzleFor(date);
      if (p.clues.length !== ledger.CLUES) wrong.push(`${date} had ${p.clues.length} clues`);
      if (new Set(p.clues).size !== p.clues.length) wrong.push(`${date} repeated a clue`);
      // The fallback path in the generator pads with "owes exactly" statements,
      // which is a dull puzzle rather than a broken one. Worth knowing if it ever
      // fires, because it means the interesting path failed 500 times.
      const exacts = p.clues.filter((c) => /owes exactly/.test(c)).length;
      if (exacts > 1) wrong.push(`${date} fell back to ${exacts} exact statements`);
    }
    expect(wrong).toEqual([]);
  });

  it("never puts the answer where a player could read it", () => {
    for (const date of YEAR.filter((_, i) => i % 37 === 0)) {
      const payload = JSON.stringify(ledger.puzzleFor(date));
      expect(payload).not.toMatch(/solution|clueSet/);
    }
  });
});

describe("Muster, every quarter of a year", () => {
  /**
   * Muster's par is an exhaustive search over builds, so a full year costs about
   * twenty seconds and the rest of this file costs two. Ninety days is the honest
   * compromise: still an order of magnitude more than eight, still fast enough
   * that nobody skips it. The two properties below are checked on the same window.
   */
  const QUARTER = YEAR.filter((_, i) => i % 4 === 0);

  it("can be beaten, and never swept", () => {
    const wrong: string[] = [];
    for (const date of QUARTER) {
      const puzzle = muster.puzzleFor(date);
      const { par, best } = muster.parFor(puzzle);
      // A night nobody can score on is a night with no game in it.
      if (par <= 0) wrong.push(`${date} par ${par}`);
      if (!best) wrong.push(`${date} had no build that scored par`);
      // And a night you can sweep is a night with no decision in it. Both halves
      // of the shape, in one loop, because they come from the same deal.
      if (par >= muster.TRIALS) wrong.push(`${date} swept all ${muster.TRIALS} trials`);
    }
    expect(wrong).toEqual([]);
    // Ninety exhaustive build searches. It takes about five seconds alone and
    // longer when the suite is running everything else at once, so it gets a
    // stated budget rather than racing vitest's default and flaking on a busy
    // machine.
  }, 60_000);

  it("scores its own par when the par build is played", () => {
    for (const date of QUARTER.filter((_, i) => i % 9 === 0)) {
      const puzzle = muster.puzzleFor(date);
      const { par, best } = muster.parFor(puzzle);
      expect(muster.play(puzzle, best).cleared, date).toBe(par);
    }
  });
});

describe("The Long Way Down, every day for a year", () => {
  it("has a par worth aiming at, from a line that really plays", () => {
    const wrong: string[] = [];
    for (const date of YEAR) {
      const puzzle = longway.puzzleFor(date);
      const { par, line } = longway.parFor(puzzle);
      if (par <= 0) wrong.push(`${date} par ${par}`);
      if (line.length !== puzzle.acts.length) wrong.push(`${date} par line covered ${line.length} of ${puzzle.acts.length} Acts`);
    }
    expect(wrong).toEqual([]);
  }, 60_000);
});
