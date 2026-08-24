import { describe, expect, it } from "vitest";
import { costMultiplier, flinch, ledgerFor, rollApproach, sumLedger } from "@/lib/game/resolve";
import {
  AFFINITY_BONUS,
  DREAD_DOUBLE_AT,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKEN_VALUE,
  MARK_FLINCH_PENALTY,
} from "@/lib/game/rules";
import type { ApproachDef, Calling, KitItem, Scene } from "@/lib/game/types";
import { dieShowing, makePlayer } from "./helpers";

const APPROACH: ApproachDef = {
  id: "force",
  label: "Force the door",
  ability: "brawn",
  tn: 14,
  deed: 5,
  cost: { renown: 2, dread: 1 },
  reckless: false,
  win: "The frame gives before your shoulder does.",
  lose: "Something in your shoulder goes, and the door does not.",
};

const SCENE: Scene = {
  id: "a01",
  title: "The barred cellar",
  setup: "The only way down is through a door somebody nailed shut from the inside.",
  tags: ["dark", "lock"],
  approaches: [APPROACH, APPROACH, APPROACH],
};

const WARDEN: Calling = {
  id: "warden",
  name: "WARDEN",
  blurb: "You stand where the door is.",
  affinities: ["brawn", "grit"],
  signature: { kind: "shieldParty", label: "Hold the line" },
  failing: { tag: "uncanny", text: "You cannot put your shoulder into a rumour." },
};

const ROPE: KitItem = {
  id: "rope",
  name: "Tarred rope",
  blurb: "Forty feet, stiff with pitch.",
  bonus: { ability: "brawn", value: 1 },
  charge: null,
};

function ctx(over: Partial<Parameters<typeof rollApproach>[0]> = {}) {
  return {
    player: makePlayer(),
    calling: WARDEN,
    kit: [ROPE],
    scene: SCENE,
    approach: APPROACH,
    spendTokens: 0,
    dread: 0,
    hookCalled: false,
    ...over,
  };
}

describe("the ledger", () => {
  /**
   * The ledger is the narration budget. If it ever collapses to a bare total the
   * game stops reading like prose, so this asserts the parts, not the sum.
   */
  it("names every contribution rather than reporting a total", () => {
    const mods = ledgerFor(ctx(), 11);
    expect(mods[0]).toEqual({ label: "d20", value: 11 });
    const labels = mods.map((m) => m.label);
    expect(labels).toContain("Brawn");
    expect(labels.some((l) => l.startsWith("trained"))).toBe(true);
    expect(labels).toContain("tarred rope");
    for (const m of mods) expect(typeof m.label).toBe("string");
  });

  it("adds the affinity only for an ability the Calling is trained in", () => {
    const trained = ledgerFor(ctx(), 10);
    const untrained = ledgerFor(
      ctx({ approach: { ...APPROACH, ability: "charm" }, kit: [] }),
      10
    );
    expect(sumLedger(trained) - 10 - 1 - 1).toBe(AFFINITY_BONUS);
    expect(untrained.some((m) => m.label.startsWith("trained"))).toBe(false);
  });

  it("counts spent Hook tokens, and never more than are held", () => {
    const one = ledgerFor(ctx({ spendTokens: 1 }), 10);
    expect(one.find((m) => m.value === HOOK_TOKEN_VALUE)).toBeDefined();

    const greedy = ledgerFor(
      ctx({ player: makePlayer({ hookTokens: 1 }), spendTokens: 5 }),
      10
    );
    const spent = greedy.find((m) => m.label.startsWith("you have done"));
    expect(spent?.value).toBe(HOOK_TOKEN_VALUE);
  });

  it("leaves a zero modifier out rather than printing +0", () => {
    const mods = ledgerFor(
      ctx({ player: makePlayer({ scores: { ...makePlayer().scores!, brawn: 10 } }) }),
      10
    );
    expect(mods.some((m) => m.label === "Brawn")).toBe(false);
  });
});

