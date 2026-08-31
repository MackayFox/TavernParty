/**
 * The lobby, the matchmaker, and a beat that ends when it has been answered.
 *
 * Three symptoms of one omission: `sweepPresence` maintained `connected` and
 * nothing in the product read it. So the lobby counted seats and advertised
 * twenty tables with nobody at any of them, Quick Match sorted by those seats and
 * walked each arrival into the fullest abandoned one, and a phase counted nothing
 * at all, so six people who had every one of them answered watched the clock run
 * down anyway.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import * as engine from "@/lib/game/engine";
import { memStore } from "@/lib/game/memstore";
import { ACT_GRACE_MS, HOST_MIGRATION_GRACE_MS, PRESENCE_TIMEOUT_MS } from "@/lib/game/rules";
import type { Phase, Room } from "@/lib/game/types";
import { rngFor } from "./helpers";

const NOW = 1_000_000;
/** Long enough that a chair is nobody's: the timeout and the grace after it. */
const GONE = PRESENCE_TIMEOUT_MS + HOST_MIGRATION_GRACE_MS + 1;

function table(names: string[], settings = {}): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public", settings },
    NOW
  );
  names.forEach((n, i) => engine.join(room, { id: `p${i}`, name: n }, NOW));
  return room;
}

/**
 * Reach a phase the way a real table does: everybody polling. The suites that
 * drive the engine on deadlines alone cannot see any of this, because a table
 * nobody has heard from is exactly the table that is left to its clock.
 */
function pollTo(room: Room, phase: Phase, from: number, seed = 1): number {
  const rng = rngFor(seed);
  let now = from;
  for (let i = 0; i < 30 && room.phase !== phase; i++) {
    now = (room.phaseEndsAt ?? now) + 1;
    for (const p of room.players) engine.heartbeat(room, p.id, now);
    engine.tick(room, now, rng);
  }
  return now;
}

describe("a beat nobody is still answering", () => {
  it("resolves as soon as everybody at the table has moved", () => {
    const room = table(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(3));
    const now = pollTo(room, "ACT", NOW, 3);
    expect(room.phase).toBe("ACT");
    const door = SCENES_BY_ID[room.act!.sceneId].approaches[0].id;
    const deadline = room.phaseEndsAt!;

    engine.commitApproach(room, "p0", door, 0, now + 1);
    engine.tick(room, now + 2, rngFor(3));
    // One of two. BEV is here and has not moved, so the clock still owns it.
    expect(room.phase).toBe("ACT");

    /**
     * FULL, AND THEN A MOMENT LONGER. See ACT_GRACE_MS.
     *
     * This used to assert the Act resolved on the very next tick after the last
     * commit, and that was the bug rather than the feature: nominating somebody
     * is an ACT-phase action, so a table that all decided quickly resolved the
     * Act in the same breath and every nomination came back "That is not
     * happening right now". Measured on a real six-player run, the sixty-second
     * window collapsed to 1.9 seconds and all six nominations were refused, on
     * every Act. The mechanic had an economy, a UI and a smoke test, and was
     * reachable only by the slow.
     */
    engine.commitApproach(room, "p1", door, 0, now + 3);
    engine.tick(room, now + 4, rngFor(3));
    expect(room.phase, "the grace has not elapsed yet").toBe("ACT");

    // And the grace is for something: this is the window nomination lives in.
    engine.nominate(room, "p0", "p1", now + 5);
    expect(room.act!.nominations.p0).toBe("p1");

    engine.tick(room, now + 4 + ACT_GRACE_MS, rngFor(3));
    expect(room.phase).toBe("ACT_RESULT");
    // Well inside the Act's own deadline, or this test proves nothing.
    expect(now + 4 + ACT_GRACE_MS).toBeLessThan(deadline);
  });

  it("does not wait for a tab nobody is behind", () => {
    const room = table(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(4));
    const now = pollTo(room, "ACT", NOW, 4);
    const door = SCENES_BY_ID[room.act!.sceneId].approaches[0].id;
    engine.commitApproach(room, "p0", door, 0, now + 1);

    // BEV stops polling and never chooses. ALEX keeps polling. The beat must not
    // hold for BEV's full deadline just because she is in the players array.
    // GONE is well past ACT_GRACE_MS, so the grace is not what is being tested
    // here: the point is that a swept seat does not hold the beat at all.
    const later = now + GONE;
    engine.heartbeat(room, "p0", later);
    engine.tick(room, later, rngFor(4));
    engine.tick(room, later + ACT_GRACE_MS, rngFor(4));
    expect(room.phase).toBe("ACT_RESULT");
    expect(engine.findPlayer(room, "p1")!.stats.flinches).toBe(1);
  });

  it("leaves the beats that ask for nothing to their deadline", () => {
    // ACT_RESULT is the beat you read, and everything in it is optional, so
    // "everybody has answered" is never true there. Cutting it short would take
    // the ledger away from the table it is for.
    const room = table(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(5));
    const now = pollTo(room, "ACT_RESULT", NOW, 5);
    const ends = room.phaseEndsAt!;
    for (const p of room.players) engine.heartbeat(room, p.id, now + 1);
    engine.tick(room, now + 1, rngFor(5));
    expect(room.phase).toBe("ACT_RESULT");
    expect(room.phaseEndsAt).toBe(ends);
  });
});

