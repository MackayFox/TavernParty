/**
 * The dailies, on the properties that were quietly false.
 *
 * The three dice games all showed a player their own sum against a target number
 * and labelled the door with it, and none of them knew that a natural 1 always
 * fails and a natural 20 always succeeds. On THE LONG WAY DOWN, whose entire
 * pitch is that you can see every roll before you make it, that is not a rounding
 * error: it is the pitch being false. These tests hold the labels to the server's
 * own ledger, on real published days rather than on invented numbers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restore } from "@/app/daily/deeprun/DeepRunGame";
import { writeProgress } from "@/lib/daily/local";
import {
  ARCHIVE_START,
  DIE_RULE,
  archiveDates,
  clears,
  dailyCacheControl,
  faceNeeded,
  reachNote,
} from "@/lib/daily/core";
import * as longway from "@/lib/daily/longway";
import * as muster from "@/lib/daily/muster";
import { AFFINITY_BONUS, CRIT, FUMBLE, HOOK_TOKEN_VALUE, abilityMod } from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";

/** A run of real dates rather than a handful, because the bug is a minority case. */
function dates(count: number, from = ARCHIVE_START): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * THE LONG WAY DOWN's preview, copied from the page on purpose.
 *
 * `LongwayGame.reachOf` is the one number that screen works out for itself, and
 * a test that called the server's own helper instead would not be testing
 * anything. If these two ever drift apart, the first assertion below is the one
 * that says so.
 */
function reachOf(puzzle: longway.Puzzle, face: number, ability: Ability, spending: number): number {
  const trained = puzzle.who.affinities.includes(ability) ? AFFINITY_BONUS : 0;
  const carried =
    puzzle.who.kitBonus && puzzle.who.kitBonus.ability === ability ? puzzle.who.kitBonus.value : 0;
  return (
    face + abilityMod(puzzle.who.scores[ability]) + trained + carried + spending * HOOK_TOKEN_VALUE
  );
}

/** The server's ledger for one door of one Act, reached by standing still first. */
function ledgerForDoor(puzzle: longway.Puzzle, act: number, doorId: string, spend: number) {
  const choices = [
    ...Array.from({ length: act }, () => ({ doorId: longway.FLINCH, spend: 0 })),
    { doorId, spend },
  ];
  return longway.play(puzzle, choices).ledgers[act];
}

/**
 * Nought, one or two Hook tokens: the whole of the spend selector.
 *
 * It matters to this test more than it looks. On a face of 1 the arithmetic only
 * climbs past a target number once tokens are on the table, at five points each,
 * so a door that promised "enough" and could never open is a thing that happens
 * to a player who is spending, which is to say a player who is trying.
 */
const SPENDS = [0, 1, 2];

