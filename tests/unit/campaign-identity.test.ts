/**
 * The proof that the reuse is real.
 *
 * The whole campaign builder rests on one claim: an authored dungeon is played
 * by the SAME runner, scored by the SAME rules and solved by the SAME search as
 * the daily. That claim is cheap to make and easy to quietly break, because two
 * code paths that start identical drift the moment one of them gets a fix the
 * other does not.
 *
 * So: assemble a dungeon out of exactly the rooms a given date would pick, on
 * that date's seed, and assert it produces byte-identical results to the daily.
 * If this ever fails, the builder is running a second game and nobody has said so.
 */
import { describe, expect, it } from "vitest";
import {
  BASE_VIGOUR,
  HOUSE_DEFS,
  ceilingFor,
  dieFor,
  puzzleFor,
  puzzleFrom,
  run,
  type Build,
} from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";

const DATES = ["2026-08-24", "2026-09-03", "2026-10-17"];

/** The same dungeon the date would serve, rebuilt through the authored path. */
function asDesign(date: string) {
  const daily = puzzleFor(date);
  return puzzleFrom(
    {
      seed: date,
      label: date,
      rooms: daily.rooms.map((r) => HOUSE_DEFS.find((d) => d.id === r.id)!),
      callingIds: null,
      kitIds: null,
      baseVigour: BASE_VIGOUR,
    },
    date
  );
}

describe("an authored dungeon is the same object as the daily", () => {
  it("produces an identical puzzle", () => {
    for (const date of DATES) {
      expect(asDesign(date), date).toEqual(puzzleFor(date));
    }
  });

  it("produces an identical par and an identical optimal line", () => {
    for (const date of DATES) {
      const a = parFor(puzzleFor(date));
      // A different seed string would hit the same cache entry, so build the
      // comparison from a puzzle that is genuinely re-derived.
      const b = parFor(asDesign(date));
      expect(b.par, date).toBe(a.par);
      expect(b.best?.steps, date).toEqual(a.best?.steps);
    }
  });

  it("plays a run to the same line, the same score and the same prose", () => {
    for (const date of DATES) {
      const daily = puzzleFor(date);
      const mine = asDesign(date);
      const build: Build = {
        callingId: daily.callings[0].id,
        placement: daily.array.map((_, i) => i),
        kitIds: [daily.kit[0].id, daily.kit[1].id],
      };
      const steps = daily.rooms.map((r) => ({ optionId: r.options[0].id }));
      expect(run(mine, build, steps, HOUSE_DEFS), date).toEqual(run(daily, build, steps));
    }
  });
});

describe("a dungeon may be shorter or longer than the daily", () => {
  it("lets three floors be a legal run, and scores them honestly", () => {
    const daily = puzzleFor("2026-08-24");
    const rooms = daily.rooms.slice(0, 3).map((r) => HOUSE_DEFS.find((d) => d.id === r.id)!);
    const short = puzzleFrom(
      { seed: "SHORT1", label: "A short one", rooms, callingIds: null, kitIds: null, baseVigour: BASE_VIGOUR },
      "SHORT1"
    );
    expect(short.rooms).toHaveLength(3);
    // The ceiling has to follow the depth, or a three-floor dungeon advertises a
    // score nobody on it could ever reach.
    expect(short.maxScore).toBe(ceilingFor(3, BASE_VIGOUR));
    expect(short.maxScore).toBeLessThan(daily.maxScore);

    const { par, best } = parFor(short);
    expect(best).not.toBeNull();
    const played = run(short, best!.build, best!.steps, HOUSE_DEFS);
    expect(played.score).toBe(par);
    expect(played.out).toBe(true);
    expect(played.depth).toBe(3);
  });

  it("pins the dice to the dungeon's own code, not to a date", () => {
    const rooms = puzzleFor("2026-08-24").rooms.slice(0, 4).map(
      (r) => HOUSE_DEFS.find((d) => d.id === r.id)!
    );
    const make = (seed: string) =>
      puzzleFrom({ seed, label: seed, rooms, callingIds: null, kitIds: null, baseVigour: BASE_VIGOUR }, seed);
    // Assert the DICE, not the optimal steps. Two dungeons can share a best line
    // by coincidence (often "take the first door") while being different
    // dungeons, so asserting on the derived thing tests the wrong claim.
    const rolled = (seed: string) => [0, 1, 2, 3].map((i) => dieFor(seed, i));
    expect(rolled("AAAA11")).not.toEqual(rolled("BBBB22"));
    // And the same code is the same dungeon, forever. That is the promise the
    // share link makes, and the thing an author tunes against.
    expect(rolled("AAAA11")).toEqual(rolled("AAAA11"));
    expect(parFor(make("AAAA11")).par).toBe(parFor(make("AAAA11")).par);
  });
});

describe("an author narrows what may be brought", () => {
  it("offers only the Callings and Kit the author allowed", () => {
    const rooms = puzzleFor("2026-08-24").rooms.map((r) => HOUSE_DEFS.find((d) => d.id === r.id)!);
    const p = puzzleFrom(
      {
        seed: "NARROW",
        label: "Knives only",
        rooms,
        callingIds: ["knife", "sapper"],
        kitIds: ["tarred-rope", "whetstone", "pitch-torches"],
        baseVigour: 7,
      },
      "NARROW"
    );
    expect(p.callings.map((c) => c.id).sort()).toEqual(["knife", "sapper"]);
    expect(p.kit).toHaveLength(3);
    expect(p.baseVigour).toBe(7);
  });
});