describe("a chair at a full table", () => {
  it("goes to somebody who is here when nobody is in it", () => {
    const room = table(["ALEX", "BEV"], { maxPlayers: 2 });
    expect(() => engine.join(room, { id: "p9", name: "CHRIS" }, NOW)).toThrow(/full/i);

    const later = NOW + GONE;
    engine.heartbeat(room, "p0", later);
    engine.tick(room, later, rngFor(1));
    engine.join(room, { id: "p9", name: "CHRIS" }, later);
    expect(room.players.map((p) => p.id)).toEqual(["p0", "p9"]);
    // And the table still has exactly one human host.
    expect(room.players.filter((p) => p.isHost)).toHaveLength(1);
  });

  it("is not taken from somebody who is only mid-refresh", () => {
    const room = table(["ALEX", "BEV"], { maxPlayers: 2 });
    engine.setConnected(room, "p1", false, NOW);
    expect(() =>
      engine.join(room, { id: "p9", name: "CHRIS" }, NOW + HOST_MIGRATION_GRACE_MS - 1)
    ).toThrow(/full/i);
  });
});

describe("the lobby", () => {
  beforeEach(() => {
    // The in-memory store is keyed on globalThis so it survives a module reload,
    // which also means it survives the previous test.
    (globalThis as { __tpMemRooms?: Map<string, Room> }).__tpMemRooms?.clear();
  });

  it("advertises tables somebody is at, and no others", async () => {
    const dead = await memStore.createRoom({ name: "The empty room", visibility: "public" });
    await memStore.mutate(dead.code, (r, now) =>
      engine.join(r, { id: "ghost", name: "OLD MARGET" }, now)
    );
    // Their tab closed a minute ago, and nothing will ever poll this table again.
    for (const p of (await memStore.getRoom(dead.code))!.players) {
      p.lastSeenAt = Date.now() - 60_000;
    }
    expect(await memStore.listPublicRooms()).toEqual([]);

    const live = await memStore.createRoom({ name: "The back room", visibility: "public" });
    await memStore.mutate(live.code, (r, now) =>
      engine.join(r, { id: "here", name: "TALL FEN" }, now)
    );
    const listed = await memStore.listPublicRooms();
    expect(listed.map((t) => t.code)).toEqual([live.code]);
    expect(listed[0].players).toBe(1);

    // And Quick Match sends the next arrival to the table with somebody at it,
    // rather than to the fullest row in the database.
    expect((await memStore.quickMatch()).code).toBe(live.code);
  });

  it("opens a new table when every listed one is dead", async () => {
    const dead = await memStore.createRoom({ name: "The empty room", visibility: "public" });
    await memStore.mutate(dead.code, (r, now) =>
      engine.join(r, { id: "ghost", name: "OLD MARGET" }, now)
    );
    for (const p of (await memStore.getRoom(dead.code))!.players) {
      p.lastSeenAt = Date.now() - 60_000;
    }
    const opened = await memStore.quickMatch();
    expect(opened.code).not.toBe(dead.code);
    expect(opened.players).toEqual([]);
  });
});
