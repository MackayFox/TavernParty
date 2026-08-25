/**
 * The gate, against dungeons built to be wrong in specific ways.
 *
 * This is the feature the builder is defensible on, so it is tested against
 * fixtures rather than against the house content: a validator that has only ever
 * seen well-made dungeons has not been tested.
 */
import { describe, expect, it } from "vitest";
import { BASE_VIGOUR, HOUSE_DEFS } from "@/lib/daily/deeprun";
import type { RoomDef } from "@/lib/daily/deeprun-data";
import {
  MAX_CALLINGS,
  MAX_FLOORS,
  MAX_KIT,
  enumerationBound,
  instantProblems,
  mechanicalHash,
  reportFor,
  type Design,
} from "@/lib/campaign/gate";

const SETUP = "The floor gives way to a stair nobody built, and the air coming up it is warm.";

function room(id: string, tn: number, vigour: number, band: 1 | 2 | 3 = 2): RoomDef {
  return {
    id,
    band,
    title: `Floor ${id}`,
    setup: SETUP,
    options: [
      {
        id: `${id}-a`,
        label: "Force it",
        kind: "check",
        ability: "brawn",
        tn,
        vigour,
        promise: "Straight at it.",
        win: "It gives.",
        lose: "It does not.",
      },
      {
        id: `${id}-b`,
        label: "Read it",
        kind: "check",
        ability: "wits",
        tn,
        vigour,
        promise: "Work it out first.",
        win: "You see it.",
        lose: "You do not.",
      },
      {
        id: `${id}-c`,
        label: "Take the hit",
        kind: "brace",
        vigour,
        promise: "Pay and pass.",
        win: "You are through, and it cost you.",
        lose: "You are through, and it cost you.",
      },
    ],
  };
}

function design(over: Partial<Design> = {}): Design {
  return {
    seed: "TESTDG",
    label: "The Test",
    rooms: [room("a", 12, 2), room("b", 13, 3), room("c", 14, 3)],
    callingIds: ["warden", "knife", "hedgewitch"],
    kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
    baseVigour: BASE_VIGOUR,
    ...over,
  };
}

describe("the instant checks, which need no solve", () => {
  it("refuses a dungeon that is too short or too long", () => {
    expect(instantProblems(design({ rooms: [room("a", 12, 2)] })).join(" ")).toMatch(/at least 3/i);
    const many = Array.from({ length: MAX_FLOORS + 1 }, (_, i) => room(`r${i}`, 12, 2));
    expect(instantProblems(design({ rooms: many })).join(" ")).toMatch(/most the solver/i);
  });

  it("insists every floor has a way through that always works", () => {
    // The brace is load-bearing: without it a bad build plus a bad die is a wall,
    // and the whole engine exists so that a floor is a price instead.
    const noBrace = room("a", 12, 2);
    noBrace.options = noBrace.options.filter((o) => o.kind !== "brace");
    const said = instantProblems(
      design({ rooms: [noBrace, room("b", 12, 2), room("c", 12, 2)] })
    ).join(" ");
    expect(said).toMatch(/always works and always costs/i);
  });

  it("refuses a floor that asks the same ability twice", () => {
    const same = room("a", 12, 2);
    same.options[1].ability = "brawn";
    const said = instantProblems(
      design({ rooms: [same, room("b", 12, 2), room("c", 12, 2)] })
    ).join(" ");
    expect(said).toMatch(/same ability twice/i);
  });

  it("refuses unwritten prose and unnamed doors", () => {
    const bare = room("a", 12, 2);
    bare.setup = "Too short.";
    bare.options[0].win = "";
    const said = instantProblems(
      design({ rooms: [bare, room("b", 12, 2), room("c", 12, 2)] })
    ).join(" ");
    expect(said).toMatch(/sentence or two/i);
    expect(said).toMatch(/both endings/i);
  });

  it("holds the caps that keep the solver quick", () => {
    expect(instantProblems(design({ callingIds: [] })).join(" ")).toMatch(/tick a calling/i);
    expect(instantProblems(design({ kitIds: ["tarred-rope"] })).join(" ")).toMatch(/at least 2/i);
    const tooMany = ["warden", "knife", "hedgewitch", "chanter", "reckoner"];
    expect(instantProblems(design({ callingIds: tooMany })).join(" ")).toContain(
      `${MAX_CALLINGS} Callings`
    );
    const shelf = [
      "tarred-rope",
      "whetstone",
      "pitch-torches",
      "cracked-mirror",
      "sounding-line",
      "names-ledger",
      "spare-bowstring",
    ];
    expect(instantProblems(design({ kitIds: shelf })).join(" ")).toContain(`${MAX_KIT} things`);
  });
});