describe("a 1 always fails and a 20 always clears", () => {
  it("labels every door of every Act the way the server will resolve it", () => {
    for (const date of dates(40)) {
      const puzzle = longway.puzzleFor(date);
      puzzle.acts.forEach((act, i) => {
        for (const door of act.doors) {
          for (const spend of SPENDS) {
            const where = `${date} act ${i + 1} ${door.id} spending ${spend}`;
            const ledger = ledgerForDoor(puzzle, i, door.id, spend);
            const reach = reachOf(puzzle, act.face, door.ability, spend);

            // The page's arithmetic is the server's arithmetic.
            expect(reach, where).toBe(ledger.total);
            // And the page's verdict is the server's verdict.
            expect(clears(act.face, reach, door.tn), where).toBe(ledger.success);

            const note = reachNote(act.face, reach, door.tn);
            if (act.face === FUMBLE) expect(note, where).toContain("stays shut");
            else if (act.face === CRIT) expect(note, where).toContain("opens");
            else expect(note, where).toBe(reach >= door.tn ? "enough" : `short by ${door.tn - reach}`);
          }
        }
      });
    }
  });

  it("counts the doors the old label got wrong, so nobody reverts it", () => {
    // Plain `reach >= tn`, which is what all three dice games shipped, against the
    // rule. Real published nights, not invented numbers.
    let promisedAndShut = 0;
    let refusedAndOpen = 0;

    for (const date of dates(400)) {
      const puzzle = longway.puzzleFor(date);
      for (const act of puzzle.acts) {
        for (const door of act.doors) {
          for (const spend of SPENDS) {
            const reach = reachOf(puzzle, act.face, door.ability, spend);
            if (reach >= door.tn === clears(act.face, reach, door.tn)) continue;
            if (act.face === FUMBLE) promisedAndShut++;
            if (act.face === CRIT) refusedAndOpen++;
          }
        }
      }
    }

    // Doors that said "enough" and could never have opened. Over four hundred
    // published nights it is not a rare curiosity, it is well over a hundred.
    expect(promisedAndShut).toBeGreaterThan(100);
    // The mirror case is rarer, because a 20 clears most target numbers on its
    // own, but it is in there too and it costs a player a door they could have had.
    expect(refusedAndOpen).toBeGreaterThan(0);
  });

  it("previews a MUSTER build the way the night will score it", () => {
    // MUSTER showed a die, a target number and nothing joining the two, so the
    // only decision in it (which door to give up) was buried under six
    // subtractions done in your head. The page now works the sum out. This is
    // that sum, held against the server's.
    for (const date of dates(30)) {
      const puzzle = muster.puzzleFor(date);
      const build = {
        placement: [0, 1, 2, 3, 4, 5],
        callingId: puzzle.callings[2].id,
        kitId: puzzle.kit[1].id,
      };
      const calling = puzzle.callings.find((c) => c.id === build.callingId)!;
      const kit = puzzle.kit.find((k) => k.id === build.kitId)!;
      const scores = muster.scoresOf(puzzle, build.placement);
      const played = muster.play(puzzle, build);

      puzzle.trials.forEach((trial, i) => {
        const bonus =
          (calling.affinities.includes(trial.ability) ? AFFINITY_BONUS : 0) +
          (kit.ability === trial.ability ? kit.value : 0);
        const reach = trial.face + abilityMod(scores[trial.ability]) + bonus;
        expect(reach, `${date} ${trial.id}`).toBe(played.trials[i].total);
        expect(clears(trial.face, reach, trial.tn), `${date} ${trial.id}`).toBe(
          played.trials[i].cleared
        );
      });
    }
  });

  it("holds both directions of the rule, whatever the total comes to", () => {
    expect(clears(CRIT, 5, 30)).toBe(true); // nowhere near, and it opens anyway
    expect(clears(FUMBLE, 99, 5)).toBe(false); // miles over, and it stays shut
    expect(clears(11, 14, 14)).toBe(true);
    expect(clears(11, 13, 14)).toBe(false);
    expect(reachNote(FUMBLE, 40, 10)).toContain("stays shut");
    expect(reachNote(CRIT, 2, 40)).toContain("opens");
    expect(reachNote(9, 12, 15)).toBe("short by 3");
  });

  it("never asks for a face that cannot clear, or refuses one that always does", () => {
    // THE DEEP RUN prints "so a 12 or better" before you open a room. It used to
    // floor that at 1, which promises a door on the one face that never opens
    // anything, and cap it at 20 without knowing that a 20 opens everything.
    for (let tn = 5; tn <= 30; tn++) {
      for (let bonus = -4; bonus <= 14; bonus++) {
        const need = faceNeeded(tn, bonus);
        expect(need).toBeGreaterThanOrEqual(FUMBLE + 1);
        expect(need).toBeLessThanOrEqual(CRIT);
        for (let face = 1; face <= 20; face++) {
          expect(clears(face, face + bonus, tn), `${face} against ${tn} with ${bonus}`).toBe(
            face >= need
          );
        }
      }
    }
  });

  it("says the rule out loud, in the register of the product", () => {
    expect(DIE_RULE).toContain("1");
    expect(DIE_RULE).toContain("20");
    expect(DIE_RULE).not.toContain("—");
  });
});

describe("the puzzle is a constant, so it is cached like one", () => {
  const routes = [
    ["longway", () => import("@/app/api/daily/longway/route")],
    ["deeprun", () => import("@/app/api/daily/deeprun/route")],
    ["ledger", () => import("@/app/api/daily/ledger/route")],
    ["muster", () => import("@/app/api/daily/muster/route")],
    ["index", () => import("@/app/api/daily/route")],
  ] as const;

  it("expires today's puzzle at the reset and never after it", () => {
    // A minute to midnight, a cache that outlives the day would be serving
    // yesterday's dice to somebody who has already had tomorrow's.
    const nearly = Date.parse("2026-08-24T23:59:00Z");
    expect(dailyCacheControl(false, nearly)).toBe("public, max-age=60, s-maxage=60");
    const midday = Date.parse("2026-08-24T12:00:00Z");
    expect(dailyCacheControl(false, midday)).toBe("public, max-age=43200, s-maxage=43200");
    // A finished day cannot change again.
    expect(dailyCacheControl(true)).toContain("immutable");
  });

  it("says so on every GET", async () => {
    for (const [game, load] of routes) {
      const route = await load();
      const res = await route.GET(new Request(`http://t/api/daily/${game}`));
      const header = res.headers.get("cache-control") ?? "";
      expect(header, game).toContain("public");
      expect(header, game).toMatch(/max-age=\d+/);
      expect(header, game).not.toContain("no-store");
    }
  });

  it("holds an archive night for longer than a night", async () => {
    const route = await import("@/app/api/daily/muster/route");
    const res = await route.GET(new Request(`http://t/api/daily/muster?date=${ARCHIVE_START}`));
    expect(res.headers.get("cache-control")).toContain("immutable");
  });
});

