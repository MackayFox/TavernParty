import { describe, expect, it } from "vitest";
import * as engine from "@/lib/game/engine";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import { MIN_PLAYERS, TIMINGS } from "@/lib/game/rules";
import { GameError, type Room } from "@/lib/game/types";
import { rngFor } from "./helpers";

const NOW = 1_000_000;

function makeRoom(names: string[] = ["ALEX", "BEV", "CHRIS"], settings = {}): Room {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public", settings },
    NOW
  );
  names.forEach((n, i) => engine.join(room, { id: `p${i}`, name: n }, NOW));
  return room;
}

/** Run the whole night on deadlines alone, as an entirely absent table would. */
function playOut(room: Room, seed = 1, maxSteps = 400) {
  const rng = rngFor(seed);
  let now = NOW;
  let steps = 0;
  while (room.phase !== "FINAL" && steps < maxSteps) {
    steps++;
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }
  return { steps, now };
}

describe("the table", () => {
  it("seats people and makes the first one host", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    expect(room.players).toHaveLength(2);
    expect(room.players.filter((p) => p.isHost).map((p) => p.name)).toEqual(["ALEX"]);
  });

  it("treats a second join with the same id as a rejoin", () => {
    const room = makeRoom(["ALEX"]);
    engine.join(room, { id: "p0", name: "ALEX" }, NOW);
    expect(room.players).toHaveLength(1);
  });

  it("refuses a blank name and an overfull table", () => {
    const room = makeRoom(["ALEX"], { maxPlayers: 2 });
    expect(() => engine.join(room, { id: "x", name: "  " }, NOW)).toThrow(/name/i);
    engine.join(room, { id: "y", name: "BEV" }, NOW);
    expect(() => engine.join(room, { id: "z", name: "CHRIS" }, NOW)).toThrow(/full/i);
  });

  it("only lets the host start, and only with enough people", () => {
    const solo = makeRoom(["ALEX"]);
    expect(() => engine.startRun(solo, "p0", NOW)).toThrow(/at least/i);
    const room = makeRoom(["ALEX", "BEV"]);
    expect(() => engine.startRun(room, "p1", NOW)).toThrow(/host/i);
    engine.startRun(room, "p0", NOW, rngFor(1));
    expect(room.phase).toBe("MUSTER");
  });

  it("hands the host over when they go quiet, and not before", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    engine.setConnected(room, "p0", false, NOW);
    expect(engine.maybeMigrateHost(room, NOW + 1_000)).toBe(false);
    expect(engine.maybeMigrateHost(room, NOW + 30_000)).toBe(true);
    expect(room.players.find((p) => p.id === "p1")?.isHost).toBe(true);
  });
});

describe("the house array", () => {
  it("rolls six numbers once, for everybody", () => {
    const room = makeRoom();
    engine.startRun(room, "p0", NOW, rngFor(4));
    expect(room.houseArray).toHaveLength(6);
    for (const n of room.houseArray!) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(18);
    }
  });

  /** The array is the array. You may rearrange it, never rewrite it. */
  it("refuses an assignment that is not a permutation of it", () => {
    const room = makeRoom();
    engine.startRun(room, "p0", NOW, rngFor(4));
    engine.tick(room, NOW + TIMINGS.musterMs + 1, rngFor(4));
    engine.tick(room, room.phaseEndsAt! + 1, rngFor(4));
    engine.tick(room, room.phaseEndsAt! + 1, rngFor(4));
    expect(room.phase).toBe("ASSIGN");

    const array = room.houseArray!;
    const honest = {
      brawn: array[0], deft: array[1], grit: array[2],
      wits: array[3], nerve: array[4], charm: array[5],
    };
    engine.assign(room, "p0", honest, "the-pit", room.phaseEndsAt! - 1);
    expect(room.players[0].scores?.brawn).toBe(array[0]);

    const cheat = { ...honest, brawn: 18, deft: 18 };
    expect(() => engine.assign(room, "p1", cheat, "the-pit", room.phaseEndsAt! - 1)).toThrow(
      /numbers the house rolled/i
    );
  });
});