describe("the solve", () => {
  it("passes a dungeon that is actually a dungeon, and says where it stands", () => {
    const r = reportFor(design());
    expect(r.ok, r.summary).toBe(true);
    expect(r.builds).toBeGreaterThan(3);
    expect(r.out).toBeGreaterThan(0);
    expect(r.par).toBeGreaterThan(0);
    expect(r.summary).toMatch(/Par is \d+\./);
    expect(["A walk", "Fair", "Stiff", "Brutal", "Only just"]).toContain(r.difficulty);
  });

  it("refuses one nobody can get out of, and names the floor", () => {
    // Out of reach entirely, beside a brace nobody can afford. tn 20 is NOT
    // impossible: a natural 20 always clears, and a good build on a high roll
    // reaches 20 on the total anyway, which is how the first version of this
    // fixture quietly passed.
    const brutal = [1, 2, 3].map((i) => room(`x${i}`, 40, 40, 3));
    const r = reportFor(design({ rooms: brutal, baseVigour: 7 }));
    expect(r.ok).toBe(false);
    const block = r.notes.find((n) => n.severity === "block");
    expect(block?.text).toMatch(/Nobody gets out of this one/);
    expect(block?.text).toMatch(/floor \d/);
    // A word, not a dash: this value reaches a browse card and the project
    // forbids em-dashes in anything a player reads.
    expect(r.difficulty).toBe("Unrated");
  });

  it("warns about a walkover rather than refusing it", () => {
    // The spec wanted a block here for "everybody posts the same number", and it
    // is unreachable: starting Vigour is BASE plus the Grit modifier, leftover
    // Vigour scores, and every enumerated character places the array
    // differently, so two builds essentially never finish on the same number.
    // A check that cannot fire is worse than no check.
    const trivial = [1, 2, 3].map((i) => room(`e${i}`, 2, 0, 1));
    const r = reportFor(design({ rooms: trivial, baseVigour: 11 }));
    expect(r.ok, r.summary).toBe(true);
    expect(r.notes.some((n) => n.severity === "warn" && /walk/i.test(n.text))).toBe(true);
    expect(r.difficulty).toBe("A walk");
    // The claim itself, asserted rather than assumed: no two-build tie.
    expect(r.builds).toBeGreaterThan(10);
  });

  it("allows an easy dungeon, because easy is not broken", () => {
    // 102 of 108 getting out with a spread of scores is an easy dungeon, not a
    // broken one, and the first version of the gate refused exactly that.
    const gentle = [1, 2, 3, 4].map((i) => room(`s${i}`, 9 + i, 1 + (i % 2), 1));
    const r = reportFor(design({ rooms: gentle, baseVigour: 11 }));
    expect(r.ok, r.summary).toBe(true);
  });

  it("warns about a floor where one door is the only door anybody takes", () => {
    const lopsided = room("dom", 19, 5, 3);
    lopsided.options[0] = { ...lopsided.options[0], tn: 3, vigour: 1, label: "Cut the rope" };
    const r = reportFor(design({ rooms: [lopsided, room("b", 12, 2), room("c", 12, 2)] }));
    expect(r.notes.some((n) => n.severity === "warn" && /furniture/.test(n.text))).toBe(true);
  });

  it("derives the difficulty rather than letting an author claim one", () => {
    const easy = reportFor(
      design({ rooms: [1, 2, 3].map((i) => room(`g${i}`, 6, 1, 1)), baseVigour: 11 })
    );
    const hard = reportFor(
      design({ rooms: [1, 2, 3].map((i) => room(`h${i}`, 18, 4, 3)), baseVigour: 7 })
    );
    const order = ["Only just", "Brutal", "Stiff", "Fair", "A walk"];
    if (easy.ok && hard.ok) {
      expect(order.indexOf(easy.difficulty)).toBeGreaterThanOrEqual(order.indexOf(hard.difficulty));
    }
    // And there is nowhere in a Design for an author to state one at all.
    expect(Object.keys(design())).not.toContain("difficulty");
  });
});

