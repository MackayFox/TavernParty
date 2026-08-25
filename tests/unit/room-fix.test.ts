/**
 * The room screens, held to the engine they are describing.
 *
 * Every failure here was a screen printing a number that was not the number the
 * server was about to use: the solo Dread thresholds over a six-handed table,
 * a flinch cost with the Mark added on unmultiplied, a target number worked out
 * without the Signature the player had just spent, and a Scar count that
 * counted the wounds you had hidden as wounds you were wearing.
 *
 * Nothing here renders anything. The room components export the arithmetic they
 * used to do inline, and these tests run it against the engine's own functions
 * rather than against transcribed figures, so the two cannot drift apart
 * quietly.
 */
import { describe, expect, it } from "vitest";
import { flinchCost, reachParts } from "@/components/room/Act";
import { autoSlots, suggestedHookId } from "@/components/room/Assign";
import { dreadReading, scarTally } from "@/components/room/shared";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { SCENES } from "@/lib/content/scenes";
import { faceNeeded } from "@/lib/daily/core";
import { costMultiplier, flinch, sumLedger } from "@/lib/game/resolve";
import {
  DREAD_DOUBLE_AT,
  DREAD_MAX,
  DREAD_TURN_AT,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKEN_VALUE,
  MARK_FLINCH_PENALTY,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SIGNATURE_BOOST,
  abilityMod,
  dreadThresholds,
} from "@/lib/game/rules";
import { ABILITIES, type Player, type PlayerView, type Scar } from "@/lib/game/types";

const TABLE_SIZES = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, i) => MIN_PLAYERS + i
);

// ---------------------------------------------------------------------------
// The Dread meter
// ---------------------------------------------------------------------------

describe("the Dread meter reads this table's thresholds", () => {
  it("matches dreadThresholds at every legal table size", () => {
    for (const players of TABLE_SIZES) {
      const engine = dreadThresholds(players);
      const shown = dreadReading(0, players);
      expect({ double: shown.double, turn: shown.turn, max: shown.max }).toEqual(engine);
    }
  });

  it("does not print the solo figures at a full table", () => {
    const shown = dreadReading(0, MAX_PLAYERS);
    // The whole finding: these three constants are the one-player numbers and
    // the meter was printing them over everybody's game.
    expect(shown.double).not.toBe(DREAD_DOUBLE_AT);
    expect(shown.turn).not.toBe(DREAD_TURN_AT);
    expect(shown.max).not.toBe(DREAD_MAX);
  });

  it("only says everything costs more when the engine agrees", () => {
    const scene = SCENES[0];
    for (const players of TABLE_SIZES) {
      for (let dread = 0; dread <= dreadThresholds(players).max; dread++) {
        const doubled =
          costMultiplier({ calling: undefined, scene, dread, players }) > 1;
        expect(dreadReading(dread, players).doubled).toBe(doubled);
      }
    }
  });

  it("turns the night exactly where beginAct would", () => {
    for (const players of TABLE_SIZES) {
      const { turn } = dreadThresholds(players);
      expect(dreadReading(turn - 1, players).turned).toBe(false);
      expect(dreadReading(turn, players).turned).toBe(true);
      expect(dreadReading(turn, players).state).toBe("The night has turned");
    }
  });
});

// ---------------------------------------------------------------------------
// What flinching costs
// ---------------------------------------------------------------------------

/** Just enough of a Player for `flinch`, which reads the id and nothing else. */
function bare(id: string): Player {
  return { id, name: id, hookTokens: 0, scores: null } as unknown as Player;
}

describe("what the Act screen says flinching costs", () => {
  /** A scene that is somebody's Failing, so the 4x case is a real one. */
  const failing = CALLINGS.map((c) => ({
    calling: c,
    scene: SCENES.find((s) => s.tags.includes(c.failing.tag)),
  })).find((x) => !!x.scene)!;

  it("agrees with resolve.flinch, Marked or not, at every table size", () => {
    for (const players of TABLE_SIZES) {
      for (const dread of [0, dreadThresholds(players).double]) {
        for (const calling of [undefined, failing.calling]) {
          for (const marked of [false, true]) {
            const scene = failing.scene!;
            const shown = flinchCost({ calling, scene, dread, players, marked });
            // The engine's own path: resolveAct multiplies with `players` and
            // with no approach, then hands that to `flinch`.
            const engine = flinch(
              bare("p1"),
              scene,
              marked,
              {
                renown: FLINCH_RENOWN,
                dread: FLINCH_DREAD,
                markPenalty: MARK_FLINCH_PENALTY,
              },
              costMultiplier({ calling, scene, dread, players })
            );
            expect(shown.renown).toBe(Math.abs(engine.renownDelta));
            expect(shown.dread).toBe(engine.dreadDelta);
          }
        }
      }
    }
  });

  it("reads the table's doubling threshold, not the solo one", () => {
    const scene = SCENES[0];
    // Dread 5 at a table of six. The solo threshold is 3, so a multiplier
    // worked out without `players` doubles here; the engine's is 8 and does not.
    expect(DREAD_DOUBLE_AT).toBeLessThan(5);
    expect(dreadThresholds(6).double).toBeGreaterThan(5);
    expect(flinchCost({ calling: undefined, scene, dread: 5, players: 6, marked: false })
      .multiplier).toBe(1);
    expect(costMultiplier({ calling: undefined, scene, dread: 5 })).toBe(2);
  });

  it("multiplies the Mark rather than adding it on at face value", () => {
    const scene = failing.scene!;
    const players = MIN_PLAYERS;
    const worst = flinchCost({
      calling: failing.calling,
      scene,
      dread: dreadThresholds(players).double,
      players,
      marked: true,
    });
    expect(worst.multiplier).toBe(4);
    expect(worst.renown).toBe(8);
    // The old screen printed abs(FLINCH_RENOWN) * mult and then offered the Mark
    // as "1 more" in a following sentence: 4 and 1, for a move that takes 8.
    expect(Math.abs(FLINCH_RENOWN) * worst.multiplier + MARK_FLINCH_PENALTY).not.toBe(
      worst.renown
    );
  });
});

