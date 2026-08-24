/**
 * Balance, measured by playing the game rather than by reading it.
 *
 * The audit found two things here that no amount of code review would have
 * caught, and both needed a number to see:
 *
 *   1. Keeping every Scar won 74-82% of games at EVERY table size, because bots
 *      voted their Laurel for whoever wore the most public Scars and kept Scars
 *      are public. It was the dominant strategy in the game and it was one
 *      button, pressed every Act.
 *   2. Both published Dread thresholds were a timetable, not a threat. Over
 *      1,500 six-handed runs the doubling threshold was crossed in 100% of games
 *      by a mean of Act 2.1 and 42% of all keep-or-hide decisions happened with
 *      Dread pinned at the ceiling, where keeping a Scar taxes the party nothing.
 *
 * The bounds below are deliberately generous. This is a regression fence against
 * a strategy becoming dominant again, not a pin holding one tuning in place.
 */
import { describe, expect, it } from "vitest";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import * as engine from "@/lib/game/engine";
import { dreadThresholds } from "@/lib/game/rules";
import { rngFor } from "./helpers";

const NOW = 1_000_000;
type Policy = "keepAll" | "hideAll" | "median";

/** One full night with a human following `policy` against a table of strangers. */
function play(seats: number, seed: number, policy: Policy) {
  const room = engine.createRoom(
    { code: `T${seed}`, name: "The Test", visibility: "public" },
    NOW
  );
  engine.join(room, { id: "me", name: "ME" }, NOW);
  for (let i = 1; i < seats; i++) engine.addBot(room, "me", NOW, rngFor(seed * 100 + i));
  engine.startRun(room, "me", NOW, rngFor(seed));

  const rng = rngFor(seed);
  const thresholds = dreadThresholds(seats);
  let now = NOW;
  let atCap = 0;
  let windows = 0;
  let crossedDouble = false;
  let turned = false;

  for (let step = 0; step < 900 && room.phase !== "FINAL"; step++) {
    if (room.phase === "ACT" && room.act) {
      const scene = SCENES_BY_ID[room.act.sceneId];
      const safe = scene.approaches.filter((a) => !a.reckless)[0];
      try {
        engine.commitApproach(room, "me", safe.id, 0, now + 1);
      } catch {
        /* already moved */
      }
    }
    if (room.phase === "ACT_RESULT") {
      windows++;
      if (room.dread >= thresholds.max) atCap++;
      if (room.dread >= thresholds.double) crossedDouble = true;
      if (room.dread >= thresholds.turn) turned = true;
      const me = engine.findPlayer(room, "me")!;
      const open = me.scars.find((s) => s.kept === null);
      if (open) {
        const sorted = room.players.map((p) => p.renown).sort((a, b) => a - b);
        const middle = sorted[Math.ceil((sorted.length - 1) / 2)];
        const keep =
          policy === "keepAll" ? true : policy === "hideAll" ? false : me.renown >= middle;
        try {
          engine.decideScar(room, "me", open.id, keep, now + 1);
        } catch {
          /* window closed */
        }
      }
    }
    if (room.phase === "BALLAD") {
      const other = room.players.find((p) => p.id !== "me");
      if (other) {
        try {
          engine.castLaurel(room, "me", other.id, now + 1);
        } catch {
          /* already voted */
        }
      }
    }
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }

  const mine = room.standings?.find((s) => s.playerId === "me");
  return {
    won: !!mine?.hoard,
    laurels: mine?.laurels ?? 0,
    atCapShare: windows > 0 ? atCap / windows : 0,
    crossedDouble,
    turned,
  };
}

function sweep(seats: number, policy: Policy, runs: number) {
  let wins = 0;
  let laurels = 0;
  let atCap = 0;
  let doubled = 0;
  let turned = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const r = play(seats, seed, policy);
    if (r.won) wins++;
    laurels += r.laurels;
    atCap += r.atCapShare;
    if (r.crossedDouble) doubled++;
    if (r.turned) turned++;
  }
  return {
    winRate: wins / runs,
    laurels: laurels / runs,
    atCap: atCap / runs,
    doubled: doubled / runs,
    turned: turned / runs,
  };
}

describe("no Scar policy is dominant", () => {
  it("does not let keeping everything run away with the game", () => {
    for (const seats of [4, 6]) {
      const baseline = 1 / seats;
      const keep = sweep(seats, "keepAll", 60);
      // It used to win three to four times its share of games. A real strategy is
      // allowed to be good; it is not allowed to be this.
      expect(keep.winRate, `${seats}p keepAll ${(keep.winRate * 100).toFixed(1)}%`).toBeLessThan(
        baseline * 2
      );
    }
  });

  it("hands out Laurels at the same rate whatever the human does", () => {
    // The actual root cause: the vote was a lever with a handle on it. Now it is
    // a seeded scatter, so no policy attracts more of them than any other.
    const seats = 6;
    const keep = sweep(seats, "keepAll", 40);
    const hide = sweep(seats, "hideAll", 40);
    expect(Math.abs(keep.laurels - hide.laurels)).toBeLessThan(0.5);
  });

  it("still rewards wearing them over hiding them", () => {
    // Hiding costs Renown now and pays nothing later, so it should be the worst
    // of the three. If this ever inverts, the Scar economy has stopped meaning
    // anything.
    const keep = sweep(6, "keepAll", 40);
    const hide = sweep(6, "hideAll", 40);
    expect(keep.winRate).toBeGreaterThan(hide.winRate);
  });
});

describe("Dread is a threat rather than a schedule", () => {
  it("does not cross its own doubling threshold in every single game", () => {
    for (const seats of [2, 4, 6]) {
      const s = sweep(seats, "median", 40);
      expect(s.doubled, `${seats}p doubled ${(s.doubled * 100).toFixed(0)}%`).toBeLessThan(0.9);
    }
  });

  it("does not turn the night in almost every game", () => {
    const s = sweep(6, "median", 40);
    expect(s.turned).toBeLessThan(0.75);
  });

  it("rarely pins at the ceiling, where keeping a Scar would be free", () => {
    for (const seats of [2, 4, 6]) {
      const s = sweep(seats, "median", 40);
      // Was 42% of all keep-or-hide windows.
      expect(s.atCap, `${seats}p at-cap ${(s.atCap * 100).toFixed(1)}%`).toBeLessThan(0.15);
    }
  });

  it("still gets there sometimes, or the escalation is decoration", () => {
    const s = sweep(6, "median", 40);
    expect(s.doubled).toBeGreaterThan(0.2);
  });
});
