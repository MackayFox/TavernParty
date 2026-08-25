/**
 * THE DEEP RUN.
 *
 * Two properties carry the whole design, and both are asserted here: the same
 * dungeon for everybody in the world, and a par that is genuinely the best score
 * available rather than a number somebody guessed.
 */
import { describe, expect, it } from "vitest";
import { CALLINGS } from "@/lib/content/callings";
import {
  ARRAY_SIZE,
  DEPTH,
  ROOMS,
  dieFor,
  puzzleFor,
  run,
  shareText,
  validBuild,
  type Build,
} from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";
import { DEEP_BOSSES, DEEP_ROOMS, KNACKS, KNACK_BY_CALLING } from "@/lib/daily/deeprun-data";
import { ABILITIES } from "@/lib/game/types";

const DAY = "2026-08-24";

function firstBuild(date = DAY): Build {
  const puzzle = puzzleFor(date);
  return {
    callingId: puzzle.callings[0].id,
    placement: puzzle.array.map((_, i) => i),
    kitIds: [puzzle.kit[0].id, puzzle.kit[1].id],
  };
}

function braceEverything(puzzle: ReturnType<typeof puzzleFor>) {
  return puzzle.rooms.map((r) => ({
    optionId: r.options.find((o) => o.kind === "brace")!.id,
  }));
}

describe("the same dungeon for everybody", () => {
  it("serves the identical puzzle twice for one date", () => {
    expect(puzzleFor(DAY)).toEqual(puzzleFor(DAY));
  });

  it("serves a different one tomorrow", () => {
    const a = puzzleFor(DAY).rooms.map((r) => r.id).join();
    const b = puzzleFor("2026-08-25").rooms.map((r) => r.id).join();
    expect(a).not.toBe(b);
  });

  it("pins each room's die to the room and never to the path", () => {
    // The property the whole design rests on: you cannot fish for a better roll
    // by taking a different door, because the room's number does not move.
    for (let i = 0; i < DEPTH; i++) {
      const first = dieFor(DAY, i);
      expect(dieFor(DAY, i)).toBe(first);
      expect(first).toBeGreaterThanOrEqual(1);
      expect(first).toBeLessThanOrEqual(20);
    }
  });

  it("goes down through the bands and ends with something at the bottom", () => {
    const puzzle = puzzleFor(DAY);
    expect(puzzle.rooms).toHaveLength(DEPTH);
    expect(puzzle.rooms[DEPTH - 1].boss).toBe(true);
    expect(puzzle.rooms.slice(0, ROOMS).every((r) => !r.boss)).toBe(true);
  });

  it("puts no answer and no die in the payload", () => {
    const json = JSON.stringify(puzzleFor(DAY)).toLowerCase();
    for (const word of ["par", "best", "solution", "answer", "roll", "die"]) {
      expect(json).not.toContain(`"${word}"`);
    }
  });
});

describe("the build", () => {
  it("accepts a rearrangement of the numbers and refuses a rewrite", () => {
    const puzzle = puzzleFor(DAY);
    const ok = firstBuild();
    expect(validBuild(puzzle, ok)).toBeNull();
    expect(validBuild(puzzle, { ...ok, placement: [0, 0, 1, 2, 3, 4] })).toMatch(/on the table/i);
    expect(validBuild(puzzle, { ...ok, placement: [0, 1, 2] })).toMatch(/every ability/i);
    expect(validBuild(puzzle, { ...ok, callingId: "nobody" })).toMatch(/tonight/i);
    expect(validBuild(puzzle, { ...ok, kitIds: [puzzle.kit[0].id] })).toMatch(/exactly/i);
    expect(validBuild(puzzle, { ...ok, kitIds: [ok.kitIds[0], ok.kitIds[0]] })).toMatch(
      /one of each/i
    );
  });

  it("offers six numbers and all six abilities", () => {
    const puzzle = puzzleFor(DAY);
    expect(puzzle.array).toHaveLength(ARRAY_SIZE);
    expect(puzzle.abilities).toEqual(ABILITIES);
    expect(puzzle.array.every((n) => n >= 3 && n <= 18)).toBe(true);
  });
});

