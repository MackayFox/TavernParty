/**
 * MARKS, THE FAILURE GRADIENT, AND THE RULES THAT KEEP BOTH SAFE.
 *
 * Two mechanics landed together and they interact, so they are guarded together.
 *
 * The gradient: a check no longer just fails, it fails by a little, by a lot, or
 * catastrophically, and the bill differs. It was affordable because every room's
 * die is thrown before anybody chooses, so the band is a constant per (door,
 * character) and the par search gains no dimension at all.
 *
 * The marks: the house pool used ZERO of them for its entire life, while the
 * design doc described them as "the thing that turns six rooms in a row into a
 * descent rather than a list". They are wired in now, and the rules below are the
 * ones that stop a dealt pool becoming unplayable. Every one of them was learned
 * the hard way in the session that added them.
 */
import { describe, expect, it } from "vitest";
import {
  NEAR_BY,
  RUIN_BY,
  failCost,
  outcomeOf,
  stakeLine,
  listOf,
} from "@/lib/daily/core";
import { MARKS, DEEP_ROOMS, DEEP_BOSSES, type RoomDef } from "@/lib/daily/deeprun-data";
import { publicPuzzle, puzzleFor, run } from "@/lib/daily/deeprun";
import { instantProblems, mechanicalHash } from "@/lib/campaign/gate";

const ALL: RoomDef[] = [...DEEP_ROOMS, ...DEEP_BOSSES];
const VOCAB: string[] = Object.values(MARKS);
const CHECKS = ALL.flatMap((r) => r.options.filter((o) => o.kind === "check").map((o) => ({ r, o })));
const BRACES = ALL.flatMap((r) => r.options.filter((o) => o.kind === "brace").map((o) => ({ r, o })));

describe("the failure gradient", () => {
  it("bands a miss by how far short it fell", () => {
    // tn 14: a total of 13 is a graze, 8 is an ordinary miss, 5 is a disaster.
    expect(outcomeOf(10, 14, 14)).toBe("cleared");
    expect(outcomeOf(10, 14 - NEAR_BY, 14)).toBe("near");
    expect(outcomeOf(10, 14 - NEAR_BY - 1, 14)).toBe("bad");
    expect(outcomeOf(10, 14 - RUIN_BY, 14)).toBe("ruin");
  });

  it("keeps the die rule above the arithmetic, in both directions", () => {
    // A 20 clears whatever the sum says, and a 1 is a catastrophe whatever it says.
    expect(outcomeOf(20, -50, 18)).toBe("cleared");
    expect(outcomeOf(1, 99, 5)).toBe("ruin");
  });

  it("charges a graze less than a miss and a disaster more", () => {
    const door = { kind: "check", vigour: 3 };
    expect(failCost(door, "near")).toBeLessThan(failCost(door, "bad"));
    expect(failCost(door, "ruin")).toBeGreaterThan(failCost(door, "bad"));
    // The default is the ordinary miss, which is what every caller meant before
    // there was anything else to mean.
    expect(failCost(door)).toBe(failCost(door, "bad"));
    // A brace cannot fail, so it is flat whatever band it is asked about.
    const slow = { kind: "brace", vigour: 4 };
    for (const band of ["near", "bad", "ruin"] as const) expect(failCost(slow, band)).toBe(4);
  });

  it("never charges a failure nothing at all", () => {
    // A door that cost one Vigour would otherwise make a near miss free, and a
    // free failure is a door you may as well always try.
    for (const { o } of CHECKS) expect(failCost({ kind: "check", vigour: o.vigour ?? 0 }, "near")).toBeGreaterThan(0);
  });
});

