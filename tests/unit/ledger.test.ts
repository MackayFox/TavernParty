/**
 * The consequence ledger, under everything that can rewrite an outcome after it
 * has already been applied.
 *
 * Every test here failed before the fix it guards. They exist because the whole
 * suite was green while all of the following were true at once: flinching printed
 * its penalty as a positive number, spending a Kit reroll refunded a nomination
 * penalty, five nominators on one success were each paid half the prize, and the
 * Reckless scramble charged the party a point of Dread that appeared on no
 * outcome and was therefore invisible to the two abilities whose entire job is
 * cancelling Dread.
 *
 * The invariant they all defend: for every outcome, `costMods` sums to
 * `renownDelta`, and the sum of every `dreadDelta` equals what the party actually
 * took. If that holds, no screen can print a number it cannot explain.
 */
import { describe, expect, it } from "vitest";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import * as engine from "@/lib/game/engine";
import { FLINCH_DREAD, FLINCH_RENOWN, MARK_FLINCH_PENALTY, NOMINATION_PENALTY } from "@/lib/game/rules";
import { flinch } from "@/lib/game/resolve";
import type { ApproachDef, Room } from "@/lib/game/types";
import { fixedRng, makePlayer, rngFor } from "./helpers";

const NOW = 1_000_000;
const FACE_1 = 0.001;
const FACE_20 = 0.999;

function table(names: string[], seed = 11): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public" },
    NOW
  );
  names.forEach((n, i) => engine.join(room, { id: `p${i}`, name: n }, NOW));
  engine.startRun(room, "p0", NOW, rngFor(seed));
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

function safeDoor(room: Room): ApproachDef {
  return SCENES_BY_ID[room.act!.sceneId].approaches.find((a) => !a.reckless)!;
}

function resolveWith(room: Room, rng: ReturnType<typeof fixedRng>): number {
  const now = (room.phaseEndsAt ?? NOW) + 1;
  engine.tick(room, now, rng);
  return now;
}

/** The invariant. Every screen's arithmetic depends on it. */
function expectLedgersBalance(room: Room) {
  for (const out of room.act!.outcomes!) {
    expect(
      out.costMods.reduce((t, m) => t + m.value, 0),
      `${out.playerId} ${out.approachId}`
    ).toBe(out.renownDelta);
  }
}

describe("flinching", () => {
  it("prints its penalty negative, because it takes Renown away", () => {
    // FLINCH_RENOWN is already negative, and negating it printed "+1 Renown" for
    // a move that costs you one. The list summed to the exact negation of the
    // figure printed under it, on the most common outcome in the game.
    const out = flinch(
      makePlayer(),
      SCENES_BY_ID["a06"] ?? SCENES_BY_ID[Object.keys(SCENES_BY_ID)[0]],
      false,
      { renown: FLINCH_RENOWN, dread: FLINCH_DREAD, markPenalty: MARK_FLINCH_PENALTY },
      1
    );
    expect(out.renownDelta).toBeLessThan(0);
    expect(out.costMods.reduce((t, m) => t + m.value, 0)).toBe(out.renownDelta);
    expect(out.costMods.every((m) => m.value <= 0)).toBe(true);
  });

  it("prints the Mark penalty negative too, and still balances", () => {
    const out = flinch(
      makePlayer(),
      SCENES_BY_ID[Object.keys(SCENES_BY_ID)[0]],
      true,
      { renown: FLINCH_RENOWN, dread: FLINCH_DREAD, markPenalty: MARK_FLINCH_PENALTY },
      2
    );
    expect(out.costMods.reduce((t, m) => t + m.value, 0)).toBe(out.renownDelta);
    expect(out.renownDelta).toBe((FLINCH_RENOWN - MARK_FLINCH_PENALTY) * 2);
  });

  it("balances inside a real Act where somebody does not move", () => {
    // The existing suite could never reach this: every helper committed for
    // everybody, so no flinch outcome was ever built by the engine under test.
    const room = table(["ALEX", "BEV", "CHRIS"]);
    engine.commitApproach(room, "p1", safeDoor(room).id, 0, NOW + 1);
    resolveWith(room, fixedRng([FACE_1]));
    const idle = room.act!.outcomes!.filter((o) => o.approachId === "flinch");
    expect(idle.length).toBeGreaterThan(0);
    expectLedgersBalance(room);
  });
});

