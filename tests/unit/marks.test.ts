/**
 * MARKS: what you are carrying, and what it opens or shuts further down.
 *
 * The only mechanic where floor two changes floor five, and therefore the only
 * one that can go wrong in a way nobody notices until somebody publishes a
 * dungeon with a dead end in it. Four properties carry it:
 *
 *   1. THE RUNNER AND THE SOLVER AGREE ON WHICH DOORS ARE OPEN. If they ever
 *      disagree, a player is either offered a door the solver never priced, or
 *      scored against a par they could not have reached.
 *   2. YOU ONLY COME AWAY FROM A DOOR THAT WORKED. Otherwise "carrying the lamp"
 *      does not mean you got the lamp.
 *   3. PAR STAYS A TABLE. The state widened by one term; it must not have
 *      widened into a tree.
 *   4. THE GATE CATCHES A DEAD END. A door wanting something nothing above it
 *      hands out is content nobody will ever see, and the author cannot spot it
 *      by looking at either floor.
 */
import { describe, expect, it } from "vitest";
import {
  marksRead,
  openTo,
  puzzleFrom,
  run,
  type Build,
  type Design,
} from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";
import { instantProblems, markProblems, reportFor, MAX_MARKS_READ } from "@/lib/campaign/gate";
import type { OptionDef, RoomDef } from "@/lib/daily/deeprun-data";

const SETUP = "The floor gives way to a stair nobody built, and the air coming up it is warm.";

function door(id: string, over: Partial<OptionDef> = {}): OptionDef {
  return {
    id,
    label: `Door ${id}`,
    kind: "check",
    ability: "brawn",
    tn: 10,
    vigour: 2,
    promise: "Straight at it.",
    win: "It gives.",
    lose: "It does not.",
    ...over,
  };
}

/** A floor with two checks on different abilities and one ungated brace. */
function floor(id: string, doors: Partial<OptionDef>[] = []): RoomDef {
  return {
    id,
    band: 2,
    title: `Floor ${id}`,
    setup: SETUP,
    options: [
      door(`${id}-a`, doors[0] ?? {}),
      door(`${id}-b`, { ability: "wits", ...(doors[1] ?? {}) }),
      door(`${id}-c`, { kind: "brace", ability: undefined, tn: undefined, vigour: 2, ...(doors[2] ?? {}) }),
    ],
  };
}

const design = (rooms: RoomDef[]): Design => ({
  seed: "MARKS1",
  label: "The Marks Test",
  rooms,
  callingIds: ["warden", "knife", "hedgewitch"],
  kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
  baseVigour: 9,
});

const buildFor = (p: ReturnType<typeof puzzleFrom>): Build => ({
  callingId: p.callings[0].id,
  placement: p.array.map((_, i) => i),
  kitIds: [p.kit[0].id, p.kit[1].id],
});

describe("openTo", () => {
  it("lets an ungated door through", () => {
    expect(openTo({}, new Set())).toBe(true);
    expect(openTo({ needs: [], forbids: [] }, new Set(["wet"]))).toBe(true);
  });

  it("wants ALL of what it needs, not any", () => {
    const d = { needs: ["lamp", "rope"] };
    expect(openTo(d, new Set(["lamp"]))).toBe(false);
    expect(openTo(d, new Set(["lamp", "rope"]))).toBe(true);
  });

  it("refuses on ANY of what it forbids, not all", () => {
    const d = { forbids: ["seen", "wet"] };
    expect(openTo(d, new Set(["wet"]))).toBe(false);
    expect(openTo(d, new Set(["dry"]))).toBe(true);
  });

  it("never opens a door that both wants and refuses the same mark", () => {
    const d = { needs: ["wet"], forbids: ["wet"] };
    expect(openTo(d, new Set())).toBe(false);
    expect(openTo(d, new Set(["wet"]))).toBe(false);
  });
});

describe("marksRead", () => {
  it("counts what doors test and ignores what they hand out", () => {
    const read = marksRead([
      floor("one", [{ sets: ["wet"] }]),
      floor("two", [{ needs: ["wet"] }, { forbids: ["seen"] }]),
    ]);
    // "wet" is tested, "seen" is tested, and nothing reads a mark that is only
    // ever set: flavour cannot branch a search.
    expect([...read].sort()).toEqual(["seen", "wet"]);
  });
});