describe("what the house wrote", () => {
  it("gives every check its own catastrophe, and a different one from its setback", () => {
    for (const { r, o } of CHECKS) {
      expect(o.ruin, `${r.id}/${o.id} has no ruin`).toBeTruthy();
      expect(o.ruin!.trim(), `${r.id}/${o.id} ruin repeats lose`).not.toBe(o.lose.trim());
    }
  });

  it("uses only the four marks it declared", () => {
    for (const r of ALL)
      for (const o of r.options)
        for (const key of ["sets", "ruinSets", "needs", "forbids"] as const)
          for (const m of o[key] ?? [])
            expect(VOCAB, `${r.id}/${o.id} ${key} has "${m}"`).toContain(m);
  });

  /**
   * THE RULE A DEALT POOL LIVES OR DIES BY.
   *
   * `needs` says a door only opens if you are already carrying something. That is
   * sound in an AUTHORED dungeon, where somebody fixed the floor order and can
   * guarantee the mark is handed out above. It is not sound here: the daily deals
   * two rooms from band one, two from band two and one from band three, each pool
   * shuffled independently, so no room can assume anything about what came before
   * it and a `needs` door is dead whenever the deal did not happen to supply it.
   *
   * The campaign gate already blocks exactly this, and it caught it: six `needs`
   * doors were authored into the pool, and 2026-09-30 dealt a floor wanting "lit"
   * with nothing above it that hands a light out. The gate called it dead content
   * and it was right.
   *
   * `forbids` has no such problem and is where all the bite is: carrying nothing
   * leaves every door open, so a fresh run can never meet a wall.
   */
  it("gates doors with forbids only, because the daily deals its rooms blind", () => {
    for (const r of ALL)
      for (const o of r.options)
        expect(o.needs ?? [], `${r.id}/${o.id} uses needs, which a dealt pool cannot guarantee`).toEqual([]);
    expect(CHECKS.some(({ o }) => (o.forbids ?? []).length > 0)).toBe(true);
  });

  it("never gates the slow certain way through", () => {
    // The brace is the promise that a floor is a price rather than a wall.
    for (const { r, o } of BRACES) {
      expect(o.needs ?? [], `${r.id}/${o.id}`).toEqual([]);
      expect(o.forbids ?? [], `${r.id}/${o.id}`).toEqual([]);
    }
  });

  it("leaves at least one check open to somebody carrying everything", () => {
    const everything = new Set(VOCAB);
    for (const r of ALL) {
      const open = r.options.filter(
        (o) => o.kind === "check" && !(o.forbids ?? []).some((m) => everything.has(m))
      );
      expect(open.length, `${r.id} shuts every check on somebody carrying all four marks`).toBeGreaterThan(0);
    }
  });

  it("keeps the marks the solver has to remember inside its budget", () => {
    // bestFor memoises on the subset of marks some door TESTS, so the table is
    // bounded by 2 ^ (marks read). Four is sixteen. A dozen would be four
    // thousand, and this sits in the path of every request for tonight's puzzle.
    const read = new Set<string>();
    for (const r of ALL)
      for (const o of r.options) {
        for (const m of o.needs ?? []) read.add(m);
        for (const m of o.forbids ?? []) read.add(m);
      }
    expect(read.size).toBeLessThanOrEqual(4);
  });

  it("hands a light out by winning and never by falling over", () => {
    // The other three are things that happen TO you. A light is a thing you get.
    for (const r of ALL)
      for (const o of r.options)
        expect(o.ruinSets ?? [], `${r.id}/${o.id}`).not.toContain(MARKS.LIT);
  });

  it("writes no em-dashes and prints no numbers in the prose", () => {
    for (const r of ALL) {
      const copy = [r.title, r.setup, ...r.options.flatMap((o) => [o.label, o.promise, o.win, o.lose, o.ruin ?? ""])];
      for (const line of copy) {
        expect(line, r.id).not.toContain("—");
        expect(line, `${r.id} prints a numeral`).not.toMatch(/\d/);
      }
    }
  });
});

describe("what a floor comes away with", () => {
  it("marks you for a catastrophe as well as for a win", () => {
    // The whole of "floor two comes back on floor five". Before this, only a door
    // that WORKED could leave anything on you, so a run's history could never
    // narrow its own choices.
    const marked = CHECKS.filter(({ o }) => (o.ruinSets ?? []).length > 0);
    expect(marked.length).toBeGreaterThan(CHECKS.length / 2);
  });

  it("carries a ruin's marks into the run, not just into the sentence", () => {
    // Walk real days until a ruin actually happens, then assert the run is
    // holding what that ruin handed out. Pinned dice, so this is deterministic.
    let checked = 0;
    for (let day = 1; day <= 28 && checked === 0; day++) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      const puzzle = puzzleFor(date);
      const build = {
        callingId: puzzle.callings[0].id,
        placement: [0, 1, 2, 3, 4, 5],
        kitIds: [puzzle.kit[0].id, puzzle.kit[1].id],
      };
      const steps = puzzle.rooms.map((r) => ({ optionId: r.options[0].id }));
      const result = run(puzzle, build, steps, ALL);
      for (const line of result.lines) {
        if (line.outcome !== "ruin") continue;
        const door = ALL.find((r) => r.id === puzzle.rooms[line.roomIndex].id)!
          .options.find((o) => o.id === line.optionId)!;
        for (const m of door.ruinSets ?? []) expect(line.marks).toContain(m);
        expect(line.gained).toEqual(door.ruinSets ?? []);
        checked++;
      }
    }
    expect(checked, "no ruin happened in four weeks of first doors").toBeGreaterThan(0);
  });
});

