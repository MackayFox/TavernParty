/**
 * THE HOUSE'S OWN DUNGEON, held to the bar everybody else's is held to.
 *
 * It ships in the bundle and it is the first dungeon most people will ever open,
 * so it gets a test rather than a comment claiming it is fine. The first draft of
 * it was called "a walk" by the solver, with 198 of 240 characters strolling out
 * and three of six floors where every build took the same door. This is what
 * stops that shipping again.
 */
import { describe, expect, it } from "vitest";
import { reportFor } from "@/lib/campaign/gate";
import { dieFor, puzzleFrom, run } from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";
import {
  DEMO_BASE_VIGOUR,
  DEMO_CALLINGS,
  DEMO_CODE,
  DEMO_INTRO,
  DEMO_KIT,
  DEMO_ROOMS,
  DEMO_TITLE,
} from "@/lib/content/demo-dungeon";
import { targetsFor, wordForTarget, readingOf } from "@/lib/daily/targets";

const design = {
  seed: DEMO_CODE,
  label: DEMO_TITLE,
  rooms: DEMO_ROOMS,
  callingIds: DEMO_CALLINGS,
  kitIds: DEMO_KIT,
  baseVigour: DEMO_BASE_VIGOUR,
};

describe("The Stone Walk", () => {
  it("passes the gate it will be published through", () => {
    const report = reportFor(design);
    expect(report.notes.filter((n) => n.severity === "block")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("is neither a walk nor a wall", () => {
    const report = reportFor(design);
    const share = report.out / report.builds;
    // Between a fifth and two thirds getting out: a demo nobody finishes teaches
    // nothing, and one everybody finishes teaches less.
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.7);
    expect(["Fair", "Stiff"]).toContain(report.difficulty);
  });

  it("throws no dead dice, which is why this code was chosen", () => {
    const dice = DEMO_ROOMS.map((_, i) => dieFor(DEMO_CODE, i));
    // A 1 never opens anything and a 20 always does, so either makes a floor's
    // checks theatre. The code was picked before the numbers for this reason.
    expect(dice).not.toContain(1);
    expect(dice).not.toContain(20);
  });

  it("sets every ungated target against the die that floor will actually meet", () => {
    DEMO_ROOMS.forEach((room, i) => {
      const die = dieFor(DEMO_CODE, i);
      const live = targetsFor(die);
      for (const o of room.options) {
        if (o.kind !== "check" || o.tn === undefined) continue;
        /**
         * A GATED door is allowed to be a gift, and that is the point of it.
         *
         * The mark IS the price: you paid two Vigour on floor one for the lantern,
         * so the lantern door on floor three being trivial against a 17 is the
         * return on that, not a mistake. Only the doors anybody can walk up to
         * have to sit in the band that means anything on this floor's die.
         */
        if ((o.needs ?? []).length > 0 || (o.forbids ?? []).length > 0) continue;
        expect(o.tn).toBeGreaterThanOrEqual(live.easy - 3);
        expect(o.tn).toBeLessThanOrEqual(live.hard + 3);
      }
    });
  });

  it("teaches all three halves of the Marks mechanic", () => {
    const all = DEMO_ROOMS.flatMap((r) => r.options);
    expect(all.some((o) => (o.sets ?? []).length > 0)).toBe(true);
    expect(all.some((o) => (o.needs ?? []).length > 0)).toBe(true);
    // The half authors forget exists.
    expect(all.some((o) => (o.forbids ?? []).length > 0)).toBe(true);
  });

  it("leaves a way through every floor for somebody carrying nothing", () => {
    for (const room of DEMO_ROOMS) {
      const open = room.options.filter(
        (o) => o.kind === "brace" && !o.needs?.length && !o.forbids?.length
      );
      expect(open.length).toBeGreaterThan(0);
    }
  });

  it("keeps a dry line open, or the bridge is a door nobody can use", () => {
    // Every option on the water floor used to leave you wet, which quietly made
    // the one `forbids` door in the dungeon unreachable by anybody. The gate
    // cannot catch that: a door nobody opens is not a door nobody CAN open.
    const water = DEMO_ROOMS[1];
    expect(water.options.some((o) => !(o.sets ?? []).includes("wet"))).toBe(true);
  });

  it("has a par somebody can actually score", () => {
    const puzzle = puzzleFrom(design);
    const { par, best } = parFor(puzzle);
    expect(best).toBeTruthy();
    const played = run(puzzle, best!.build, best!.steps, DEMO_ROOMS);
    expect(played.score).toBe(par);
    expect(played.out).toBe(true);
  });

  it("says something before you go down", () => {
    expect(DEMO_INTRO.length).toBeGreaterThan(80);
    expect(DEMO_ROOMS).toHaveLength(6);
    expect(DEMO_ROOMS[DEMO_ROOMS.length - 1].boss).toBe(true);
    // No em-dashes in player-facing copy, anywhere.
    const prose = [DEMO_INTRO, ...DEMO_ROOMS.flatMap((r) => [r.setup, ...r.options.flatMap((o) => [o.promise, o.win, o.lose])])];
    expect(prose.some((t) => t.includes("\u2014"))).toBe(false);
  });
});

describe("targets against a die", () => {
  it("moves with the die, because that is the only thing hard can mean here", () => {
    expect(targetsFor(2).easy).toBeLessThan(targetsFor(14).easy);
    expect(targetsFor(9).hard).toBeGreaterThan(targetsFor(9).easy);
  });

  it("stays inside what the wire will carry", () => {
    for (let die = 1; die <= 20; die++) {
      const t = targetsFor(die);
      for (const n of [t.easy, t.fair, t.hard]) {
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(20);
      }
    }
  });

  it("round-trips a word through a number and back", () => {
    for (let die = 2; die <= 12; die++) {
      const t = targetsFor(die);
      expect(wordForTarget(die, t.easy)).toBe("easy");
      expect(wordForTarget(die, t.fair)).toBe("fair");
      expect(wordForTarget(die, t.hard)).toBe("hard");
    }
  });

  it("says plainly when a floor cannot be a test at all", () => {
    expect(readingOf(1)).toMatch(/never opens anything/);
    expect(readingOf(20)).toMatch(/always opens/);
    expect(readingOf(11)).toMatch(/real decision/);
  });
});
