/**
 * All eight Blood powers, each one proved to actually fire.
 *
 * This file exists because six of the eight were printed on the character sheet
 * and wired to nothing. A decorative ability is worse than no ability: the player
 * reads it, drafts for it, and never finds out it was never there.
 */
import { describe, expect, it } from "vitest";
import { BLOODS } from "@/lib/content/bloods";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import * as engine from "@/lib/game/engine";
import { ASHKIN_DREAD, EMBERKIN_RENOWN, HOOK_TOKENS_MAX, KEPT_SCAR_VALUE } from "@/lib/game/rules";
import { standingsFor } from "@/lib/game/scoring";
import type { Room } from "@/lib/game/types";
import { fixedRng, rngFor } from "./helpers";

const NOW = 1_000_000;

/**
 * Sit two people down, deal them the Bloods this test cares about, and stop at
 * the first Act. Bloods are dealt inside `startRun`, so they are overwritten
 * after it rather than fought with.
 */
function atFirstAct(bloods: Record<string, string>, seed = 3): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public" },
    NOW
  );
  engine.join(room, { id: "p0", name: "ALEX" }, NOW);
  engine.join(room, { id: "p1", name: "BEV" }, NOW);
  engine.startRun(room, "p0", NOW, rngFor(seed));
  for (const [id, bloodId] of Object.entries(bloods)) {
    engine.findPlayer(room, id)!.bloodId = bloodId;
  }

  const rng = rngFor(seed);
  let now = NOW;
  for (let i = 0; i < 40 && room.phase !== "ACT"; i++) {
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }
  if (room.phase !== "ACT") throw new Error(`stuck in ${room.phase}`);
  return room;
}

/** Let the Act deadline pass, with a die you control. */
function resolveWith(room: Room, rng: ReturnType<typeof fixedRng>): number {
  const now = (room.phaseEndsAt ?? NOW) + 1;
  engine.tick(room, now, rng);
  return now;
}

const FACE_1 = 0.001;
const FACE_20 = 0.999;