describe("a deep run survives a reload", () => {
  /**
   * THE DEEP RUN kept the whole run in React state and never wrote a word of it
   * down, on the one daily where the dice arrive a room at a time and cannot be
   * seen again. A reload halfway down destroyed the run with no way back to it.
   */
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
      },
    });
  });

  const DAY = "2026-08-24";
  type Payload = Parameters<typeof restore>[0];

  const payload = (): Payload => ({
    date: DAY,
    archive: false,
    array: [14, 13, 12, 11, 10, 9],
    abilities: ["brawn", "deft", "grit", "wits", "nerve", "charm"],
    callings: [
      {
        id: "warden",
        name: "Warden",
        blurb: "",
        affinities: ["brawn", "grit"],
        knack: { kind: "pass", label: "Hold", text: "" },
      },
    ],
    kit: [
      { id: "rope", name: "Rope", blurb: "", ability: "brawn", value: 2 },
      { id: "lamp", name: "Lamp", blurb: "", ability: "wits", value: 2 },
    ],
    rooms: [
      {
        id: "r1",
        index: 0,
        title: "The Stair",
        setup: "",
        boss: false,
        options: [
          { id: "r1-climb", label: "Climb", kind: "check", ability: "brawn", tn: 14, vigour: 2, promise: "" },
        ],
      },
      {
        id: "r2",
        index: 1,
        title: "The Sump",
        setup: "",
        boss: true,
        options: [
          { id: "r2-wade", label: "Wade", kind: "brace", ability: null, tn: null, vigour: 3, promise: "" },
        ],
      },
    ],
    baseVigour: 9,
    maxScore: 40,
  });

  const midRun = {
    callingId: "warden",
    slots: [0, 1, 2, 3, 4, 5],
    kitIds: ["rope", "lamp"],
    down: true,
    steps: [{ optionId: "r1-climb" }],
    reply: { lines: [{ roomIndex: 0 }], vigour: 7, finished: false },
  };

  function save(state: unknown) {
    writeProgress("deeprun", DAY, state);
  }

  it("hands back the character and the floors already opened", () => {
    save(midRun);
    const back = restore(payload());
    expect(back?.callingId).toBe("warden");
    expect(back?.kitIds).toEqual(["rope", "lamp"]);
    expect(back?.down).toBe(true);
    expect(back?.steps).toHaveLength(1);
    expect(back?.reply?.vigour).toBe(7);
  });

  it("keeps the build but drops a descent it cannot vouch for", () => {
    // Lines and steps are written together and mean nothing apart.
    save({ ...midRun, reply: { ...midRun.reply, lines: [] } });
    const torn = restore(payload());
    expect(torn?.callingId).toBe("warden");
    expect(torn?.steps).toEqual([]);
    expect(torn?.reply).toBeNull();
    expect(torn?.down).toBe(false);

    // A door that is not in tonight's dungeon at all: yesterday's run, or a
    // release that moved the rooms about.
    save({ ...midRun, steps: [{ optionId: "not-a-door" }] });
    const stale = restore(payload());
    expect(stale?.callingId).toBe("warden");
    expect(stale?.steps).toEqual([]);
  });

  it("refuses a character tonight could not have made", () => {
    save({ ...midRun, callingId: "somebody-else" });
    expect(restore(payload())).toBeNull();
    save({ ...midRun, kitIds: ["rope", "rope"] });
    expect(restore(payload())).toBeNull();
    save({ ...midRun, slots: [0, 1, 2] });
    expect(restore(payload())).toBeNull();
  });

  it("starts a fresh run when there is nothing stored", () => {
    expect(restore(payload())).toBeNull();
  });
});

describe("the shelf", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still has its first day on it a year later", () => {
    // The cap was 120 while the archive page renders all of them, so from the end
    // of November 2026 the oldest day would have dropped off every morning with
    // nothing on the page to say it had gone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-06-01T09:00:00Z"));
    const shelf = archiveDates();
    expect(shelf[0]).toBe("2027-06-01");
    expect(shelf).toContain(ARCHIVE_START);
    expect(shelf.at(-1)).toBe(ARCHIVE_START);
  });
});