describe("rolling", () => {
  it("succeeds when the ledger clears the target", () => {
    const out = rollApproach(ctx(), 0, dieShowing(15));
    expect(out.roll).toBe(15);
    expect(out.success).toBe(true);
    expect(out.renownDelta).toBe(APPROACH.deed);
    expect(out.scar).toBeNull();
  });

  it("fails and leaves a Scar when it does not", () => {
    const out = rollApproach(ctx(), 0, dieShowing(3));
    expect(out.success).toBe(false);
    expect(out.scar).not.toBeNull();
    expect(out.scar?.kept).toBeNull();
    expect(out.renownDelta).toBeLessThan(0);
  });

  it("lets a natural twenty succeed no matter what the sum says", () => {
    const impossible = ctx({ approach: { ...APPROACH, tn: 99 } });
    expect(rollApproach(impossible, 0, dieShowing(20)).success).toBe(true);
  });

  it("lets a natural one fail no matter what the sum says", () => {
    const trivial = ctx({ approach: { ...APPROACH, tn: 2 }, spendTokens: 2 });
    expect(rollApproach(trivial, 0, dieShowing(1)).success).toBe(false);
  });
});

describe("what failing costs", () => {
  it("charges the plain cost on a clean night", () => {
    expect(costMultiplier({ calling: WARDEN, scene: SCENE, dread: 0 })).toBe(1);
  });

  /**
   * Both multipliers are on the consequence side, never on the roll. Being told
   * the situation is worse feels different to being told you are worse at it,
   * and it is the same arithmetic.
   */
  it("doubles it on a scene that carries your Failing", () => {
    const cursed: Scene = { ...SCENE, tags: ["uncanny"] };
    expect(costMultiplier({ calling: WARDEN, scene: cursed, dread: 0 })).toBe(2);
  });

  it("doubles it for everybody once Dread passes the threshold", () => {
    expect(costMultiplier({ calling: WARDEN, scene: SCENE, dread: DREAD_DOUBLE_AT })).toBe(2);
  });

  it("stacks the two, because that is the night going badly", () => {
    const cursed: Scene = { ...SCENE, tags: ["uncanny"] };
    expect(costMultiplier({ calling: WARDEN, scene: cursed, dread: DREAD_DOUBLE_AT })).toBe(4);
  });

  it("applies the multiplier to a real roll", () => {
    const cursed = ctx({ scene: { ...SCENE, tags: ["uncanny"] } });
    const out = rollApproach(cursed, 0, dieShowing(2));
    expect(out.renownDelta).toBe(-APPROACH.cost.renown * 2);
    expect(out.dreadDelta).toBe(APPROACH.cost.dread * 2);
  });
});

describe("flinching", () => {
  const penalties = {
    renown: FLINCH_RENOWN,
    dread: FLINCH_DREAD,
    markPenalty: MARK_FLINCH_PENALTY,
  };

  /**
   * The whole answer to a closed tab. Not a skip and not a bot: a real move that
   * scores badly and taxes the party, so an absent player is a problem the table
   * can see rather than a phase that hangs.
   */
  it("is a real move that costs Renown and raises Dread", () => {
    const out = flinch(makePlayer(), SCENE, false, penalties);
    expect(out.approachId).toBe("flinch");
    expect(out.renownDelta).toBe(FLINCH_RENOWN);
    expect(out.dreadDelta).toBe(FLINCH_DREAD);
    expect(out.success).toBe(false);
  });

  it("costs more when you were the one who was Marked for it", () => {
    const plain = flinch(makePlayer(), SCENE, false, penalties);
    const marked = flinch(makePlayer(), SCENE, true, penalties);
    expect(marked.renownDelta).toBeLessThan(plain.renownDelta);
  });

  it("leaves no Scar, because nothing happened to you", () => {
    expect(flinch(makePlayer(), SCENE, true, penalties).scar).toBeNull();
  });
});