describe("Hillfolk: the reroll on a fumble", () => {
  it("throws the die again on the first one of the run, and keeps the second", () => {
    const room = atFirstAct({ p0: "hillfolk" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);

    // p0 rolls first: a one, then the reroll. p1 gets what is left.
    resolveWith(room, fixedRng([FACE_1, FACE_20, FACE_20]));

    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.roll).toBe(20);
    expect(engine.findPlayer(room, "p0")!.usedBloodPower).toBe(true);
    // The ledger says why, and says it without changing the sum.
    expect(out.mods.map((m) => m.label)).toContain(
      "you have been wrong about your footing before"
    );
    expect(out.mods.reduce((t, m) => t + m.value, 0)).toBe(out.total);
  });

  it("leaves the fumble alone for anybody else, and only fires once", () => {
    const room = atFirstAct({ p0: "gravewise" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    resolveWith(room, fixedRng([FACE_1]));
    expect(room.act!.outcomes!.find((o) => o.playerId === "p0")!.roll).toBe(1);
  });
});

describe("Longshank: the free look", () => {
  it("reads the Reckless number without a Torch, once", () => {
    const room = atFirstAct({ p0: "longshank" });
    const p = engine.findPlayer(room, "p0")!;
    p.torches = 0; // Nothing to burn, and it still works.
    engine.revealReckless(room, "p0", NOW + 1);
    expect(room.act!.revealed).toContain("p0");
    expect(p.torches).toBe(0);
    expect(p.usedBloodPower).toBe(true);
  });

  it("charges a Torch for anybody else, and refuses when there is none", () => {
    const room = atFirstAct({ p0: "hillfolk" });
    const p = engine.findPlayer(room, "p0")!;
    // Explicitly empty: since `reveal` Kit charges started landing in the same
    // pocket as `torch` ones, whether the deal left them anything to burn
    // depends on which item they drew.
    p.torches = 0;
    expect(() => engine.revealReckless(room, "p0", NOW + 1)).toThrow(/burn/i);
    p.torches = 1;
    engine.revealReckless(room, "p0", NOW + 1);
    expect(p.torches).toBe(0);
  });
});

describe("Tideborn: the extra token", () => {
  it("starts the run one token up", () => {
    const room = atFirstAct({ p0: "tideborn" });
    expect(engine.findPlayer(room, "p0")!.hookTokens).toBe(HOOK_TOKENS_MAX + 1);
    expect(engine.findPlayer(room, "p1")!.hookTokens).toBe(HOOK_TOKENS_MAX);
  });
});

describe("Fenborn: moving a number after the fact", () => {
  it("swaps two of your own scores and nothing else", () => {
    const room = atFirstAct({ p0: "fenborn" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(room.phase).toBe("ACT_RESULT");

    const p = engine.findPlayer(room, "p0")!;
    const before = { ...p.scores! };
    engine.useBloodPower(room, "p0", { swap: ["brawn", "wits"] }, now);
    expect(p.scores!.brawn).toBe(before.wits);
    expect(p.scores!.wits).toBe(before.brawn);
    // The house array survives: same six numbers, rearranged.
    expect(Object.values(p.scores!).sort()).toEqual(Object.values(before).sort());
    expect(p.usedBloodPower).toBe(true);
  });

  it("refuses the same ability twice, a missing pair, and a second use", () => {
    const room = atFirstAct({ p0: "fenborn" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_20]));

    expect(() => engine.useBloodPower(room, "p0", { swap: ["grit", "grit"] }, now)).toThrow(
      /same number/i
    );
    expect(() => engine.useBloodPower(room, "p0", {}, now)).toThrow(/two numbers/i);
    engine.useBloodPower(room, "p0", { swap: ["grit", "charm"] }, now);
    expect(() => engine.useBloodPower(room, "p0", { swap: ["grit", "charm"] }, now)).toThrow(
      /already/i
    );
  });
});

describe("Ashkin: the cost moves rather than going away", () => {
  it("refunds exactly what the failure took, and taxes the party for it", () => {
    const room = atFirstAct({ p0: "ashkin" });
    const p = engine.findPlayer(room, "p0")!;
    p.renown = 40; // Enough that the clamp at zero is not in play.
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));

    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.success).toBe(false);
    const lost = -out.renownDelta;
    expect(lost).toBeGreaterThan(0);
    const renownAfterAct = p.renown;
    const dreadBefore = room.dread;

    engine.useBloodPower(room, "p0", {}, now);
    expect(p.renown).toBe(renownAfterAct + lost);
    expect(room.dread).toBe(dreadBefore + ASHKIN_DREAD);
    // The ledger now says the Act cost them nothing, which is the truth.
    expect(out.renownDelta).toBe(0);
  });

  it("refuses when the Act cost nothing", () => {
    const room = atFirstAct({ p0: "ashkin" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useBloodPower(room, "p0", {}, now)).toThrow(/cost you/i);
  });
});

describe("Emberkin: the hand already out", () => {
  it("gives the party back exactly this result's Dread, and takes a small cut", () => {
    const room = atFirstAct({ p0: "emberkin" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    // Twenty-five of the sixty safe doors cost the party nothing when you fail
    // them, so the shield needs a door that actually puts something on the
    // table. Every Reckless line does; some safe ones do.
    const costly = [...scene.approaches].sort((a, b) => b.cost.dread - a.cost.dread)[0];
    expect(costly.cost.dread).toBeGreaterThan(0);
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", costly.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));

    const p = engine.findPlayer(room, "p0")!;
    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    const added = out.dreadDelta;
    expect(added).toBeGreaterThan(0);
    const dread = room.dread;
    const renown = p.renown;

    engine.useBloodPower(room, "p0", {}, now);
    expect(room.dread).toBe(dread - added);
    // Not pure charity. Nobody drafts pure charity in a game one person wins.
    expect(p.renown).toBe(renown + EMBERKIN_RENOWN);
  });

  it("refuses when this Act put nothing on the party", () => {
    const room = atFirstAct({ p0: "emberkin" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const costly = [...scene.approaches].sort((a, b) => b.cost.dread - a.cost.dread)[0];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", costly.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    // Succeeded, so nothing landed on the party whatever the door cost.
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useBloodPower(room, "p0", {}, now)).toThrow(/party/i);
  });
});

describe("Thornborn and Gravewise: the Scar decisions", () => {
  function withScar(bloodId: string) {
    const room = atFirstAct({ p0: bloodId });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const p = engine.findPlayer(room, "p0")!;
    return { room, p, now, scar: p.scars[0] };
  }

  it("Thornborn wears it and the table pays nothing", () => {
    const { room, p, now, scar } = withScar("thornborn");
    const dread = room.dread;
    engine.decideScar(room, "p0", scar.id, true, now);
    expect(room.dread).toBe(dread);
    expect(scar.free).toBe(true);
    expect(p.usedBloodPower).toBe(true);
  });

  it("Thornborn's free Scar still pays when they are under the median", () => {
    const { room, p, now, scar } = withScar("thornborn");
    engine.decideScar(room, "p0", scar.id, true, now);
    // Put them well below the other player, so the median gate is closed.
    p.renown = 0;
    engine.findPlayer(room, "p1")!.renown = 50;
    const mine = standingsFor(room.players).find((s) => s.playerId === "p0")!;
    expect(mine.keptScars).toBe(1);
    expect(mine.total).toBe(KEPT_SCAR_VALUE);
    expect(mine.scarsPaid).toBe(1);
  });

  it("reports how many kept Scars paid, so no screen has to derive it", () => {
    // The bug this guards: a below-median player with several kept Scars, one of
    // them free, earns the value of ONE, and a results screen that works the
    // figure out by subtracting Renown and Laurels out of the total prints the
    // value of all of them.
    const { room, p, now, scar } = withScar("thornborn");
    engine.decideScar(room, "p0", scar.id, true, now);
    p.scars.push({ id: "extra-1", sceneId: "x", label: "a bad ear", kept: true });
    p.scars.push({ id: "extra-2", sceneId: "x", label: "a short finger", kept: true });
    p.renown = 0;
    engine.findPlayer(room, "p1")!.renown = 50;

    const mine = standingsFor(room.players).find((s) => s.playerId === "p0")!;
    expect(mine.keptScars).toBe(3);
    expect(mine.scarsPaid).toBe(1);
    expect(mine.total).toBe(KEPT_SCAR_VALUE);
    // Derivation gets it wrong. That is the entire point of carrying the field.
    expect(mine.total - mine.renown).not.toBe(mine.keptScars * KEPT_SCAR_VALUE);
  });

  it("a Scar kept the ordinary way pays nothing under the median", () => {
    const { room, p, now, scar } = withScar("hillfolk");
    engine.decideScar(room, "p0", scar.id, true, now);
    expect(scar.free).toBeUndefined();
    p.renown = 0;
    engine.findPlayer(room, "p1")!.renown = 50;
    const mine = standingsFor(room.players).find((s) => s.playerId === "p0")!;
    expect(mine.keptScars).toBe(1);
    expect(mine.total).toBe(0);
  });

  it("Gravewise hides one for nothing", () => {
    const { room, p, now, scar } = withScar("gravewise");
    p.renown = 20;
    engine.decideScar(room, "p0", scar.id, false, now);
    expect(p.renown).toBe(20);
    expect(p.usedBloodPower).toBe(true);
  });
});

describe("useBloodPower guards", () => {
  it("tells a player whose power is not a choice that it is not a choice", () => {
    const room = atFirstAct({ p0: "hillfolk" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useBloodPower(room, "p0", {}, now)).toThrow(/choose/i);
  });

  it("refuses outside ACT_RESULT and refuses a stranger", () => {
    const room = atFirstAct({ p0: "ashkin" });
    expect(() => engine.useBloodPower(room, "p0", {}, NOW + 1)).toThrow(/happening/i);
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));
    expect(() => engine.useBloodPower(room, "nobody", {}, now)).toThrow(/not at this table/i);
  });

  it("gives every Blood in the content a power the engine actually handles", () => {
    // The bijection the content file claims. If a ninth power kind is ever
    // added, this fails until the engine learns it.
    const handled = new Set([
      "rerollFumble",
      "seeOneReckless",
      "reassignOne",
      "costToDread",
      "extraHookToken",
      "freeHide",
      "keepScarFree",
      "dreadShield",
    ]);
    for (const blood of BLOODS) expect(handled.has(blood.power.kind)).toBe(true);
    expect(new Set(BLOODS.map((b) => b.power.kind)).size).toBe(BLOODS.length);
  });
});

describe("the applied deltas", () => {
  it("records what actually landed, not what was intended", () => {
    // A player with no Renown cannot lose any, so the ledger must say zero
    // rather than the full cost. Ashkin's refund depends on this being right:
    // refunding the intended cost would hand them Renown they never had.
    const room = atFirstAct({ p0: "gravewise" });
    const broke = engine.findPlayer(room, "p0")!;
    broke.renown = 0;
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    engine.commitApproach(room, "p0", safe.id, 0, NOW + 1);
    engine.commitApproach(room, "p1", safe.id, 0, NOW + 1);
    resolveWith(room, fixedRng([FACE_1, FACE_1, FACE_1]));
    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.success).toBe(false);
    expect(out.renownDelta).toBe(0);
    expect(broke.renown).toBe(0);
  });
});