describe("going down", () => {
  it("keeps every ledger honest", () => {
    const puzzle = puzzleFor(DAY);
    const result = run(puzzle, firstBuild(), braceEverything(puzzle));
    for (const line of result.lines) {
      expect(line.mods.reduce((t, m) => t + m.value, 0)).toBe(line.total);
      expect(line.text.length).toBeGreaterThan(10);
    }
  });

  it("stops where the Vigour runs out rather than carrying on", () => {
    const puzzle = puzzleFor(DAY);
    const result = run(puzzle, firstBuild(), braceEverything(puzzle));
    if (result.vigour <= 0) expect(result.out).toBe(false);
    expect(result.lines.length).toBeLessThanOrEqual(DEPTH);
    expect(result.depth).toBe(result.lines.length);
  });

  it("does not throw on a submission that stops early or names nonsense", () => {
    const puzzle = puzzleFor(DAY);
    const build = firstBuild();
    expect(run(puzzle, build, []).depth).toBe(0);
    expect(run(puzzle, build, [{ optionId: "nope" }]).depth).toBe(0);
    const partial = run(puzzle, build, [{ optionId: puzzle.rooms[0].options[0].id }]);
    expect(partial.depth).toBe(1);
    expect(partial.out).toBe(false);
  });

  it("only lets a knack fire once in a whole run", () => {
    const puzzle = puzzleFor(DAY);
    const build = firstBuild();
    const greedy = puzzle.rooms.map((r) => ({ optionId: r.options[0].id, knack: true }));
    const result = run(puzzle, build, greedy);
    const label = puzzle.callings.find((c) => c.id === build.callingId)!.knack.label.toLowerCase();
    const fired = result.lines.filter((l) => l.mods.some((m) => m.label === label));
    expect(fired.length).toBeLessThanOrEqual(1);
  });

  it("pays more for getting out than for getting deep", () => {
    const puzzle = puzzleFor(DAY);
    const { best } = parFor(puzzle);
    expect(best).not.toBeNull();
    const par = run(puzzle, best!.build, best!.steps);
    // There is a puzzle here: the best line beats paying your way through every
    // room, which is the thing anybody can do without thinking.
    const dumb = run(puzzle, firstBuild(), braceEverything(puzzle));
    expect(par.score).toBeGreaterThan(dumb.score);
  });
});

