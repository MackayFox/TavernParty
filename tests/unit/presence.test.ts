/**
 * Presence, and who is holding the host chair.
 *
 * Both of these were blockers that could kill a table permanently, and neither
 * had a test that could see it. The migration test that did exist passed only
 * because it called `setConnected` directly, which no route in the product ever
 * does.
 */
import { describe, expect, it } from "vitest";
import * as engine from "@/lib/game/engine";
import { HOST_MIGRATION_GRACE_MS, PRESENCE_TIMEOUT_MS } from "@/lib/game/rules";
import type { Room } from "@/lib/game/types";
import { rngFor } from "./helpers";

const NOW = 1_000_000;
const POLL = 2_500;

function lobby(names: string[]): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public" },
    NOW
  );
  names.forEach((n, i) => engine.join(room, { id: `p${i}`, name: n }, NOW));
  return room;
}

describe("a tab that closes", () => {
  it("is eventually marked away, which is what the whole system hangs off", () => {
    // Exactly what the product does: one player keeps polling, the other does
    // not. `store.snapshot` calls heartbeat then tick on every poll.
    const room = lobby(["ALEX", "BEV"]);
    let now = NOW;
    for (let i = 0; i < 400; i++) {
      now += POLL;
      engine.heartbeat(room, "p1", now);
      engine.tick(room, now, rngFor(1));
    }
    const gone = engine.findPlayer(room, "p0")!;
    expect(gone.connected).toBe(false);
    expect(gone.disconnectedAt).not.toBeNull();
    expect(now - NOW).toBeGreaterThan(PRESENCE_TIMEOUT_MS);
  });

  it("hands the host chair on, so the table can still be started", () => {
    const room = lobby(["ALEX", "BEV"]);
    expect(engine.findPlayer(room, "p0")!.isHost).toBe(true);
    let now = NOW;
    for (let i = 0; i < 400; i++) {
      now += POLL;
      engine.heartbeat(room, "p1", now);
      engine.tick(room, now, rngFor(1));
    }
    expect(engine.findPlayer(room, "p1")!.isHost).toBe(true);
    // And the survivor can actually get the night going.
    expect(() => engine.startRun(room, "p1", now, rngFor(2))).not.toThrow();
  });

  it("keeps a player who is still polling", () => {
    const room = lobby(["ALEX", "BEV"]);
    let now = NOW;
    for (let i = 0; i < 400; i++) {
      now += POLL;
      engine.heartbeat(room, "p0", now);
      engine.heartbeat(room, "p1", now);
      engine.tick(room, now, rngFor(1));
    }
    expect(room.players.every((p) => p.connected)).toBe(true);
    expect(engine.findPlayer(room, "p0")!.isHost).toBe(true);
  });

  it("persists the heartbeat past the room's first few seconds", () => {
    // The persist condition used to be measured against the ROOM's age, so
    // twenty seconds in it stopped bumping the version forever. That meant
    // lastSeenAt never reached the database AND updated_at froze, so the
    // thirty-minute reaper deleted live lobbies.
    const room = lobby(["ALEX", "BEV"]);
    let now = NOW + 10 * 60_000; // Ten minutes into a long lobby.
    const before = room.version;
    for (let i = 0; i < 10; i++) {
      now += POLL;
      engine.heartbeat(room, "p0", now);
    }
    expect(room.version).toBeGreaterThan(before);
  });
});

describe("the host chair never belongs to a bot", () => {
  it("does not hand it to a stranger when the only human leaves", () => {
    const room = lobby(["ALEX"]);
    engine.addBot(room, "p0", NOW, rngFor(3));
    engine.leave(room, "p0", NOW);
    // Nobody human is left, so the table is cleared rather than left as a public
    // room full of strangers for Quick Match to funnel people into.
    expect(room.players).toHaveLength(0);
  });

  it("gives it to the remaining human when the host leaves", () => {
    const room = lobby(["ALEX", "BEV"]);
    engine.addBot(room, "p0", NOW, rngFor(3));
    engine.leave(room, "p0", NOW);
    const host = room.players.filter((p) => p.isHost);
    expect(host).toHaveLength(1);
    expect(host[0].isBot).toBe(false);
    expect(host[0].id).toBe("p1");
  });

  it("makes a newcomer host of a table only bots are sitting at", () => {
    const room = lobby(["ALEX"]);
    engine.addBot(room, "p0", NOW, rngFor(3));
    // Force the broken state directly, the way a row already in the database
    // would look.
    const bot = room.players.find((p) => p.isBot)!;
    engine.findPlayer(room, "p0")!.isHost = false;
    bot.isHost = true;
    room.players = room.players.filter((p) => p.isBot);

    engine.join(room, { id: "new", name: "CHRIS" }, NOW);
    const host = room.players.filter((p) => p.isHost);
    expect(host).toHaveLength(1);
    expect(host[0].id).toBe("new");
    expect(() => engine.startRun(room, "new", NOW, rngFor(4))).not.toThrow();
  });

  it("repairs a bot-hosted table on the next tick", () => {
    const room = lobby(["ALEX", "BEV"]);
    engine.addBot(room, "p0", NOW, rngFor(3));
    const bot = room.players.find((p) => p.isBot)!;
    for (const p of room.players) p.isHost = false;
    bot.isHost = true;

    engine.tick(room, NOW + HOST_MIGRATION_GRACE_MS + 1, rngFor(5));
    const host = room.players.filter((p) => p.isHost);
    expect(host).toHaveLength(1);
    expect(host[0].isBot).toBe(false);
  });

  it("lets the recovered host evict the stranger that was squatting", () => {
    const room = lobby(["ALEX", "BEV"]);
    engine.addBot(room, "p0", NOW, rngFor(3));
    const bot = room.players.find((p) => p.isBot)!;
    for (const p of room.players) p.isHost = false;
    bot.isHost = true;
    engine.tick(room, NOW + HOST_MIGRATION_GRACE_MS + 1, rngFor(5));

    const host = room.players.find((p) => p.isHost)!;
    expect(() => engine.removeBot(room, host.id, bot.id)).not.toThrow();
    expect(room.players.some((p) => p.isBot)).toBe(false);
  });
});

describe("another round", () => {
  it("is a new night, not a reshuffle of the same one", () => {
    // A group that hit "Another round" met a repeat scene 63% of the time, and
    // 96% by the third round, because the deck was built from the whole pool as
    // though the table had never played.
    const room = engine.createRoom(
      { code: "TAVERN", name: "The Test", visibility: "public" },
      NOW
    );
    engine.join(room, { id: "p0", name: "ALEX" }, NOW);
    engine.join(room, { id: "p1", name: "BEV" }, NOW);

    const decks: string[][] = [];
    let now = NOW;
    for (let round = 0; round < 3; round++) {
      engine.startRun(room, "p0", now, rngFor(20 + round));
      const rng = rngFor(20 + round);
      for (let i = 0; i < 400 && room.phase !== "FINAL"; i++) {
        if (room.phaseEndsAt === null) break;
        now = room.phaseEndsAt + 1;
        engine.tick(room, now, rng);
      }
      expect(room.phase).toBe("FINAL");
      decks.push([...room.deck]);
      engine.rematch(room, room.players.find((p) => p.isHost)!.id, now);
      // And last night's chronicle does not open this one.
      expect(room.log.filter((l) => l.text.includes("Act "))).toHaveLength(0);
    }

    // Three rounds of five Acts out of thirty scenes: no repeats at all is
    // achievable, and the deck builder should achieve it.
    const all = decks.flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
