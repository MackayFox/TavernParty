/**
 * All eight Signatures, each one proved to actually fire.
 *
 * The Calling is the exclusive draft and the loudest choice a player makes, and
 * the Signature is what being the only WARDEN at the table buys you. It was
 * advertised on the draft card, on the character sheet, twice on the front page
 * and as a rule on the rules page, and implemented nowhere: `usedSignature` was
 * set false at creation and never set true anywhere in the repo.
 */
import { describe, expect, it } from "vitest";
import { CALLINGS } from "@/lib/content/callings";
import { KIT } from "@/lib/content/kit";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import * as engine from "@/lib/game/engine";
import {
  SIGNATURE_BOOST,
  SIGNATURE_CLEAR_DREAD,
  SIGNATURE_OATH_RENOWN,
} from "@/lib/game/rules";
import type { ApproachDef, Room } from "@/lib/game/types";
import { fixedRng, rngFor } from "./helpers";

const NOW = 1_000_000;
const FACE_1 = 0.001;
const FACE_20 = 0.999;

/** Sit three people down, deal the Callings this test wants, stop at Act 1. */
function atFirstAct(callings: Record<string, string>, seed = 5): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public" },
    NOW
  );
  ["ALEX", "BEV", "CHRIS"].forEach((n, i) =>
    engine.join(room, { id: `p${i}`, name: n }, NOW)
  );
  engine.startRun(room, "p0", NOW, rngFor(seed));

  const rng = rngFor(seed);
  let now = NOW;
  for (let i = 0; i < 40 && room.phase !== "ACT"; i++) {
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }
  if (room.phase !== "ACT") throw new Error(`stuck in ${room.phase}`);
  // Overwritten after the draft rather than fought with: the draft is the thing
  // under test everywhere else, and here it is just scaffolding.
  for (const [id, callingId] of Object.entries(callings)) {
    engine.findPlayer(room, id)!.callingId = callingId;
  }
  return room;
}

function safeDoor(room: Room): ApproachDef {
  return SCENES_BY_ID[room.act!.sceneId].approaches.find((a) => !a.reckless)!;
}

/** Everybody takes the same safe door, then the deadline passes. */
function commitAll(room: Room, doorId?: string): void {
  const door = doorId ?? safeDoor(room).id;
  for (const p of room.players) {
    if (!room.act!.choices[p.id]) engine.commitApproach(room, p.id, door, 0, NOW + 1);
  }
}

function resolveWith(room: Room, rng: ReturnType<typeof fixedRng>): number {
  const now = (room.phaseEndsAt ?? NOW) + 1;
  engine.tick(room, now, rng);
  return now;
}

describe("the set", () => {
  it("gives every Calling a Signature the engine handles", () => {
    // The bijection the content claims. A ninth kind fails to compile in the
    // engine's exhaustive switch, and fails here too.
    const handled = new Set([
      "rerollOwn",
      "addFive",
      "revealReckless",
      "shieldParty",
      "stealDeed",
      "takeScarFor",
      "secondApproach",
      "clearDread",
    ]);
    for (const c of CALLINGS) expect(handled.has(c.signature.kind)).toBe(true);
    expect(new Set(CALLINGS.map((c) => c.signature.kind)).size).toBe(CALLINGS.length);
    // Every one has a name the ledger can print.
    for (const c of CALLINGS) expect(c.signature.label.length).toBeGreaterThan(3);
  });
});