describe("a whole night", () => {
  it("reaches an ending with nobody touching anything", () => {
    const room = makeRoom(["ALEX", "BEV", "CHRIS"]);
    engine.startRun(room, "p0", NOW, rngFor(9));
    const { steps } = playOut(room, 9);
    expect(room.phase).toBe("FINAL");
    expect(steps).toBeLessThan(60);
    expect(room.standings).toBeDefined();
    expect(room.standings).toHaveLength(3);
    expect(room.standings!.filter((s) => s.hoard)).toHaveLength(1);
  });

  it("arms every character on the way through, even an absent one", () => {
    const room = makeRoom(["ALEX", "BEV", "CHRIS", "DALE"]);
    engine.startRun(room, "p0", NOW, rngFor(3));
    playOut(room, 3);
    for (const p of room.players) {
      expect(p.callingId, `${p.name} has no Calling`).toBeTruthy();
      expect(p.bloodId, `${p.name} has no Blood`).toBeTruthy();
      expect(p.hookId, `${p.name} has no Hook`).toBeTruthy();
      expect(p.kitIds.length, `${p.name} has no Kit`).toBeGreaterThan(0);
      expect(p.scores, `${p.name} has no scores`).toBeTruthy();
    }
  });

  it("never gives two people the same Calling", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const room = makeRoom(["A", "B", "C", "D", "E"]);
      engine.startRun(room, "p0", NOW, rngFor(seed));
      playOut(room, seed);
      const callings = room.players.map((p) => p.callingId);
      expect(new Set(callings).size, `seed ${seed}`).toBe(callings.length);
    }
  });

  it("plays exactly as many Acts as the settings asked for", () => {
    const room = makeRoom(["A", "B"], { acts: 3 });
    engine.startRun(room, "p0", NOW, rngFor(5));
    playOut(room, 5);
    expect(room.phase).toBe("FINAL");
    // Everybody flinched every Act, so three Acts of flinching.
    expect(room.players[0].stats.flinches).toBe(3);
  });

  it("leaves nobody with an undecided Scar at the end", () => {
    const room = makeRoom(["A", "B", "C"]);
    engine.startRun(room, "p0", NOW, rngFor(11));
    playOut(room, 11);
    for (const p of room.players) {
      for (const s of p.scars) expect(s.kept, `${p.name} scar undecided`).not.toBeNull();
    }
  });

  it("is reproducible from a seed, so a daily can replay a night", () => {
    const run = (seed: number) => {
      const room = makeRoom(["A", "B", "C"]);
      engine.startRun(room, "p0", NOW, rngFor(seed));
      playOut(room, seed);
      return room.standings!.map((s) => `${s.name}:${s.total}`);
    };
    expect(run(7)).toEqual(run(7));
  });
});

describe("flinching, and the tab that closed", () => {
  it("gives an absent table a real move rather than a stalled phase", () => {
    const room = makeRoom(["A", "B"]);
    engine.startRun(room, "p0", NOW, rngFor(2));
    playOut(room, 2);
    // Two players, all bots absent: everybody flinched every Act, which taxed
    // the party rather than hanging the run.
    expect(room.phase).toBe("FINAL");
    expect(room.dread).toBeGreaterThan(0);
  });

  it("hides an undecided Scar rather than keeping it, so the table is not taxed", () => {
    // Keeping raises party Dread; hiding costs only the player. An absent player
    // must not spend everybody else's Dread.
    const room = makeRoom(["A", "B", "C"]);
    engine.startRun(room, "p0", NOW, rngFor(6));
    playOut(room, 6);
    for (const p of room.players) {
      expect(p.stats.scarsKept).toBe(0);
    }
  });
});

describe("what a player is allowed to do", () => {
  function toAct(seed = 12): Room {
    const room = makeRoom(["ALEX", "BEV", "CHRIS"]);
    engine.startRun(room, "p0", NOW, rngFor(seed));
    const rng = rngFor(seed);
    let now = NOW;
    for (let i = 0; i < 20 && room.phase !== "ACT"; i++) {
      now = room.phaseEndsAt! + 1;
      engine.tick(room, now, rng);
    }
    return room;
  }

  it("refuses a move out of phase, and a second move in one Act", () => {
    const room = toAct();
    expect(room.phase).toBe("ACT");
    const scene = room.act!.sceneId;
    expect(scene).toBeTruthy();
    const first = room.players[0];
    const approach = room.act!.choices;
    expect(Object.keys(approach)).toHaveLength(0);

    const id = SCENES_BY_ID[scene].approaches[0].id;
    engine.commitApproach(room, first.id, id, 0, room.phaseEndsAt! - 1);
    expect(() =>
      engine.commitApproach(room, first.id, id, 0, room.phaseEndsAt! - 1)
    ).toThrow(/already/i);
  });

  it("refuses a move from somebody who is not at the table", () => {
    const room = toAct();
    const id = SCENES_BY_ID[room.act!.sceneId].approaches[0].id;
    expect(() => engine.commitApproach(room, "ghost", id, 0, NOW)).toThrow(GameError);
  });

  it("refuses an approach that is not on offer", () => {
    const room = toAct();
    expect(() =>
      engine.commitApproach(room, room.players[0].id, "not-a-door", 0, room.phaseEndsAt! - 1)
    ).toThrow(/ways? through/i);
  });

  it("will not let you nominate yourself", () => {
    const room = toAct();
    expect(() => engine.nominate(room, "p0", "p0", NOW)).toThrow(/volunteering/i);
  });

  it("will not let you toast yourself at the Ballad", () => {
    const room = makeRoom(["A", "B"]);
    engine.startRun(room, "p0", NOW, rngFor(8));
    const rng = rngFor(8);
    for (let i = 0; i < 40 && room.phase !== "BALLAD"; i++) {
      engine.tick(room, room.phaseEndsAt! + 1, rng);
    }
    expect(room.phase).toBe("BALLAD");
    expect(() => engine.castLaurel(room, "p0", "p0", NOW)).toThrow(/yourself/i);
    engine.castLaurel(room, "p0", "p1", NOW);
    expect(room.players[0].laurelFor).toBe("p1");
  });
});