describe("par", () => {
  it("is achievable, and is the score it claims", () => {
    const puzzle = puzzleFor(DAY);
    const { par, best } = parFor(puzzle);
    expect(best).not.toBeNull();
    expect(run(puzzle, best!.build, best!.steps).score).toBe(par);
    expect(par).toBeGreaterThan(0);
  });

  it("stays cheap, because a pinned die means no probability to fold in", () => {
    const started = performance.now();
    parFor(puzzleFor("2026-09-01"));
    // Generous, so it catches a combinatorial explosion rather than a slow day.
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  // Fourteen full par searches. It runs in about 2.2 seconds alone, and there is
  // already a separate test above asserting par is cheap, so this one must not
  // double as an accidental performance assertion: under a full suite run the
  // default five second timeout fails on CPU contention rather than on anything
  // being wrong, and a test that fails for reasons unrelated to its subject is
  // worse than no test.
  it("leaves every day of a fortnight winnable", () => {
    for (let d = 1; d <= 14; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      const puzzle = puzzleFor(date);
      const { par, best } = parFor(puzzle);
      expect(best, date).not.toBeNull();
      const played = run(puzzle, best!.build, best!.steps);
      expect(played.score, date).toBe(par);
      // A day nobody could have got out of is a broken day.
      expect(played.out, date).toBe(true);
    }
  }, 30_000);
});

describe("the content", () => {
  it("gives every room two ways to try and one way to pay", () => {
    for (const room of [...DEEP_ROOMS, ...DEEP_BOSSES]) {
      const checks = room.options.filter((o) => o.kind === "check");
      const braces = room.options.filter((o) => o.kind === "brace");
      expect(checks.length, room.id).toBeGreaterThanOrEqual(2);
      // Exactly one, and it always works: no room is ever a wall, only a price.
      expect(braces.length, room.id).toBe(1);
      // Different abilities, or your build cannot make one door cheaper.
      expect(new Set(checks.map((o) => o.ability)).size, room.id).toBe(checks.length);
      for (const check of checks) {
        expect(check.ability, `${room.id}/${check.id}`).toBeTruthy();
        expect(check.tn ?? 0, `${room.id}/${check.id}`).toBeGreaterThan(0);
        expect(check.vigour ?? 0, `${room.id}/${check.id}`).toBeGreaterThan(0);
      }
      expect(braces[0].vigour ?? 0, room.id).toBeGreaterThan(0);
    }
  });

  it("gets harder as it gets deeper", () => {
    const worst = (band: 1 | 2 | 3) =>
      Math.max(
        ...DEEP_ROOMS.filter((r) => r.band === band).flatMap((r) =>
          r.options.filter((o) => o.kind === "check").map((o) => o.tn ?? 0)
        )
      );
    expect(worst(2)).toBeGreaterThan(worst(1));
    expect(worst(3)).toBeGreaterThan(worst(2));
  });

  it("keeps every id unique", () => {
    const all = [...DEEP_ROOMS, ...DEEP_BOSSES];
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const room of all) {
      expect(new Set(room.options.map((o) => o.id)).size, room.id).toBe(room.options.length);
    }
  });

  it("has enough rooms in every band that a week does not repeat", () => {
    for (const band of [1, 2, 3] as const) {
      expect(DEEP_ROOMS.filter((r) => r.band === band && !r.boss).length).toBeGreaterThanOrEqual(4);
    }
    expect(DEEP_BOSSES.length).toBeGreaterThanOrEqual(4);
  });

  it("writes every room in the house voice", () => {
    for (const room of [...DEEP_ROOMS, ...DEEP_BOSSES]) {
      expect(room.setup, room.id).not.toContain("—");
      expect(room.setup.length, room.id).toBeGreaterThan(60);
      for (const o of room.options) {
        for (const line of [o.promise, o.win, o.lose]) {
          expect(line, `${room.id}/${o.id}`).not.toContain("—");
          expect(line.length, `${room.id}/${o.id}`).toBeGreaterThan(10);
          // The prose never states the cost: that is the ledger's job.
          expect(line, `${room.id}/${o.id}`).not.toMatch(/\bVigour\b/);
        }
      }
    }
  });

  it("gives every Calling a knack the crawl knows about", () => {
    for (const c of CALLINGS) {
      const kind = KNACK_BY_CALLING[c.id];
      expect(kind, c.id).toBeTruthy();
      expect(KNACKS[kind], c.id).toBeTruthy();
    }
  });
});

describe("sharing", () => {
  it("says how it went without giving the dungeon away", () => {
    const puzzle = puzzleFor(DAY);
    const { par, best } = parFor(puzzle);
    const text = shareText(DAY, run(puzzle, best!.build, best!.steps), par);
    expect(text).toContain("THE DEEP RUN");
    expect(text).toContain(DAY);
    for (const room of puzzle.rooms) expect(text).not.toContain(room.title);
  });
});

/**
 * THE AUTHOR'S VIGOUR DIAL.
 *
 * It used to be decorative. `startingVigour` read the module constant, so a
 * dungeon set to 5 played exactly like one set to 9, while the desk called it
 * "thin", the door said "which is thin", and the solver priced it at 9. A setting
 * shown in three places and applied in none.
 *
 * Found by asking why an eight-floor fixture that should have been unsurvivable
 * published 3% of the time. It did, because the dial meant to starve it did
 * nothing. Both readers are asserted here: the runner and the par search, because
 * if they ever disagree par stops describing the game anybody is playing.
 */
describe("the dungeon's own Vigour", () => {
  const design = (baseVigour: number) => ({
    seed: "VIGOUR",
    label: "The Dial",
    rooms: [...DEEP_ROOMS.filter((r) => r.band === 1).slice(0, 2), DEEP_BOSSES[0]],
    callingIds: null,
    kitIds: null,
    baseVigour,
  });

  it("is what a run actually starts with", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    const thin = puzzleFrom(design(5));
    const fat = puzzleFrom(design(13));
    const build = (p: ReturnType<typeof puzzleFrom>): Build => ({
      callingId: p.callings[0].id,
      placement: p.array.map((_, i) => i),
      kitIds: [p.kit[0].id, p.kit[1].id],
    });
    // Brace the first floor, so it costs and nothing is left to the dice, and
    // read the Vigour AFTER it. The final number is clamped at zero, so comparing
    // finished runs compares two floors rather than two starting points.
    const thinRun = run(thin, build(thin), braceEverything(thin), design(5).rooms);
    const fatRun = run(fat, build(fat), braceEverything(fat), design(13).rooms);
    expect(fatRun.lines[0].vigourAfter - thinRun.lines[0].vigourAfter).toBe(8);
  });

  it("changes what the solver thinks par is", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    // More wind to start with can only ever buy a better line, never a worse one.
    expect(parFor(puzzleFrom(design(13))).par).toBeGreaterThan(
      parFor(puzzleFrom(design(5))).par
    );
  });

  it("starves a dungeon that costs more than it hands out", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    const p = puzzleFrom(design(5));
    const b: Build = {
      callingId: p.callings[0].id,
      placement: p.array.map((_, i) => i),
      kitIds: [p.kit[0].id, p.kit[1].id],
    };
    // Bracing three real floors on five Vigour: the run stops rather than
    // finishing on a technicality.
    const result = run(p, b, braceEverything(p), design(5).rooms);
    expect(result.out).toBe(false);
  });
});