describe("what the gate refuses to publish", () => {
  /*
   * A check with no target used to be an ordinary always-fail. With the failure
   * gradient it misses by ninety every time, which is a RUIN every time: top
   * price, ruin sentence, ruin marks, on every attempt. Par and the runner agree
   * about it, so the desk would have rated it and published it in silence.
   */
  it("blocks a check with no number to beat", () => {
    const room = {
      id: "r", band: 1 as const, title: "T", setup: "s",
      options: [
        { id: "a", label: "Try it", kind: "check" as const, ability: "grit" as const, vigour: 2,
          promise: "p", win: "w", lose: "l" },
        { id: "b", label: "The slow way", kind: "brace" as const, vigour: 2,
          promise: "p", win: "w", lose: "w" },
      ],
    };
    expect(instantProblems({
      seed: "x", label: "x", rooms: [room], callingIds: null, kitIds: null, baseVigour: 9,
    }).join(" ")).toContain("no number to beat");
  });

  it("counts a ruin's marks when it checks a door's marks are named", () => {
    const room = {
      id: "r", band: 1 as const, title: "T", setup: "s",
      options: [
        { id: "a", label: "Try it", kind: "check" as const, ability: "grit" as const, tn: 12,
          vigour: 2, promise: "p", win: "w", lose: "l", ruinSets: ["   "] },
        { id: "b", label: "The slow way", kind: "brace" as const, vigour: 2,
          promise: "p", win: "w", lose: "w" },
      ],
    };
    expect(instantProblems({
      seed: "x", label: "x", rooms: [room], callingIds: null, kitIds: null, baseVigour: 9,
    }).join(" ")).toContain("mark with no name");
  });

  it("notices a mark change, so a published dungeon is re-solved", () => {
    /*
     * `mechanicalHash` decides whether anything needs re-solving, and it was
     * blind to all four mark fields while its sibling in deeprun-par.ts was not.
     * A dungeon whose marks changed hashed identical, so the seeder concluded
     * nothing had changed and kept serving the old rooms under the old par.
     */
    const base = (extra: Record<string, unknown>) => ({
      seed: "x", label: "x", callingIds: null, kitIds: null, baseVigour: 9,
      rooms: [{
        id: "r", band: 1 as const, title: "T", setup: "s",
        options: [
          { id: "a", label: "Try it", kind: "check" as const, ability: "grit" as const, tn: 12,
            vigour: 2, promise: "p", win: "w", lose: "l", ...extra },
          { id: "b", label: "The slow way", kind: "brace" as const, vigour: 2,
            promise: "p", win: "w", lose: "w" },
        ],
      }],
    });
    expect(mechanicalHash(base({}))).not.toBe(mechanicalHash(base({ ruinSets: ["hurt"] })));
    expect(mechanicalHash(base({}))).not.toBe(mechanicalHash(base({ forbids: ["wet"] })));
    // Prose still must not trigger a solve. That is the whole point of the hash.
    expect(mechanicalHash(base({ win: "different words entirely" }))).toBe(mechanicalHash(base({})));
  });
});

describe("what the player is allowed to see", () => {
  /**
   * The reversal that made the doors readable. Every room prices all of its
   * checks identically, so the target number was the ONLY thing telling three
   * doors apart, and the fastest correct way to play was to read three numbers
   * and take the smallest without reading a word. It is deferred to the reveal
   * now, which is where it teaches instead of shortcuts.
   */
  it("sends neither the ability nor the number a door wants", () => {
    const shown = publicPuzzle(puzzleFor("2026-08-25"));
    for (const room of shown.rooms)
      for (const o of room.options) {
        expect(o).not.toHaveProperty("ability");
        expect(o).not.toHaveProperty("tn");
      }
    /*
     * Scoped to the ROOMS, not the whole payload. Your own kit still carries an
     * `ability`, and it must: "+2 Wits" is a fact about you and the sheet prints
     * it. What is redacted is which ability a DOOR leans on.
     */
    const rooms = JSON.stringify(shown.rooms);
    expect(rooms).not.toContain('"tn"');
    expect(rooms).not.toContain('"ability"');
  });

  it("still sends the mark rules, because a bet needs its terms", () => {
    // What a catastrophe leaves on you replaced the target number on the door. A
    // door that shuts on "hurt" three floors down is only fair if you could see
    // what might make you hurt up here.
    const shown = publicPuzzle(puzzleFor("2026-08-25"));
    const anyOption = shown.rooms.flatMap((r) => r.options);
    expect(anyOption.every((o) => Array.isArray(o.ruinSets))).toBe(true);
    expect(anyOption.every((o) => Array.isArray(o.forbids))).toBe(true);
  });

  it("says the stake in words, and never as something sortable", () => {
    expect(stakeLine(["hurt"])).toBe("Go badly wrong here and you come away hurt.");
    expect(stakeLine(["hurt", "seen"])).toBe("Go badly wrong here and you come away hurt and seen.");
    expect(listOf(["wet", "seen", "hurt"])).toBe("wet, seen and hurt");
  });

  it("gives a door with nothing to say a sentence anyway", () => {
    /*
     * Eleven checks in the pool leave no mark on a ruin, and this used to return
     * null for them, so they rendered an empty line beside two siblings each
     * carrying one. The stake is what replaced the target number as the thing
     * telling three doors apart; a hole reads as a rendering fault rather than as
     * "this one is survivable", and "nothing follows you" is real information.
     */
    for (const v of [[], undefined]) {
      const line = stakeLine(v);
      expect(line).toBeTruthy();
      expect(line).not.toMatch(/\d/);
    }
    const quiet = CHECKS.filter(({ o }) => (o.ruinSets ?? []).length === 0);
    for (const { r, o } of quiet)
      expect(stakeLine(o.ruinSets), `${r.id}/${o.id}`).toBeTruthy();
  });
});
