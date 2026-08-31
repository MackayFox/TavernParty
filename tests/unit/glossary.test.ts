import { describe, expect, it } from "vitest";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";
import { puzzleFor, run } from "@/lib/daily/deeprun";

/**
 * TWO HOUSE RULES, HELD TO BY A TEST RATHER THAN BY GOODWILL.
 *
 * Both are written down in CLAUDE.md, both were honoured in some places and not
 * others, and both failures were found by watching somebody play rather than by
 * anything in this suite:
 *
 *   "Gloss the vocabulary at first use." Somebody opening The Long Way Down met
 *   Renown, Dread, Hook tokens, Reckless, reach and Failing before their first
 *   click, none of them explained, and the rule that Dread doubles every cost at
 *   three was stated on the results screen after the game was over.
 *
 *   "The ledger, never a total. If you ever find yourself printing a bare
 *   number, that is the bug." The Deep Run printed "Score 16 of a possible 54"
 *   with nothing deriving 16 from anything, on the one daily where the rates are
 *   the whole strategy.
 */

describe("every daily glosses its own vocabulary", () => {
  for (const game of DAILY_GAMES) {
    const meta = DAILY_META[game];

    it(`${game} explains the words a player meets in it`, () => {
      expect(meta.words.length, `${game} has no glossary`).toBeGreaterThan(0);
    });

    it(`${game} names each term once`, () => {
      const terms = meta.words.map((w) => w.term.toLowerCase());
      expect(new Set(terms).size, `${game} repeats a term`).toBe(terms.length);
    });

    it(`${game} writes glosses the renderer can punctuate`, () => {
      for (const w of meta.words) {
        expect(w.term.trim(), `${game}: empty term`).not.toBe("");
        expect(w.gloss.trim().length, `${game}/${w.term}: empty gloss`).toBeGreaterThan(3);
        // The list renders "Term: gloss." and supplies the stop itself.
        expect(w.gloss.trimEnd().endsWith("."), `${game}/${w.term} ends in a full stop`).toBe(
          false
        );
        // A gloss that uses the word it is glossing has explained nothing.
        expect(
          w.gloss.toLowerCase().includes(w.term.toLowerCase()),
          `${game}/${w.term}: the gloss uses the term it defines`
        ).toBe(false);
      }
    });
  }
});

describe("the Deep Run shows its working", () => {
  /** Take one door on every floor, so the run really resolves rather than stalling. */
  function playThrough(date: string) {
    const puzzle = puzzleFor(date);
    const build = {
      callingId: puzzle.callings[0].id,
      placement: puzzle.abilities.map((_, i) => i),
      kitIds: puzzle.kit.slice(0, 2).map((k) => k.id),
    };
    const steps = puzzle.rooms.map((room) => ({ optionId: room.options[0].id }));
    return run(puzzle, build, steps);
  }

  it("adds up to the score it prints, on every day tested", () => {
    for (const date of ["2026-08-31", "2026-09-01", "2026-09-14", "2026-12-25"]) {
      const result = playThrough(date);
      const summed = result.ledger.reduce((total, row) => total + row.value, 0);
      expect(summed, `${date}: the ledger and the score disagree`).toBe(result.score);
    }
  });

  it("keeps the rows that scored nothing, because those are the ones that teach", () => {
    // A run that stops short scores nothing for getting out and nothing for
    // Vigour, and those two silences are exactly what a player needs told: the
    // way out is worth more than the floor below it. Dropping empty rows would
    // hide the lesson behind the number.
    const result = playThrough("2026-08-31");
    expect(result.ledger.length).toBe(4);
    for (const row of result.ledger) {
      expect(row.label.trim(), "a ledger row with no label").not.toBe("");
      expect(row.rate.trim(), `${row.label} has no rate`).not.toBe("");
    }
  });
});