/**
 * THE PAR CACHE.
 *
 * It was keyed on the seed alone, which was right for exactly as long as the only
 * dungeon was the daily: there the seed is the date and the date decides every
 * room. An authored dungeon's seed is its code, and the code stays put while the
 * author moves the numbers around, so the desk solved a draft once and then
 * showed that par for the rest of the process's life. Tune a floor, watch nothing
 * happen, publish a number from a dungeon you already changed.
 */
describe("par is cached on the dungeon, not on its name", () => {
  it("re-solves when the rooms change under the same seed", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    const base = {
      seed: "SAMECODE",
      label: "A draft, mid-edit",
      callingIds: null,
      kitIds: null,
      baseVigour: 9,
    };
    const easy = parFor(
      puzzleFrom({ ...base, rooms: DEEP_ROOMS.filter((r) => r.band === 1).slice(0, 3) })
    ).par;
    const harder = parFor(
      puzzleFrom({ ...base, rooms: DEEP_ROOMS.filter((r) => r.band === 3).slice(0, 3) })
    ).par;
    // Different dungeon, same name: two solves, two answers.
    expect(harder).not.toBe(easy);
  });

  it("re-solves when only the Vigour dial moves", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    const rooms = DEEP_ROOMS.filter((r) => r.band === 2).slice(0, 3);
    const of = (baseVigour: number) =>
      parFor(puzzleFrom({ seed: "DIAL", label: "d", rooms, callingIds: null, kitIds: null, baseVigour })).par;
    expect(of(13)).toBeGreaterThan(of(5));
  });

  it("still answers the same dungeon with the same number", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    const rooms = DEEP_ROOMS.filter((r) => r.band === 2).slice(0, 3);
    const design = { seed: "STABLE", label: "s", rooms, callingIds: null, kitIds: null, baseVigour: 9 };
    expect(parFor(puzzleFrom(design)).par).toBe(parFor(puzzleFrom(design)).par);
  });
});

describe("what a line reports", () => {
  it("never says you have minus Vigour", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    // Three floors that each cost four, against a starting five: the last one
    // costs more than is left.
    const rooms = DEEP_ROOMS.filter((r) => r.band === 3).slice(0, 3);
    const p = puzzleFrom({
      seed: "MINUS",
      label: "m",
      rooms,
      callingIds: null,
      kitIds: null,
      baseVigour: 5,
    });
    const b: Build = {
      callingId: p.callings[0].id,
      placement: p.array.map((_, i) => i),
      kitIds: [p.kit[0].id, p.kit[1].id],
    };
    const result = run(p, b, braceEverything(p), rooms);
    for (const line of result.lines) {
      expect(line.vigourAfter).toBeGreaterThanOrEqual(0);
      // And what the floor cost is still the truth, affordable or not.
      expect(line.vigourSpent).toBeGreaterThanOrEqual(0);
    }
    expect(result.vigour).toBe(0);
    expect(result.out).toBe(false);
  });
});