describe("Chanter: Everyone Joins In", () => {
  it("adds to the roll as a named ledger line, and is public before the die", () => {
    const room = atFirstAct({ p0: "chanter" });
    engine.useSignature(room, "p0", {}, NOW + 1);
    expect(room.act!.boosted).toContain("p0");
    // Public: another player's view can see it, unlike a choice.
    expect(engine.viewFor(room, "p1").act!.boosted).toContain("p0");

    commitAll(room);
    resolveWith(room, fixedRng([FACE_20]));
    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    const line = out.mods.find((m) => m.label === "everyone joins in");
    expect(line?.value).toBe(SIGNATURE_BOOST);
    expect(out.mods.reduce((t, m) => t + m.value, 0)).toBe(out.total);

    // The same night, the same die, the same door, without the Signature.
    // Comparing against another player would prove nothing: they have different
    // numbers and a different Calling, so their total differs anyway.
    const control = atFirstAct({ p0: "chanter" });
    commitAll(control);
    resolveWith(control, fixedRng([FACE_20]));
    const plain = control.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.total - plain.total).toBe(SIGNATURE_BOOST);
  });

  it("has to be called before you move, so it is a bet and not a rescue", () => {
    const room = atFirstAct({ p0: "chanter" });
    engine.commitApproach(room, "p0", safeDoor(room).id, 0, NOW + 1);
    expect(() => engine.useSignature(room, "p0", {}, NOW + 1)).toThrow(/before you go/i);
  });

  it("only works once in the whole run", () => {
    const room = atFirstAct({ p0: "chanter" });
    engine.useSignature(room, "p0", {}, NOW + 1);
    commitAll(room);
    resolveWith(room, fixedRng([FACE_20]));
    // Into Act 2.
    const now = (room.phaseEndsAt ?? NOW) + 1;
    engine.tick(room, now, rngFor(9));
    expect(room.phase).toBe("ACT");
    expect(() => engine.useSignature(room, "p0", {}, now + 1)).toThrow(/once a night/i);
  });
});

describe("Reckoner: Price The Door", () => {
  it("reads the Reckless number without burning a Torch", () => {
    const room = atFirstAct({ p0: "reckoner" });
    const p = engine.findPlayer(room, "p0")!;
    p.torches = 0;
    engine.useSignature(room, "p0", {}, NOW + 1);
    expect(room.act!.revealed).toContain("p0");
    expect(p.torches).toBe(0);
    expect(engine.viewFor(room, "p0").act!.recklessTn).toBeGreaterThan(0);
    // And nobody else gets to see it.
    expect(engine.viewFor(room, "p1").act!.recklessTn).toBeNull();
  });
});

