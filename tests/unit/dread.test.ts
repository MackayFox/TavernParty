/**
 * The Dread economy, measured rather than asserted about.
 *
 * The audit's finding was that both published thresholds were a schedule, not a
 * threat: over 1,500 six-handed runs the doubling threshold was crossed in 100%
 * of games by a mean of Act 2.1, the turning threshold in 100% by Act 2.7, and
 * 42% of all keep-or-hide decisions happened with Dread already pinned at the
 * ceiling, where keeping a Scar taxes the party nothing at all. Dread is
 * generated per player and was being measured against a fixed ceiling.
 *
 * These tests run real nights and check the distribution, because that is the
 * only way to tell tension from a timetable.
 */
import { describe, expect, it } from "vitest";
import * as engine from "@/lib/game/engine";
import { DREAD_RELIEF, dreadThresholds } from "@/lib/game/rules";
import type { Room } from "@/lib/game/types";
import { rngFor } from "./helpers";

const NOW = 1_000_000;

function playOut(seats: number, seed: number): Room {
  const room = engine.createRoom(
    { code: `T${seed}`, name: "The Test", visibility: "public" },
    NOW
  );
  engine.join(room, { id: "p0", name: "P0" }, NOW);
  // Bots for the rest, deliberately: they COMMIT to a door on the deadline, and a
  // table of absent humans all flinches, which means no Act is ever cleared and
  // the relief valve can never be observed. A test that plays nobody is not
  // measuring the game.
  for (let i = 1; i < seats; i++) engine.addBot(room, "p0", NOW, rngFor(seed + i));
  engine.startRun(room, "p0", NOW, rngFor(seed));
  const rng = rngFor(seed);
  let now = NOW;
  for (let i = 0; i < 600 && room.phase !== "FINAL"; i++) {
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }
  return room;
}

describe("the thresholds scale with the table", () => {
  it("rises with head count, because the supply of Dread does", () => {
    const two = dreadThresholds(2);
    const six = dreadThresholds(6);
    expect(six.double).toBeGreaterThan(two.double);
    expect(six.turn).toBeGreaterThan(two.turn);
    expect(six.max).toBeGreaterThan(two.max);
    // And they stay in order at every size, or the night turns before costs double.
    for (let n = 1; n <= 6; n++) {
      const t = dreadThresholds(n);
      expect(t.double, `n=${n}`).toBeLessThan(t.turn);
      expect(t.turn, `n=${n}`).toBeLessThan(t.max);
    }
  });

  it("never returns something a one-player daily cannot use", () => {
    const solo = dreadThresholds(1);
    expect(solo.double).toBeGreaterThan(0);
    expect(dreadThresholds(0)).toEqual(solo);
    expect(dreadThresholds(-3)).toEqual(solo);
  });
});

describe("a night's Dread, played out", () => {
  it("does not pin at the ceiling in most games at a big table", () => {
    // The measured failure: 42% of keep-or-hide windows happened at the cap,
    // which made keeping a Scar free exactly when it should have cost most.
    let pinned = 0;
    const runs = 24;
    for (let seed = 1; seed <= runs; seed++) {
      const room = playOut(6, seed);
      if (room.dread >= dreadThresholds(6).max) pinned++;
    }
    expect(pinned / runs).toBeLessThan(0.5);
  });

  it("can go down as well as up", () => {
    // Dread had no downward direction at all: every source added and nothing
    // ever subtracted, so it could only ratchet.
    expect(DREAD_RELIEF).toBeGreaterThan(0);
    let sawRelief = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const room = playOut(4, seed);
      if (room.log.some((l) => l.text.includes("room feels bigger"))) sawRelief++;
    }
    expect(sawRelief).toBeGreaterThan(0);
  });

  it("stays inside its own bounds at every table size", () => {
    for (const seats of [2, 3, 4, 5, 6]) {
      for (let seed = 1; seed <= 6; seed++) {
        const room = playOut(seats, seed);
        expect(room.dread, `${seats}p seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(room.dread, `${seats}p seed ${seed}`).toBeLessThanOrEqual(
          dreadThresholds(seats).max
        );
      }
    }
  });
});