/**
 * WHAT FAILING COSTS, IN THE THREE PLACES THAT HAVE TO AGREE.
 *
 * A brace costs its price and always works; a failed check costs the price plus
 * FAILED_CHECK_EXTRA. That gradient exists because the screen used to read "costs
 * 2 every time" against "costs 2 if it goes wrong" and invited the obvious
 * conclusion that the safe door was pointless.
 *
 * The reason this is tested rather than trusted: the number is read by the runner,
 * by the par search and by the winnability check, and if any one of them disagrees
 * then par describes a different game to the one being played, silently, in a
 * direction nobody would notice until a score looked impossible.
 */
describe("failing costs more than certainty", () => {
  it("charges the extra on a failed check and not on a brace", async () => {
    const { puzzleFrom, FAILED_CHECK_EXTRA, failCost } = await import("@/lib/daily/deeprun");
    const rooms = DEEP_ROOMS.filter((r) => r.band === 2).slice(0, 3);
    const p = puzzleFrom({ seed: "FAILCOST", label: "f", rooms, callingIds: null, kitIds: null, baseVigour: 9 });
    const b: Build = {
      callingId: p.callings[0].id,
      placement: p.array.map((_, i) => i),
      kitIds: [p.kit[0].id, p.kit[1].id],
    };

    // Brace every floor: the price is the price, with nothing added.
    const braced = run(p, b, braceEverything(p), rooms);
    for (const line of braced.lines) {
      const option = p.rooms[line.roomIndex].options.find((o) => o.id === line.optionId)!;
      expect(line.vigourSpent).toBe(option.vigour);
      expect(failCost(option)).toBe(option.vigour);
    }

    // And a failed check costs one more than its own price.
    const checks = p.rooms.map((r) => ({ optionId: r.options.find((o) => o.kind === "check")!.id }));
    const tried = run(p, b, checks, rooms);
    for (const line of tried.lines) {
      const option = p.rooms[line.roomIndex].options.find((o) => o.id === line.optionId)!;
      if (line.cleared) {
        expect(line.vigourSpent).toBe(0);
      } else {
        expect(line.vigourSpent).toBe(option.vigour + FAILED_CHECK_EXTRA);
      }
    }
  });

  it("prices it the same way in the par search, or par is a different game", async () => {
    const { puzzleFrom } = await import("@/lib/daily/deeprun");
    // The proof that the two agree: play the line the solver says is best and see
    // the score it promised. A par search charging a different failure cost would
    // pick a line whose real score is lower than the number it published.
    for (const band of [1, 2, 3] as const) {
      const rooms = DEEP_ROOMS.filter((r) => r.band === band).slice(0, 3);
      for (const seed of ["FC1", "FC2", "FC3", "FC4"]) {
        const p = puzzleFrom({ seed, label: seed, rooms, callingIds: null, kitIds: null, baseVigour: 9 });
        const { par, best } = parFor(p);
        expect(best, `${seed} band ${band}`).toBeTruthy();
        expect(run(p, best!.build, best!.steps, rooms).score, `${seed} band ${band}`).toBe(par);
      }
    }
  });
});