describe("the redacted view", () => {
  it("never ships another player's ranked wants", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(4));
    engine.tick(room, room.phaseEndsAt! + 1, rngFor(4));
    expect(room.phase).toBe("DRAFT_CALLING");
    const pool = room.callingDraft!.pool;
    engine.submitWants(room, "p1", [pool[0]], room.phaseEndsAt! - 1);

    const view = engine.viewFor(room, "p0");
    expect(view.callingDraft?.myWants).toEqual([]);
    expect(view.callingDraft?.committed).toContain("p1");
    // The whole wants map must not be reachable.
    expect((view.callingDraft as unknown as Record<string, unknown>).wants).toBeUndefined();
  });

  it("never ships a hidden Scar to anybody else, only a count", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(6));
    playOut(room, 6);
    const mine = engine.viewFor(room, "p0");
    const theirs = mine.players.find((p) => p.id === "p1")!;
    for (const s of theirs.scars) expect(s.kept).toBe(true);
    expect(theirs.hiddenScarCount).toBeGreaterThanOrEqual(0);
  });

  it("never ships a Laurel vote before the Ballad resolves", () => {
    const room = makeRoom(["A", "B"]);
    engine.startRun(room, "p0", NOW, rngFor(8));
    const rng = rngFor(8);
    for (let i = 0; i < 40 && room.phase !== "BALLAD"; i++) {
      engine.tick(room, room.phaseEndsAt! + 1, rng);
    }
    engine.castLaurel(room, "p1", "p0", NOW);
    const view = engine.viewFor(room, "p0");
    const them = view.players.find((p) => p.id === "p1")!;
    expect(them.hasVoted).toBe(true);
    expect((them as unknown as Record<string, unknown>).laurelFor).toBeUndefined();
  });

  it("never ships the rest of the deck", () => {
    const room = makeRoom(["A", "B"]);
    engine.startRun(room, "p0", NOW, rngFor(3));
    const rng = rngFor(3);
    for (let i = 0; i < 20 && room.phase !== "ACT"; i++) {
      engine.tick(room, room.phaseEndsAt! + 1, rng);
    }
    const view = engine.viewFor(room, "p0");
    expect(view.seenScenes).toHaveLength(1);
    expect((view as unknown as Record<string, unknown>).deck).toBeUndefined();
  });

  it("hides the Reckless target number until somebody pays for it", () => {
    const room = makeRoom(["A", "B"]);
    engine.startRun(room, "p0", NOW, rngFor(3));
    const rng = rngFor(3);
    for (let i = 0; i < 20 && room.phase !== "ACT"; i++) {
      engine.tick(room, room.phaseEndsAt! + 1, rng);
    }
    expect(engine.viewFor(room, "p0").act?.recklessTn).toBeNull();
  });
});

describe("a rematch", () => {
  it("clears the night but keeps the table", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(5));
    playOut(room, 5);
    expect(room.phase).toBe("FINAL");
    engine.rematch(room, "p0", NOW);
    expect(room.phase).toBe("WAITING");
    expect(room.players).toHaveLength(2);
    expect(room.dread).toBe(0);
    expect(room.standings).toBeUndefined();
    for (const p of room.players) {
      expect(p.renown).toBe(0);
      expect(p.scars).toEqual([]);
      expect(p.callingId).toBeNull();
    }
    expect(room.players[0].isHost).toBe(true);
  });

  it("is the host's call and nobody else's", () => {
    const room = makeRoom(["ALEX", "BEV"]);
    engine.startRun(room, "p0", NOW, rngFor(5));
    playOut(room, 5);
    expect(() => engine.rematch(room, "p1", NOW)).toThrow(/host/i);
  });
});