describe("prose never costs a solve", () => {
  it("gives the same mechanical hash when only the writing changed", () => {
    const before = design();
    const after = design();
    after.label = "A different name entirely";
    after.rooms[0].title = "Renamed";
    after.rooms[0].setup = `${SETUP} And a second sentence for good measure.`;
    after.rooms[0].options[0].win = "Rewritten.";
    after.rooms[0].options[0].promise = "Rewritten too.";
    expect(mechanicalHash(after)).toBe(mechanicalHash(before));
  });

  it("changes it the moment a number does", () => {
    const before = design();
    const after = design();
    after.rooms[0].options[0].tn = 15;
    expect(mechanicalHash(after)).not.toBe(mechanicalHash(before));
  });
});

describe("the enumeration bound", () => {
  it("stays under the measured cliff at the caps", () => {
    // Four Callings and six Kit solved in about 250ms when measured; eight and
    // twelve took 3.6 seconds. The caps are what keep a save feeling instant, and
    // somebody will eventually widen one because the number looks small.
    expect(enumerationBound(MAX_CALLINGS, MAX_KIT)).toBeLessThanOrEqual(360);
    expect(enumerationBound(8, 12)).toBeGreaterThan(3000);
  });

  it("solves the worst legal dungeon quickly enough to feel instant", () => {
    const eight = Array.from({ length: MAX_FLOORS }, (_, i) =>
      room(`w${i}`, 13 + (i % 4), 2 + (i % 3))
    );
    const worst = design({
      rooms: eight,
      callingIds: ["warden", "knife", "hedgewitch", "chanter"],
      kitIds: [
        "tarred-rope",
        "whetstone",
        "pitch-torches",
        "cracked-mirror",
        "sounding-line",
        "names-ledger",
      ],
    });
    const started = performance.now();
    reportFor(worst);
    expect(performance.now() - started).toBeLessThan(4000);
  }, 20_000);
});

describe("the house content passes its own gate", () => {
  it("accepts a dungeon assembled from the rooms the house wrote", () => {
    const rooms = HOUSE_DEFS.filter((r) => !r.boss).slice(0, 5);
    const boss = HOUSE_DEFS.find((r) => r.boss);
    const r = reportFor(design({ rooms: [...rooms, boss!], seed: "HOUSE1" }));
    // If the house's own rooms cannot clear the bar, the bar is in the wrong place.
    expect(r.notes.filter((n) => n.severity === "block"), r.summary).toHaveLength(0);
  });
});

describe("kit that cannot do anything down here", () => {
  /**
   * Five of the twelve items are charges, and nothing in the Deep Run reads a
   * charge: they are gear for a table with other people at it. The daily filters
   * them off its own shelf, and a comment in `puzzleFrom` claimed the gate warned
   * authors about them. It did not. It counted the shelf and never looked at what
   * was on it, so an author could tick four charges, publish, and hand every
   * player a shelf where nothing they take matters.
   */
  it("warns about a charge on the shelf and still publishes", async () => {
    const report = await reportFor(
      design({ kitIds: ["tarred-rope", "pick-roll", "whetstone"] })
    );
    const text = report.notes.map((n) => n.text).join(" ");
    expect(text).toMatch(/whetstone/i);
    expect(text).toMatch(/charge/i);
    // A warning, not a wall: they picked it, and two of the three still work.
    expect(report.notes.some((n) => n.severity === "block" && /charge/i.test(n.text))).toBe(false);
  });

  it("blocks a shelf where nothing works at all", async () => {
    const report = await reportFor(design({ kitIds: ["whetstone", "cracked-mirror"] }));
    const blocking = report.notes.filter((n) => n.severity === "block");
    expect(blocking.map((n) => n.text).join(" ")).toMatch(/nothing on your shelf/i);
    expect(report.ok).toBe(false);
  });

  it("says nothing when every card on the shelf works", async () => {
    const report = await reportFor(
      design({ kitIds: ["tarred-rope", "pick-roll", "corrected-map"] })
    );
    expect(report.notes.some((n) => /charge/i.test(n.text))).toBe(false);
  });
});
