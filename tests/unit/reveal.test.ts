/**
 * THE REVEAL'S BEATS.
 *
 * The Deep Run used to resolve a floor by appending a finished paragraph above the
 * room: everything at once, nothing moving, and on a phone the result landed off
 * the top of the screen so you pressed a door and the page sat where it was. The
 * outcome is an event now, and this is the list of beats that event walks through.
 *
 * Worth testing because the list is where the special cases live, and a wrong list
 * either shows the answer before the die (giving away the outcome) or waits on a
 * beat that will never arrive (leaving somebody looking at a spinner).
 */
import { describe, expect, it } from "vitest";
import { beatsFor, type RevealLine } from "@/components/daily/Reveal";

const line = (over: Partial<RevealLine> = {}): RevealLine => ({
  roomIndex: 0,
  title: "The Screech",
  label: "Set your feet and meet it",
  roll: 12,
  mods: [
    { label: "d20", value: 12 },
    { label: "brawn", value: 2 },
    { label: "trained for this", value: 2 },
  ],
  total: 16,
  tn: 12,
  cleared: true,
  outcome: "cleared",
  vigourSpent: 0,
  vigourAfter: 9,
  text: "It gives.",
  ...over,
});

describe("the beats of an outcome", () => {
  it("throws, counts each modifier on its own beat, then judges", () => {
    expect(beatsFor(line())).toEqual([
      "rolling",
      "die",
      "mod-0",
      "mod-1",
      "mod-2",
      "needed",
      "outcome",
      "prose",
    ]);
  });

  it("gives a brace no die and no sum, because it throws nothing", () => {
    // Not a special case bolted on: the same list with the middle missing. A brace
    // that waited for a die would wait forever.
    expect(beatsFor(line({ roll: 0, mods: [], tn: null }))).toEqual(["outcome", "prose"]);
  });

  it("skips the target when there is not one", () => {
    // A knack can clear a room without a roll against anything.
    const beats = beatsFor(line({ tn: null }));
    expect(beats).not.toContain("needed");
    expect(beats[beats.length - 2]).toBe("outcome");
  });

  it("always ends on the outcome and then the prose, never the other way round", () => {
    for (const over of [
      {},
      { roll: 0, mods: [], tn: null },
      { tn: null },
      { mods: [] },
      { cleared: false, vigourSpent: 3, vigourAfter: 6 },
    ]) {
      const beats = beatsFor(line(over));
      expect(beats[beats.length - 1]).toBe("prose");
      expect(beats[beats.length - 2]).toBe("outcome");
      // And the outcome is never revealed before the die that decided it.
      const die = beats.indexOf("die");
      if (die !== -1) expect(die).toBeLessThan(beats.indexOf("outcome"));
    }
  });

  it("has one beat per modifier, however many there are", () => {
    for (const n of [0, 1, 2, 5]) {
      const mods = Array.from({ length: n }, (_, i) => ({ label: `m${i}`, value: 1 }));
      const beats = beatsFor(line({ mods }));
      expect(beats.filter((b) => b.startsWith("mod-"))).toHaveLength(n);
    }
  });
});