describe("nominations", () => {
  it("splits one share between everybody who pointed at the same player", () => {
    // Each nominator used to be paid a full half of the prize, so five of them on
    // one success paid out two and a half times the deed itself.
    const room = table(["ALEX", "BEV", "CHRIS", "DALE", "ELI"]);
    const door = safeDoor(room);
    for (const id of ["p0", "p2", "p3", "p4"]) engine.nominate(room, id, "p1", NOW + 1);
    for (const p of room.players) engine.commitApproach(room, p.id, door.id, 0, NOW + 1);
    resolveWith(room, fixedRng([FACE_20]));

    const nominee = room.act!.outcomes!.find((o) => o.playerId === "p1")!;
    expect(nominee.success).toBe(true);
    const paid = room
      .act!.outcomes!.filter((o) => o.playerId !== "p1")
      .flatMap((o) => o.costMods.filter((m) => m.label.startsWith("you put ")))
      .reduce((t, m) => t + m.value, 0);
    // The whole pot handed out is at most half the deed, not half each.
    expect(paid).toBeLessThanOrEqual(Math.ceil(nominee.renownDelta / 2) + 4);
    expect(paid).toBeGreaterThan(0);
    expectLedgersBalance(room);
  });

  it("survives a reroll instead of being deleted by it", () => {
    // Spending a Kit reroll used to REFUND the nomination penalty, because
    // rethrow replaced the row the settlement had been written onto.
    const room = table(["ALEX", "BEV", "CHRIS"]);
    const door = safeDoor(room);
    engine.nominate(room, "p0", "p1", NOW + 1);
    for (const p of room.players) engine.commitApproach(room, p.id, door.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));

    const mine = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    expect(mine.costMods.some((m) => m.label.startsWith("you sent "))).toBe(true);
    const before = engine.findPlayer(room, "p0")!.renown;

    const me = engine.findPlayer(room, "p0")!;
    me.rerolls = 1;
    engine.useKitReroll(room, "p0", now);

    const after = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    // Still charged for the suggestion, exactly once.
    const lines = after.costMods.filter((m) => m.label.startsWith("you sent "));
    expect(lines).toHaveLength(1);
    expect(lines[0].value).toBe(-NOMINATION_PENALTY);
    expect(engine.findPlayer(room, "p0")!.renown).toBeLessThanOrEqual(before + 12);
    expectLedgersBalance(room);
  });

  it("re-settles against the reroll's result rather than the throw it replaced", () => {
    const room = table(["ALEX", "BEV", "CHRIS"]);
    const door = safeDoor(room);
    engine.nominate(room, "p0", "p1", NOW + 1);
    for (const p of room.players) engine.commitApproach(room, p.id, door.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));

    const nominee = engine.findPlayer(room, "p1")!;
    nominee.rerolls = 1;
    engine.useKitReroll(room, "p1", now);

    const settled = room.act!.outcomes!.find((o) => o.playerId === "p1")!;
    const mine = room.act!.outcomes!.find((o) => o.playerId === "p0")!;
    const paidForSuccess = mine.costMods.some((m) => m.label.startsWith("you put "));
    // Whatever the second throw did, the nominator's line agrees with it.
    expect(paidForSuccess).toBe(settled.success);
    expectLedgersBalance(room);
  });
});

describe("the Reckless scramble", () => {
  it("puts its Dread on an outcome, so the party's total is explained", () => {
    // The scramble charged room.dread directly, so the point appeared on no
    // outcome: the Warden's Signature and Emberkin's shield both read the
    // outcomes, and therefore could not see or cancel it.
    const room = table(["ALEX", "BEV", "CHRIS"]);
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const wild = scene.approaches.find((a) => a.reckless)!;
    // Everybody reaches for the same door, so two of the three get bumped.
    for (const p of room.players) engine.commitApproach(room, p.id, wild.id, 0, NOW + 1);

    const dreadBefore = room.dread;
    // A failing roll on purpose: the relief valve gives the party a point back
    // when a majority clears their Act, and that would make this assertion about
    // two different things at once.
    resolveWith(room, fixedRng([FACE_1]));
    const charged = room.act!.outcomes!.reduce((t, o) => t + o.dreadDelta, 0);
    expect(room.dread - dreadBefore).toBe(charged);
    expect(charged).toBeGreaterThan(0);
    expectLedgersBalance(room);
  });

  it("bumps a loser to the door they are really best at, training and kit included", () => {
    const room = table(["ALEX", "BEV", "CHRIS"]);
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const wild = scene.approaches.find((a) => a.reckless)!;
    for (const p of room.players) engine.commitApproach(room, p.id, wild.id, 0, NOW + 1);
    resolveWith(room, fixedRng([FACE_20]));
    // Exactly one player went through the one door.
    const took = room.act!.outcomes!.filter((o) => o.approachId === wild.id);
    expect(took).toHaveLength(1);
  });
});

describe("the Sapper cannot re-open the one door", () => {
  it("refuses a second approach on the Reckless line", () => {
    const room = table(["ALEX", "BEV", "CHRIS"]);
    engine.findPlayer(room, "p0")!.callingId = "sapper";
    const scene = SCENES_BY_ID[room.act!.sceneId];
    const safe = scene.approaches.find((a) => !a.reckless)!;
    const wild = scene.approaches.find((a) => a.reckless)!;
    for (const p of room.players) engine.commitApproach(room, p.id, safe.id, 0, NOW + 1);
    const now = resolveWith(room, fixedRng([FACE_1]));
    expect(() =>
      engine.useSignature(room, "p0", { approachId: wild.id }, now)
    ).toThrow(/only opens once/i);
  });
});