describe("the runner", () => {
  it("leaves a mark on you only when the door worked", () => {
    /**
     * The brace is the door that worked and the 20 is the door that did not, and
     * neither depends on the dice. An earlier version of this test used a target
     * of 2 for the success case, which this seed's first floor fails anyway
     * because a 1 never opens anything: a fixture standing on a die is a fixture
     * that describes one dungeon rather than the rule.
     */
    const rooms = [
      floor("one", [{ tn: 20, sets: ["dry"] }, {}, { sets: ["wet"] }]),
      floor("two"),
      floor("three"),
    ];
    const p = puzzleFrom(design(rooms));
    const b = buildFor(p);

    const worked = run(p, b, [{ optionId: "one-c" }], rooms);
    expect(worked.lines[0].cleared).toBe(true);
    expect(worked.lines[0].gained).toEqual(["wet"]);
    expect(worked.lines[0].marks).toEqual(["wet"]);

    const failed = run(p, b, [{ optionId: "one-a" }], rooms);
    expect(failed.lines[0].cleared).toBe(false);
    expect(failed.lines[0].gained).toEqual([]);
    expect(failed.lines[0].marks).toEqual([]);
  });

  it("stops the run at a door that is shut, rather than throwing", () => {
    const rooms = [floor("one"), floor("two", [{ needs: ["lamp"] }]), floor("three")];
    const p = puzzleFrom(design(rooms));
    const result = run(p, buildFor(p), [{ optionId: "one-c" }, { optionId: "two-a" }], rooms);
    // One floor resolved, and then it stops: exactly what walking away looks
    // like. `run` is total and never throws, which is the contract that lets the
    // route hand it anything a client posts.
    expect(result.lines).toHaveLength(1);
    expect(result.depth).toBe(1);
    expect(result.out).toBe(false);
  });

  it("opens the door once the mark is in hand", () => {
    // Braces throughout: this is a test about a door being open, not about dice.
    const rooms = [
      floor("one", [{}, {}, { sets: ["lamp"] }]),
      floor("two", [{}, {}, { needs: ["lamp"] }]),
      floor("three"),
    ];
    const p = puzzleFrom(design(rooms));
    const result = run(
      p,
      buildFor(p),
      [{ optionId: "one-c" }, { optionId: "two-c" }, { optionId: "three-c" }],
      rooms
    );
    expect(result.lines).toHaveLength(3);
    expect(result.out).toBe(true);
    expect(result.lines[2].marks).toEqual(["lamp"]);
  });

  it("carries a mark all the way down once held", () => {
    const rooms = [floor("one", [{}, {}, { sets: ["wet"] }]), floor("two"), floor("three")];
    const p = puzzleFrom(design(rooms));
    const result = run(
      p,
      buildFor(p),
      [{ optionId: "one-c" }, { optionId: "two-c" }, { optionId: "three-c" }],
      rooms
    );
    expect(result.lines.map((l) => l.marks)).toEqual([["wet"], ["wet"], ["wet"]]);
  });
});

describe("the solver", () => {
  it("never proposes a line through a door that is shut", () => {
    // Floor two's cheap doors are locked behind a lamp nothing hands out, so par
    // has to come through the brace. If the solver ignored the gate it would
    // "clear" floor two for nothing and post an impossible par.
    const rooms = [
      floor("one"),
      floor("two", [
        { tn: 2, needs: ["lamp"] },
        { tn: 2, needs: ["lamp"] },
      ]),
      floor("three"),
    ];
    const p = puzzleFrom(design(rooms));
    const { best } = parFor(p);
    const chosen = best?.steps[1]?.optionId;
    expect(chosen).toBe("two-c");
  });

  it("prices the line that goes and gets the lamp first", () => {
    // Floor one's door A is expensive and hands out the lamp; floor two's cheap
    // door needs it. The whole point of the mechanic is that the solver sees the
    // trade across two floors, which a per-floor search cannot.
    const withLamp = design([
      floor("one", [{ tn: 2, vigour: 4, sets: ["lamp"] }]),
      floor("two", [{ tn: 2, needs: ["lamp"] }], ),
      floor("three"),
    ]);
    const withLampRooms = withLamp.rooms;
    const par = parFor(puzzleFrom(withLamp)).par;
    const line = parFor(puzzleFrom(withLamp)).best;
    expect(line?.steps[0].optionId).toBe("one-a");
    // And the line it found actually plays, which is the property that matters:
    // par is only meaningful if somebody can score it.
    const p = puzzleFrom(withLamp);
    const played = run(p, line!.build, line!.steps, withLampRooms);
    expect(played.score).toBe(par);
  });

  it("does not share a par between two dungeons that differ only in their marks", () => {
    // Same code, same rooms, same numbers: one gated, one not. The cache is keyed
    // on the mechanical shape, and a mark is mechanical.
    const open = design([floor("one"), floor("two"), floor("three")]);
    const shut = design([
      floor("one"),
      floor("two", [{ needs: ["lamp"] }, { needs: ["lamp"] }]),
      floor("three"),
    ]);
    expect(parFor(puzzleFrom(open)).par).toBeGreaterThan(parFor(puzzleFrom(shut)).par);
  });

  it("stays a table: the worst legal dungeon still solves quickly", () => {
    // Eight floors and the most marks the gate allows, which is the shape that
    // would show a search that had turned into a tree. The cap exists for exactly
    // this measurement, so the measurement gets a test.
    const marks = ["wet", "seen", "lamp", "cold"];
    const rooms = Array.from({ length: 8 }, (_, i) =>
      floor(`f${i}`, [
        { tn: 12, sets: [marks[i % 4]] },
        { tn: 12, needs: [marks[(i + 1) % 4]], forbids: [marks[(i + 2) % 4]] },
      ])
    );
    const heavy: Design = {
      ...design(rooms),
      seed: "HEAVY",
      callingIds: ["warden", "knife", "hedgewitch", "oathbound"],
      kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror", "salt-pouch", "iron-nail"],
    };
    const started = Date.now();
    const { par } = parFor(puzzleFrom(heavy));
    const ms = Date.now() - started;
    expect(par).toBeGreaterThan(0);
    // Generous by a factor of about eight against the measured number, because a
    // CI box is not this machine. It is here to catch an order of magnitude, not
    // a wobble.
    expect(ms).toBeLessThan(8000);
  });
});