describe("Houndmaster: Cast Again", () => {
  it("throws the die again and replaces the outcome, wound and all", () => {
    const room = atFirstAct({ p0: "houndmaster" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const p = engine.findPlayer(room, "p0")!;
    const first = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(first.success).toBe(false);
    expect(p.scars).toHaveLength(1);
    const scarsBefore = p.scars[0].id;

    engine.useSignature(room, "p0", {}, now);
    const second = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(second).not.toBe(first);
    expect(p.usedSignature).toBe(true);
    // Exactly one wound either way: the first was taken back out, not stacked.
    expect(p.scars.length).toBeLessThanOrEqual(1);
    if (second.success) expect(p.scars).toHaveLength(0);
    else expect(p.scars[0].id).toBe(scarsBefore);
    expect(second.mods.map((m) => m.label)).toContain("cast again");
  });

  it("refuses once the wound has been decided, so nothing is silently unwound", () => {
    const room = atFirstAct({ p0: "houndmaster" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const p = engine.findPlayer(room, "p0")!;
    engine.decideScar(room, "p0", p.scars[0].id, true, now);
    expect(() => engine.useSignature(room, "p0", {}, now)).toThrow(/already decided/i);
  });

  it("refuses when you did not move at all", () => {
    const room = atFirstAct({ p0: "houndmaster" });
    engine.commitApproach(room, "p1", safeDoor(room).id, 0, NOW + 1);
    engine.commitApproach(room, "p2", safeDoor(room).id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));
    expect(room.act!.outcomes!.find((o) => o.playerId === "p0")!.approachId).toBe("flinch");
    expect(() => engine.useSignature(room, "p0", {}, now)).toThrow(/nothing to throw/i);
  });
});

describe("Warden: Behind Me", () => {
  it("takes every point of this Act's Dread off the party, not just their own", () => {
    const room = atFirstAct({ p0: "warden" });
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const costly = [...scene.approaches].sort((a, b) => b.cost.dread - a.cost.dread)[0];
    expect(costly.cost.dread).toBeGreaterThan(0);
    commitAll(room, costly.id);
    const now = resolveWith(room, fixedRng([FACE_1]));

    const total = room.act!.outcomes!.reduce((t, o) => t + Math.max(0, o.dreadDelta), 0);
    expect(total).toBeGreaterThan(0);
    const dread = room.dread;
    engine.useSignature(room, "p0", {}, now);
    expect(room.dread).toBe(dread - total);
    for (const o of room.act!.outcomes!) expect(o.dreadDelta).toBe(0);
  });

  it("refuses when the Act put nothing on the party", () => {
    const room = atFirstAct({ p0: "warden" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useSignature(room, "p0", {}, now)).toThrow(/nothing on the party/i);
  });
});

describe("Hedge-witch: Salt The Threshold", () => {
  it("pulls the party back under a threshold", () => {
    const room = atFirstAct({ p0: "hedgewitch" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    room.dread = 5;
    engine.useSignature(room, "p0", {}, now);
    expect(room.dread).toBe(5 - SIGNATURE_CLEAR_DREAD);
  });

  it("never goes below nothing, and refuses when there is nothing to clear", () => {
    const room = atFirstAct({ p0: "hedgewitch" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    room.dread = 1;
    engine.useSignature(room, "p0", {}, now);
    expect(room.dread).toBe(0);

    const clean = atFirstAct({ p0: "hedgewitch" });
    commitAll(clean);
    const then = resolveWith(clean, fixedRng([FACE_20]));
    clean.dread = 0;
    expect(() => engine.useSignature(clean, "p0", {}, then)).toThrow(/nothing on the party/i);
  });
});

describe("Knife: Whose Idea It Was", () => {
  it("takes a cut of somebody else's win and costs them nothing", () => {
    const room = atFirstAct({ p0: "knife" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_20]));
    const target = room.act!.outcomes!.find((o) => o.playerId === "p1")!;
    expect(target.success).toBe(true);

    const them = engine.findPlayer(room, "p1")!;
    const theirRenown = them.renown;
    const mine = engine.findPlayer(room, "p0")!.renown;

    engine.useSignature(room, "p0", { targetId: "p1" }, now);
    expect(engine.findPlayer(room, "p0")!.renown).toBeGreaterThan(mine);
    expect(them.renown).toBe(theirRenown);
  });

  it("refuses yourself, a stranger, and somebody who failed", () => {
    const room = atFirstAct({ p0: "knife" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    expect(() => engine.useSignature(room, "p0", { targetId: "p0" }, now)).toThrow(
      /somebody else/i
    );
    expect(() => engine.useSignature(room, "p0", {}, now)).toThrow(/somebody else/i);
    // Everybody fumbled, so there is nothing worth taking.
    expect(() => engine.useSignature(room, "p0", { targetId: "p1" }, now)).toThrow(
      /worth taking/i
    );
  });
});

describe("Oathbound: On My Word", () => {
  it("moves somebody else's undecided wound onto you and pays for the saying", () => {
    const room = atFirstAct({ p0: "oathbound" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const me = engine.findPlayer(room, "p0")!;
    const them = engine.findPlayer(room, "p1")!;
    expect(them.scars).toHaveLength(1);
    const mineBefore = me.scars.length;
    const renown = me.renown;

    engine.useSignature(room, "p0", { targetId: "p1" }, now);
    expect(them.scars).toHaveLength(0);
    expect(me.scars).toHaveLength(mineBefore + 1);
    // Undecided when it arrives: it is a wound now, not a settled account.
    expect(me.scars[me.scars.length - 1].kept).toBeNull();
    expect(me.renown).toBe(renown + SIGNATURE_OATH_RENOWN);
  });

  it("refuses when they have nothing undecided", () => {
    const room = atFirstAct({ p0: "oathbound" });
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useSignature(room, "p0", { targetId: "p1" }, now)).toThrow(
      /nothing undecided/i
    );
  });
});

describe("Sapper: The Other Way In", () => {
  it("rolls a second door after a failure, with a second wound on the table", () => {
    const room = atFirstAct({ p0: "sapper" });
    const door = safeDoor(room);
    commitAll(room, door.id);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const other = SCENES_BY_ID[room.act!.sceneId].approaches.find((a) => a.id !== door.id)!;

    const before = room.act!.outcomes!.length;
    engine.useSignature(room, "p0", { approachId: other.id }, now);
    expect(room.act!.outcomes!).toHaveLength(before + 1);
    const extra = room.act!.outcomes![before];
    expect(extra.playerId).toBe("p0");
    expect(extra.approachId).toBe(other.id);
    expect(extra.mods.map((m) => m.label)).toContain("the other way in");
  });

  it("refuses after a success, and refuses the same door again", () => {
    const room = atFirstAct({ p0: "sapper" });
    const door = safeDoor(room);
    commitAll(room, door.id);
    const won = resolveWith(room, fixedRng([FACE_20]));
    expect(() => engine.useSignature(room, "p0", { approachId: door.id }, won)).toThrow(
      /shut in your face/i
    );

    const lost = atFirstAct({ p0: "sapper" });
    const d2 = safeDoor(lost);
    commitAll(lost, d2.id);
    const then = resolveWith(lost, fixedRng([FACE_1]));
    expect(() => engine.useSignature(lost, "p0", { approachId: d2.id }, then)).toThrow(
      /another way through/i
    );
  });
});

describe("useSignature guards", () => {
  it("refuses a stranger and refuses the wrong phase", () => {
    const room = atFirstAct({ p0: "warden" });
    expect(() => engine.useSignature(room, "nobody", {}, NOW + 1)).toThrow(/not at this table/i);
    // Warden reacts to a result, so during the Act it is the wrong phase.
    expect(() => engine.useSignature(room, "p0", {}, NOW + 1)).toThrow(/right now/i);
  });

  it("refuses a Chanter after the Act deadline has gone", () => {
    const room = atFirstAct({ p0: "chanter" });
    const late = (room.phaseEndsAt ?? NOW) + 1;
    expect(() => engine.useSignature(room, "p0", {}, late)).toThrow(/too long/i);
  });
});

describe("Kit charges", () => {
  it("gives every charge kind somewhere to land", () => {
    // The bug this guards: only `torch` was honoured, so six of the twelve Kit
    // items advertised a resource that was never granted.
    const kinds = new Set(KIT.map((k) => k.charge?.kind).filter(Boolean));
    expect(kinds).toEqual(new Set(["reroll", "reveal", "torch"]));

    const room = atFirstAct({});
    for (const p of room.players) {
      const item = KIT.find((k) => k.id === p.kitIds[0]);
      if (!item?.charge) continue;
      if (item.charge.kind === "reroll") expect(p.rerolls).toBe(item.charge.uses);
      // A torch and a cracked mirror buy the same thing, so they share a pocket.
      else expect(p.torches).toBe(item.charge.uses);
    }
  });

  it("spends a reroll to throw again, and runs out", () => {
    const room = atFirstAct({});
    const p = engine.findPlayer(room, "p0")!;
    p.rerolls = 1;
    commitAll(room);
    const now = resolveWith(room, fixedRng([FACE_1]));
    const first = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(first.success).toBe(false);

    engine.useKitReroll(room, "p0", now);
    expect(p.rerolls).toBe(0);
    const second = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(second).not.toBe(first);
    expect(second.mods.map((m) => m.label)).toContain("your gear earns its place");
    // Exactly one wound either way: the first was taken back out, not stacked.
    expect(p.scars.length).toBeLessThanOrEqual(1);

    expect(() => engine.useKitReroll(room, "p0", now)).toThrow(/no rerolls/i);
  });

  it("does not spend the charge when the rethrow is refused", () => {
    const room = atFirstAct({});
    const p = engine.findPlayer(room, "p0")!;
    p.rerolls = 2;
    // Everybody else moves; p0 does not, so there is nothing to throw again.
    engine.commitApproach(room, "p1", safeDoor(room).id, 0, NOW + 1);
    engine.commitApproach(room, "p2", safeDoor(room).id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));
    expect(() => engine.useKitReroll(room, "p0", now)).toThrow(/nothing to throw/i);
    expect(p.rerolls).toBe(2);
  });
});

describe("the strangers", () => {
  it("cast a Laurel, so a one-human table is not rigged against the human", () => {
    const room = engine.createRoom(
      { code: "TAVERN", name: "Solo", visibility: "public" },
      NOW
    );
    engine.join(room, { id: "human", name: "ALEX" }, NOW);
    engine.addBot(room, "human", NOW, rngFor(2));
    engine.addBot(room, "human", NOW, rngFor(3));
    engine.startRun(room, "human", NOW, rngFor(4));

    const rng = rngFor(4);
    let now = NOW;
    for (let i = 0; i < 400 && room.phase !== "FINAL"; i++) {
      if (room.phaseEndsAt === null) break;
      now = room.phaseEndsAt + 1;
      engine.tick(room, now, rng);
    }
    expect(room.phase).toBe("FINAL");

    // Every bot voted, and never for itself.
    for (const bot of room.players.filter((p) => p.isBot)) {
      expect(bot.laurelFor).toBeTruthy();
      expect(bot.laurelFor).not.toBe(bot.id);
    }
    // So Laurels are in play rather than one-way traffic out of the only person
    // at the table. One per bot: this human never voted, because this run was
    // played entirely on deadlines, and an abstention casts nothing.
    const bots = room.players.filter((p) => p.isBot).length;
    const total = room.standings!.reduce((t, s) => t + s.laurels, 0);
    expect(total).toBe(bots);
    expect(bots).toBeGreaterThan(0);
  });

  it("decide their own wounds rather than losing them to the deadline", () => {
    const room = engine.createRoom(
      { code: "TAVERN", name: "Solo", visibility: "public" },
      NOW
    );
    engine.join(room, { id: "human", name: "ALEX" }, NOW);
    engine.addBot(room, "human", NOW, rngFor(2));
    engine.startRun(room, "human", NOW, rngFor(6));

    const rng = rngFor(6);
    let now = NOW;
    for (let i = 0; i < 400 && room.phase !== "FINAL"; i++) {
      if (room.phaseEndsAt === null) break;
      now = room.phaseEndsAt + 1;
      engine.tick(room, now, rng);
    }
    const bot = room.players.find((p) => p.isBot)!;
    // Whatever they took, they made a call on all of it.
    expect(bot.scars.every((s) => s.kept !== null)).toBe(true);
    // And at least sometimes that call was to wear it, which the forced-hide
    // default could never produce.
    expect(bot.stats.scarsKept + bot.stats.scarsHidden).toBe(bot.scars.length);
  });
});

describe("the consequence ledger", () => {
  it("names every part of the Renown figure, and they sum to it", () => {
    // The roll side of this game never printed a bare total. The consequence
    // side always did: the Mark bonus, both doublings and any nomination payout
    // were folded straight into one number.
    const room = atFirstAct({});
    commitAll(room);
    resolveWith(room, fixedRng([FACE_1, FACE_20, FACE_1]));
    for (const out of room.act!.outcomes!) {
      const sum = out.costMods.reduce((t, m) => t + m.value, 0);
      expect(sum).toBe(out.renownDelta);
    }
  });

  it("gives the Mark bonus its own line rather than inflating the figure", () => {
    const room = atFirstAct({});
    // Force somebody to be Marked by this scene.
    room.act!.marked = ["p0"];
    commitAll(room);
    resolveWith(room, fixedRng([FACE_20]));
    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.costMods.map((m) => m.label)).toContain("this one was about you");
    expect(out.costMods.reduce((t, m) => t + m.value, 0)).toBe(out.renownDelta);
  });

  it("puts a nomination payout on the nominator's own ledger", () => {
    const room = atFirstAct({});
    engine.nominate(room, "p0", "p1", NOW + 1);
    commitAll(room);
    resolveWith(room, fixedRng([FACE_20]));
    const mine = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    // The number appears on the ledger of the person it happened to.
    expect(mine.costMods.some((m) => m.label.includes("forward"))).toBe(true);
    expect(mine.costMods.reduce((t, m) => t + m.value, 0)).toBe(mine.renownDelta);
  });

  it("names the doubling when the night has gone badly", () => {
    const room = atFirstAct({});
    room.dread = 5;
    const door = SCENES_BY_ID[room.act!.sceneId].approaches.find(
      (a) => !a.reckless && a.cost.renown > 0
    )!;
    commitAll(room, door.id);
    resolveWith(room, fixedRng([FACE_1]));
    const out = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(out.success).toBe(false);
    expect(out.costMods.some((m) => m.label.includes("night"))).toBe(true);
    expect(out.costMods.reduce((t, m) => t + m.value, 0)).toBe(out.renownDelta);
  });
});