describe("variety", () => {
  /**
   * The rooms are DEALT, not drawn, and this is the property that says so.
   *
   * Each band used to be shuffled fresh every day and the top cards taken, which
   * across days is drawing with replacement out of a pool of five or six. Measured
   * on the old code: ninety per cent of days repeated at least one room from the
   * previous day, so two nights running almost always meant re-solving a floor.
   *
   * The bound is a MEASUREMENT, not an aspiration. Inside a pass a repeat is
   * impossible; what is left comes from the join between two passes, which
   * `roomsFor` documents and which cannot be closed without keeping state. Dealing
   * took it from ninety per cent to forty-two, and doubling bands one and two took
   * that to fourteen.
   *
   * Thirty-five leaves room for the pool to be reshaped without a false alarm,
   * while failing hard on the ninety a bag draw gives and on anything halfway back
   * to it. Both halves of the fix are load-bearing, so both are worth catching.
   */
  it("repeats a room from yesterday far less often than a bag draw would", () => {
    const days: string[] = [];
    for (let d = 0; d < 60; d++) {
      const ms = Date.parse("2026-09-01T00:00:00Z") + d * 86_400_000;
      days.push(new Date(ms).toISOString().slice(0, 10));
    }

    let shared = 0;
    let worst = 0;
    for (let i = 1; i < days.length; i++) {
      const before = new Set(puzzleFor(days[i - 1]).rooms.map((r) => r.id));
      const again = puzzleFor(days[i]).rooms.filter((r) => before.has(r.id));
      if (again.length > 0) shared++;
      worst = Math.max(worst, again.length);
    }
    const rate = shared / (days.length - 1);
    console.log(
      `consecutive-day overlap: ${shared}/${days.length - 1} (${(rate * 100).toFixed(0)}%), worst ${worst}`
    );
    expect(rate, `${shared} of ${days.length - 1} days repeated something`).toBeLessThan(0.35);
    // Half a floor list carried over would mean the deal is not dealing at all.
    expect(worst, "a day repeated most of the previous day").toBeLessThanOrEqual(2);
  });

  /**
   * THE DATE A PLAYER IS TOLD IS NEVER THE SEED.
   *
   * `puzzleFrom` had a local called `date` holding `design.seed`, and put it in the
   * payload's `date`. Identical on almost every day, so it read as correct for
   * months. On a day whose first dice draw nobody could survive, `dieSeedFor`
   * salts the seed to "2026-08-25#1" and re-draws, and the client was then told
   * that was its date. It posts the date back on every floor, where the schema
   * requires a plain one, so a salted day would have refused every run after the
   * first floor.
   *
   * It only surfaced when the room pool doubled and re-draws stopped being rare,
   * which is the argument for asserting it rather than trusting that it looks
   * right. Scan a stretch of days so a salted one is actually included.
   */
  it("tells the player the date and keeps the salt in the seed", () => {
    let salted = 0;
    for (let d = 0; d < 45; d++) {
      const ms = Date.parse("2026-09-01T00:00:00Z") + d * 86_400_000;
      const date = new Date(ms).toISOString().slice(0, 10);
      const puzzle = puzzleFor(date);
      expect(puzzle.date, `${date} was told the wrong date`).toBe(date);
      expect(puzzle.label, date).toBe(date);
      // The seed is allowed to carry a salt, and is the only field that may.
      expect(puzzle.seed.startsWith(date), `${date} seed ${puzzle.seed}`).toBe(true);
      if (puzzle.seed !== date) salted++;
    }
    // If no day in a month and a half needed a re-draw, this test proves nothing
    // and the thing it guards is untested. Say so rather than passing quietly.
    expect(salted, "no day needed a re-draw, so the salt path went unexercised").toBeGreaterThan(0);
  });

  /**
   * The three Callings on offer never share a knack.
   *
   * Eight Callings, five knacks, three seats: a straight shuffle offered two with
   * the same once-a-night move often enough to matter, and two characters whose
   * special move is word for word identical are one character with two names.
   */
  it("offers three different knacks, and still uses every Calling", () => {
    const seenCallings = new Set<string>();
    for (let d = 0; d < 60; d++) {
      const ms = Date.parse("2026-09-01T00:00:00Z") + d * 86_400_000;
      const date = new Date(ms).toISOString().slice(0, 10);
      const offered = puzzleFor(date).callings;
      const kinds = offered.map((c) => c.knack.kind);
      expect(new Set(kinds).size, `${date} offered ${kinds.join(", ")}`).toBe(kinds.length);
      offered.forEach((c) => seenCallings.add(c.id));
    }
    // Deduplicating knacks must not quietly retire the second of each pair.
    expect(seenCallings.size, `only ${[...seenCallings].join(", ")} ever appeared`).toBe(
      Object.keys(KNACK_BY_CALLING).length
    );
  });

  it("still uses the whole pool, rather than settling on a favourite", () => {
    const seen = new Map<string, number>();
    for (let d = 0; d < 120; d++) {
      const ms = Date.parse("2026-09-01T00:00:00Z") + d * 86_400_000;
      const date = new Date(ms).toISOString().slice(0, 10);
      for (const room of puzzleFor(date).rooms) {
        seen.set(room.id, (seen.get(room.id) ?? 0) + 1);
      }
    }
    // Every room and every boss appears over four months, or the deal is not
    // dealing: a bag draw can starve a card indefinitely, a deck cannot.
    for (const room of [...DEEP_ROOMS, ...DEEP_BOSSES]) {
      expect(seen.get(room.id) ?? 0, `${room.id} never came up`).toBeGreaterThan(0);
    }
  });
});