describe("the gate", () => {
  it("refuses a floor where every way through that always works is gated", () => {
    // The rule the whole mechanic hangs off: somebody arriving with nothing must
    // never meet a floor with no price, only a wall.
    const bad = instantProblems(
      design([floor("one"), floor("two", [{}, {}, { needs: ["lamp"] }]), floor("three")])
    );
    expect(bad.some((b) => /always works is behind a mark/.test(b))).toBe(true);
  });

  it("allows a gated CHECK, which is the whole point of the feature", () => {
    const fine = instantProblems(
      design([floor("one", [{ sets: ["lamp"] }]), floor("two", [{ needs: ["lamp"] }]), floor("three")])
    );
    expect(fine.filter((b) => /mark/.test(b))).toEqual([]);
  });

  it("names a door that wants something nothing above it hands out", () => {
    const bad = markProblems([floor("one"), floor("two", [{ needs: ["lamp"] }]), floor("three")]);
    expect(bad.some((b) => /Floor 2.*wants "lamp".*Nobody will ever open it/.test(b))).toBe(true);
  });

  it("counts only what is above, so a mark handed out later does not rescue it", () => {
    const bad = markProblems([
      floor("one", [{ needs: ["lamp"] }]),
      floor("two", [{ sets: ["lamp"] }]),
      floor("three"),
    ]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/Floor 1/);
  });

  it("refuses a door that wants and refuses the same mark", () => {
    const bad = instantProblems(
      design([floor("one", [{ needs: ["wet"], forbids: ["wet"] }]), floor("two"), floor("three")])
    );
    expect(bad.some((b) => /will never open/.test(b))).toBe(true);
  });

  it("caps how many marks a dungeon may test, because each one doubles the table", () => {
    const many = ["a", "b", "c", "d", "e", "f"];
    const rooms = [
      floor("one", [{ sets: many }, { sets: many }]),
      floor("two", [{ needs: [many[0]] }, { forbids: [many[1]] }]),
      floor("three", [{ needs: [many[2]] }, { forbids: [many[3]] }]),
    ];
    // Two more than the cap, spread over four doors.
    rooms[1].options[0].needs = [many[0], many[4]];
    rooms[2].options[0].needs = [many[2], many[5]];
    const bad = markProblems(rooms);
    expect(bad.some((b) => b.includes(`${MAX_MARKS_READ} is the most`))).toBe(true);
  });

  it("warns about a mark handed out that nothing ever asks for", () => {
    // Legal, free, and nearly always one word spelled two ways.
    // Both spellings handed out on floor one, so nothing BLOCKS and the report
    // gets as far as its warnings. Only "wet" is ever asked for.
    const report = reportFor(
      design([
        floor("one", [{ sets: ["wett"] }, { sets: ["wet"] }]),
        floor("two", [{ needs: ["wet"] }]),
        floor("three"),
      ])
    );
    const text = JSON.stringify(report.notes);
    expect(text).toMatch(/handed out and never asked for/);
  });
});