// ---------------------------------------------------------------------------
// The face each door needs
// ---------------------------------------------------------------------------

describe("the number the Act screen says the die has to beat", () => {
  const label = "EVERYONE JOINS IN";

  it("counts a Signature that is already on the table", () => {
    const withBet = reachParts({ bonus: 3, spending: 0, boost: SIGNATURE_BOOST, signatureLabel: label });
    const without = reachParts({ bonus: 3, spending: 0, boost: 0 });
    expect(sumLedger(withBet)).toBe(sumLedger(without) + SIGNATURE_BOOST);
    // Which is the whole point: the door moves by five, so the face does too.
    expect(faceNeeded(18, sumLedger(withBet))).toBe(faceNeeded(18, sumLedger(without)) - SIGNATURE_BOOST);
  });

  it("counts the Hook tokens going onto the roll", () => {
    const parts = reachParts({ bonus: 2, spending: 2, boost: 0 });
    expect(sumLedger(parts)).toBe(2 + 2 * HOOK_TOKEN_VALUE);
  });

  it("names every part rather than printing one figure", () => {
    const parts = reachParts({ bonus: 1, spending: 1, boost: SIGNATURE_BOOST, signatureLabel: label });
    expect(parts.map((p) => p.label)).toEqual(["you", "1 Hook token", "everyone joins in"]);
    expect(sumLedger(parts)).toBe(1 + HOOK_TOKEN_VALUE + SIGNATURE_BOOST);
  });

  it("never promises a face a natural 1 would keep", () => {
    // `faceNeeded` floors at 2 and caps at 20. The screen used to clamp to 1 and
    // 20, so an easy door was labelled "a 1 or better" on a game where a 1
    // always fails.
    expect(faceNeeded(4, 20)).toBe(2);
    expect(faceNeeded(40, 0)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// The party rail's Scar counts
// ---------------------------------------------------------------------------

function scar(id: string, kept: boolean | null): Scar {
  return { id, sceneId: "s", label: id, kept };
}

/** A view of yourself: `viewFor` hands you your whole pile, decided or not. */
function meWith(scars: Scar[]): PlayerView {
  return {
    scars,
    hiddenScarCount: scars.filter((s) => s.kept === false).length,
  } as unknown as PlayerView;
}

describe("the party rail counts Scars the way the Ballad will", () => {
  it("does not count your own hidden or undecided wounds as kept", () => {
    const tally = scarTally(
      meWith([scar("a", true), scar("b", false), scar("c", null), scar("d", false)])
    );
    expect(tally).toEqual({ kept: 1, hidden: 2, undecided: 1 });
    // The bug, stated: the rail printed scars.length as "Scars kept", so the two
    // hidden ones were worn AND said nothing about, and the undecided one was
    // worn before it had been decided.
    expect(tally.kept).not.toBe(4);
  });

  it("still counts everybody else correctly, whose list is kept-only", () => {
    const them = {
      scars: [scar("a", true), scar("b", true)],
      hiddenScarCount: 3,
    } as unknown as PlayerView;
    expect(scarTally(them)).toEqual({ kept: 2, hidden: 3, undecided: 0 });
  });
});

// ---------------------------------------------------------------------------
// ASSIGN opens on a whole character
// ---------------------------------------------------------------------------

describe("the sheet ASSIGN opens on", () => {
  const array = [16, 15, 13, 12, 10, 8];

  it("puts the best numbers on what the Calling is trained for", () => {
    for (const calling of CALLINGS) {
      const slots = autoSlots(array, calling);
      // Every box filled, nothing invented, nothing thrown away: the same
      // contract the server checks on hand-in.
      const placed = ABILITIES.map((a) => slots[a]);
      expect(placed.every((i) => i !== null)).toBe(true);
      expect(new Set(placed).size).toBe(array.length);
      const values = placed.map((i) => array[i!]).sort((x, y) => x - y);
      expect(values).toEqual([...array].sort((x, y) => x - y));

      const trained = calling.affinities.map((a) => array[slots[a]!]);
      const rest = ABILITIES.filter((a) => !calling.affinities.includes(a)).map(
        (a) => array[slots[a]!]
      );
      expect(Math.min(...trained)).toBeGreaterThanOrEqual(Math.max(...rest));
      // And the two top boxes are worth something on a roll, which is the whole
      // reason a first-timer can leave this alone and still have a character.
      expect(Math.min(...trained.map(abilityMod))).toBeGreaterThan(0);
    }
  });

  it("suggests a real Hook, the same one every render, and spreads them" , () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    for (const id of ids) {
      const suggestion = suggestedHookId(id);
      expect(HOOKS.some((h) => h.id === suggestion)).toBe(true);
      expect(suggestedHookId(id)).toBe(suggestion);
    }
    // Not everybody defaulting to HOOKS[0]: the twenty insert tags are a
    // permutation of the tag vocabulary, so a table that all took the same past
    // would build its deck out of one problem repeated.
    expect(new Set(ids.map(suggestedHookId)).size).toBeGreaterThan(1);
  });
});

describe("no answer in the bundle", () => {
  /**
   * THE LEAK THIS GUARDS.
   *
   * `Act.tsx` and `Result.tsx` are client components and they imported
   * `SCENES_BY_ID`, so every scene in the game shipped in the JavaScript bundle:
   * all thirty of them, their outcome prose, and every hidden Reckless target
   * number. The server redacted `recklessTn` scrupulously, the UI honoured it,
   * and the number was in devtools the whole time.
   *
   * That is not cosmetic. The Torch, Longshank's seeOneReckless and the
   * Reckoner's Signature all SELL that number, so a player who opened the bundle
   * got three of the game's rewards for nothing.
   *
   * A source-level assertion rather than a bundle one, because it fails in the
   * right place: the moment somebody adds the import, not twenty minutes later in
   * a size report nobody reads.
   */
  const CLIENT_FILES = [
    "components/room/Act.tsx",
    "components/room/Result.tsx",
    "components/room/Draft.tsx",
    "components/room/Assign.tsx",
    "components/room/Ending.tsx",
    "components/room/Lobby.tsx",
    "components/room/shared.tsx",
    "app/room/[code]/RoomClient.tsx",
  ];

  it("keeps the scenes out of every client component in the room", async () => {
    const { readFileSync } = await import("node:fs");
    const guilty: string[] = [];
    for (const file of CLIENT_FILES) {
      const src = readFileSync(file, "utf8");
      if (/from "@\/lib\/content\/scenes"/.test(src)) guilty.push(file);
    }
    expect(guilty).toEqual([]);
  });

  it("hides the Reckless number in the view until it is bought", async () => {
    const engine = await import("@/lib/game/engine");
    const { SCENES_BY_ID } = await import("@/lib/content/scenes");
    const { rngFor } = await import("./helpers");

    const now = Date.UTC(2026, 7, 25, 20, 0, 0);
    const room = engine.createRoom(
      { code: "TAVERN", name: "The Test", visibility: "public", settings: {} },
      now
    );
    for (const [i, name] of ["ALEX", "BEV", "CHRIS"].entries()) {
      engine.join(room, { id: `p${i}`, name }, now);
    }
    engine.startRun(room, "p0", now, rngFor(12));
    const rng = rngFor(12);
    let clock = now;
    for (let i = 0; i < 20 && room.phase !== "ACT"; i++) {
      clock = room.phaseEndsAt! + 1;
      engine.tick(room, clock, rng);
    }
    expect(room.phase).toBe("ACT");

    const reckless = SCENES_BY_ID[room.act!.sceneId].approaches.find((a) => a.reckless)!;
    const view = engine.viewFor(room, "p0");
    const payload = JSON.stringify(view);

    expect(view.act?.recklessTn).toBeNull();
    // The number itself, in the one place it could hide now that the scene comes
    // down with the view.
    expect(view.act?.scene.approaches.find((a) => a.reckless)?.tn).toBeNull();
    // And no outcome prose before there are outcomes.
    expect(payload).not.toContain(reckless.win);
    expect(payload).not.toContain(reckless.lose);
    // The safe doors keep their numbers: this is a bet, not a riddle.
    const safe = view.act!.scene.approaches.filter((a) => !a.reckless);
    expect(safe.length).toBeGreaterThan(0);
    for (const a of safe) expect(typeof a.tn).toBe("number");
  });
});
