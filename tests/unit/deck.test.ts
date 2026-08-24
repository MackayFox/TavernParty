import { describe, expect, it } from "vitest";
import { buildDeck, honoured, markedBy, worstUnseen } from "@/lib/game/deck";
import type { ApproachDef, Hook, Scene } from "@/lib/game/types";
import { rngFor } from "./helpers";

function approach(over: Partial<ApproachDef> = {}): ApproachDef {
  return {
    id: "a",
    label: "Try it",
    ability: "brawn",
    tn: 12,
    deed: 4,
    cost: { renown: 2, dread: 1 },
    reckless: false,
    win: "It works.",
    lose: "It does not.",
    ...over,
  };
}

function scene(id: string, tags: string[], recklessTn = 16): Scene {
  return {
    id,
    title: id,
    setup: "Something is in the way.",
    tags,
    approaches: [
      approach({ id: `${id}-1` }),
      approach({ id: `${id}-2`, ability: "wits" }),
      approach({ id: `${id}-3`, ability: "nerve", reckless: true, tn: recklessTn, deed: 8 }),
    ],
  };
}

function hook(id: string, insertTag: string, callTag = insertTag): Hook {
  return { id, name: id.toUpperCase(), blurb: "", insertTag, callTag };
}

const POOL: Scene[] = [
  scene("s1", ["debt", "crowd"]),
  scene("s2", ["patrol"]),
  scene("s3", ["dark", "lock"]),
  scene("s4", ["water"]),
  scene("s5", ["uncanny"], 18),
  scene("s6", ["beast", "cold"]),
  scene("s7", ["trade"]),
  scene("s8", ["corpse"]),
];

describe("dealing the deck", () => {
  it("deals exactly the number of Acts asked for", () => {
    const deck = buildDeck({ scenes: POOL, hooks: [], acts: 5 }, rngFor(1));
    expect(deck).toHaveLength(5);
    expect(new Set(deck).size).toBe(5);
  });

  /**
   * The promise the whole Hook design rests on. If this ever stops holding, a
   * background goes back to being a note on a sheet.
   */
  it("honours a Hook's Insert, so your past turns up in everybody's night", () => {
    const deck = buildDeck(
      { scenes: POOL, hooks: [hook("debtor", "debt")], acts: 5 },
      rngFor(7)
    );
    const tags = deck.flatMap((id) => POOL.find((s) => s.id === id)!.tags);
    expect(tags).toContain("debt");
  });

  it("honours several Inserts at once", () => {
    const hooks = [
      hook("debtor", "debt"),
      hook("deserter", "patrol"),
      hook("drowned", "water"),
      hook("grave", "corpse"),
    ];
    const deck = buildDeck({ scenes: POOL, hooks, acts: 5 }, rngFor(3));
    const tags = new Set(deck.flatMap((id) => POOL.find((s) => s.id === id)!.tags));
    for (const h of hooks) expect(tags.has(h.insertTag), h.insertTag).toBe(true);
  });

  it("places the rarest demand first, so a one-scene tag is not crowded out", () => {
    // Only s5 carries uncanny; five scenes carry the common tags.
    const common = [
      scene("c1", ["crowd"]),
      scene("c2", ["crowd"]),
      scene("c3", ["crowd"]),
      scene("c4", ["crowd"]),
      scene("c5", ["crowd"]),
    ];
    const pool = [...common, scene("rare", ["uncanny"])];
    for (let seed = 1; seed <= 12; seed++) {
      const deck = buildDeck(
        {
          scenes: pool,
          hooks: [hook("h1", "crowd"), hook("h2", "uncanny")],
          acts: 2,
        },
        rngFor(seed)
      );
      expect(deck, `seed ${seed}`).toContain("rare");
    }
  });

  it("does not spend two slots on a tag one scene already covers", () => {
    const deck = buildDeck(
      { scenes: POOL, hooks: [hook("a", "debt"), hook("b", "crowd")], acts: 2 },
      rngFor(5)
    );
    // s1 carries both, so a two-Act deck can satisfy both promises.
    expect(deck).toContain("s1");
  });

  it("repeats rather than ending the night early when the pool is small", () => {
    const deck = buildDeck({ scenes: [POOL[0], POOL[1]], hooks: [], acts: 5 }, rngFor(2));
    expect(deck).toHaveLength(5);
  });

  it("is reproducible from the same seed, so a daily can pin a night", () => {
    const a = buildDeck({ scenes: POOL, hooks: [hook("h", "debt")], acts: 5 }, rngFor(42));
    const b = buildDeck({ scenes: POOL, hooks: [hook("h", "debt")], acts: 5 }, rngFor(42));
    expect(a).toEqual(b);
  });

  it("reports which Inserts it actually managed to honour", () => {
    const hooks = [hook("debtor", "debt"), hook("nobody", "vermin")];
    const deck = ["s1", "s2"];
    expect(honoured(deck, POOL, hooks)).toEqual(["debt"]);
  });
});

describe("the Night turning", () => {
  it("picks the hardest scene nobody has faced yet", () => {
    const worst = worstUnseen(POOL, ["s1"]);
    // s5 has the highest reckless target number in the pool.
    expect(worst?.id).toBe("s5");
  });

  it("does not offer one the party has already survived", () => {
    expect(worstUnseen(POOL, ["s5"])?.id).not.toBe("s5");
  });

  it("copes when there is nothing left", () => {
    expect(worstUnseen(POOL, POOL.map((s) => s.id))).toBeUndefined();
  });
});

describe("the Mark", () => {
  it("names the players whose Hook this scene calls", () => {
    const players = [
      { id: "a", hookId: "debtor" },
      { id: "b", hookId: "deserter" },
      { id: "c", hookId: null },
    ];
    const hooks = [hook("debtor", "patrol", "debt"), hook("deserter", "debt", "patrol")];
    expect(markedBy(scene("x", ["debt"]), players, hooks)).toEqual(["a"]);
  });

  it("marks nobody when the scene touches no history", () => {
    const players = [{ id: "a", hookId: "debtor" }];
    const hooks = [hook("debtor", "debt")];
    expect(markedBy(scene("x", ["water"]), players, hooks)).toEqual([]);
  });
});
