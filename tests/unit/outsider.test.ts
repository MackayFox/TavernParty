/**
 * WHAT SOMEBODY WHO IS NOT AT THE TABLE IS ALLOWED TO SEE.
 *
 * `visibility: "private"` is offered to a host as a privacy setting, and all it
 * ever did was keep the table out of the lobby list. The polling read checked
 * membership nowhere, so anybody holding the six-character code -- off a
 * screenshot, a stream, a Discord scrollback -- pulled the full roster with
 * every player's ability scores, Calling, Blood, Kit, Renown and kept Scars,
 * plus the whole event log and the final standings, while remaining invisible to
 * everybody in the room.
 *
 * A code is a capability to JOIN, and it is shared like one. It is not a
 * capability to read the night off somebody's character sheet.
 *
 * These assertions are deliberately about absence, which is the awkward kind to
 * write and the only kind that catches a leak: a new field added to `PlayerView`
 * and forgotten in `outsiderView` is exactly the regression this file exists
 * for, so the last test walks the shape rather than naming fields.
 */
import { describe, expect, it } from "vitest";
import * as engine from "@/lib/game/engine";
import { HOOKS } from "@/lib/content/hooks";
import { ABILITIES } from "@/lib/game/types";
import { rngFor } from "./helpers";

const NOW = 1_000_000;

function playedRoom(visibility: "public" | "private") {
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility, settings: { acts: 3 } },
    NOW
  );
  ["ALEX", "BEV", "CHRIS"].forEach((n, i) =>
    engine.join(room, { id: `p${i}`, name: n }, NOW)
  );
  /**
   * Run the night out on deadlines, but fill in the sheets by hand at ASSIGN.
   *
   * A table that answers nothing never assigns, so every `scores` stays null and
   * an assertion that a stranger cannot read them passes without proving
   * anything. That is exactly the vacuous test this file is supposed not to be,
   * and the control below is what caught it.
   */
  const rng = rngFor(7);
  let now = NOW;
  // WAITING has no deadline, so without this the loop breaks on its first pass
  // and every assertion below is made against a table that never played. The
  // control test is what caught that.
  engine.startRun(room, "p0", now, rng);
  for (let i = 0; i < 400 && room.phase !== "FINAL"; i++) {
    if (room.phase === "ASSIGN") {
      const array = room.houseArray ?? [];
      for (const [n, player] of room.players.entries()) {
        const scores = Object.fromEntries(
          ABILITIES.map((a, j) => [a, array[j]])
        ) as Parameters<typeof engine.assign>[2];
        engine.assign(room, player.id, scores, HOOKS[n % HOOKS.length].id, now);
      }
    }
    if (room.phaseEndsAt === null) break;
    now = room.phaseEndsAt + 1;
    engine.tick(room, now, rng);
  }
  return room;
}

describe("a table somebody is not sitting at", () => {
  for (const visibility of ["public", "private"] as const) {
    describe(visibility, () => {
      const room = playedRoom(visibility);
      const inside = engine.viewFor(room, "p0");
      const outside = engine.viewFor(room, "stranger");

      it("gives a player at the table their night in full", () => {
        // The control. If this ever stops being true the redaction has gone too
        // far and the game is broken rather than merely private.
        expect(inside.me.id).toBe("p0");
        expect(inside.log.length).toBeGreaterThan(0);
        expect(inside.players.some((p) => p.scores !== null)).toBe(true);
      });

      it("still says enough to decide whether to join", () => {
        expect(outside.code).toBe("TAVERN");
        expect(outside.name).toBe("The Test");
        expect(outside.visibility).toBe(visibility);
        expect(outside.players).toHaveLength(3);
        expect(outside.players.map((p) => p.name)).toContain("BEV");
        expect(outside.settings.maxPlayers).toBe(room.settings.maxPlayers);
      });

      it("hands over nobody's character sheet", () => {
        for (const p of outside.players) {
          expect(p.scores, `${p.name} scores`).toBeNull();
          expect(p.callingId, `${p.name} calling`).toBeNull();
          expect(p.bloodId, `${p.name} blood`).toBeNull();
          expect(p.hookId, `${p.name} hook`).toBeNull();
          expect(p.kitIds, `${p.name} kit`).toHaveLength(0);
          expect(p.scars, `${p.name} scars`).toHaveLength(0);
          expect(p.hiddenScarCount, `${p.name} hidden scars`).toBe(0);
          expect(p.renown, `${p.name} renown`).toBe(0);
        }
      });

      it("hands over neither the night's log nor its ending", () => {
        expect(outside.log).toHaveLength(0);
        expect(outside.standings ?? []).toHaveLength(0);
        expect(outside.act).toBeNull();
        expect(outside.seenScenes).toHaveLength(0);
      });

      it("does not mistake the stranger for a player", () => {
        expect(outside.me.id).toBe("");
        expect(outside.me.canAct).toBe(false);
        expect(outside.me.scars).toHaveLength(0);
      });

      it("carries no scene prose anywhere in the payload", () => {
        /**
         * The shape walk. Named-field assertions above catch what was leaking on
         * the day this was written; this catches the next field somebody adds to
         * `PlayerView` and forgets to blank, because scene titles and outcome
         * prose are the highest-value thing in the room and they should not
         * appear anywhere in a stranger's copy of it.
         */
        const serialised = JSON.stringify(outside);
        for (const sceneId of room.deck) {
          expect(serialised, `deck entry ${sceneId} leaked`).not.toContain(sceneId);
        }
      });
    });
  }
});
