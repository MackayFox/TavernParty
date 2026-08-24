/**
 * Rolling an Act, and building the ledger that narrates it.
 *
 * THE LEDGER IS THE POINT. Nothing here ever produces a bare total: it produces
 * a list of named contributions, in the order they should be read aloud, and the
 * total is their sum. That is the entire narration budget of the game. Modifiers
 * are `{ label, value }` objects, so prose comes out of a join rather than out of
 * an author writing an outcome for every combination of scene and approach.
 *
 * Pure, with the die injected, so every roll in a test is pinned and the dailies
 * can replay a night exactly.
 */
import { ABILITY_LABEL, AFFINITY_BONUS, CRIT, DREAD_DOUBLE_AT, FUMBLE, HOOK_TOKEN_VALUE, abilityMod } from "./rules";
import { d20, type Rng } from "./random";
import type {
  ApproachDef,
  Calling,
  KitItem,
  Modifier,
  Outcome,
  Player,
  Scar,
  Scene,
} from "./types";

export type RollContext = {
  player: Player;
  calling: Calling | undefined;
  kit: readonly KitItem[];
  scene: Scene;
  approach: ApproachDef;
  /** How many Hook tokens the player chose to spend. Clamped to what they hold. */
  spendTokens: number;
  /** Collective Dread at the moment of the roll. */
  dread: number;
  /** True when this scene carries the tag that refills their Hook. */
  hookCalled: boolean;
};

/**
 * Everything that adds to a roll, named.
 *
 * Order matters: this is read top to bottom in the UI, so it goes die, then who
 * you are, then what you are carrying, then what you spent. A player should be
 * able to see the sentence "I was always going to make that" in the list.
 */
export function ledgerFor(ctx: RollContext, face: number): Modifier[] {
  const { player, calling, kit, approach, spendTokens } = ctx;
  const mods: Modifier[] = [{ label: `d20`, value: face }];

  const scores = player.scores;
  if (scores) {
    const mod = abilityMod(scores[approach.ability]);
    if (mod !== 0) mods.push({ label: ABILITY_LABEL[approach.ability], value: mod });
  }

  if (calling && calling.affinities.includes(approach.ability)) {
    mods.push({ label: `trained: ${calling.name.toLowerCase()}`, value: AFFINITY_BONUS });
  }

  for (const item of kit) {
    if (item.bonus && item.bonus.ability === approach.ability) {
      mods.push({ label: item.name.toLowerCase(), value: item.bonus.value });
    }
  }

  const tokens = Math.max(0, Math.min(spendTokens, player.hookTokens));
  if (tokens > 0) {
    mods.push({
      label: tokens === 1 ? "you have done this before" : "you have done this many times",
      value: tokens * HOOK_TOKEN_VALUE,
    });
  }

  return mods;
}

export function sumLedger(mods: readonly Modifier[]): number {
  return mods.reduce((total, m) => total + m.value, 0);
}

/**
 * What failing costs.
 *
 * Two multipliers, both on the consequence side rather than the roll. A roll
 * penalty feels like being told you are bad at something; a doubled cost feels
 * like the situation being worse, which is the same arithmetic and a better
 * feeling.
 *
 * - Your Calling's Failing tag on this scene doubles it, because this is
 *   specifically your weakness. Applies to every line, including the Reckless
 *   one: your weakness is your weakness.
 * - Dread at or above the threshold doubles it for everybody, EXCEPT on the
 *   Reckless line.
 *
 * That exception is not a kindness, it is a fix. The Reckless line already
 * carries the worst cost in the scene for a fixed reward, so doubling it as
 * Dread climbs made the one contested door in the game strictly worse precisely
 * in the Acts where the table is arguing about who takes it. Exclusivity,
 * nomination and the hidden target number all hang off somebody wanting that
 * door, and a review found it was worse than both safe lines in all thirty
 * scenes. Dread still bites everywhere else, so cowardice is still taxed.
 */
export function costMultiplier(
  ctx: Pick<RollContext, "calling" | "scene" | "dread"> & { approach?: { reckless: boolean } }
): number {
  let mult = 1;
  if (ctx.calling && ctx.scene.tags.includes(ctx.calling.failing.tag)) mult *= 2;
  if (ctx.dread >= DREAD_DOUBLE_AT && !ctx.approach?.reckless) mult *= 2;
  return mult;
}

/** A short, physical wound named after the scene that caused it. */
export function scarFor(scene: Scene, approach: ApproachDef, index: number): Scar {
  return {
    id: `${scene.id}-${approach.id}-${index}`,
    sceneId: scene.id,
    label: approach.lose,
    kept: null,
  };
}

/**
 * Roll one player's Approach.
 *
 * A natural 20 always succeeds and a natural 1 always fails, whatever the
 * ledger says, because a game about dice needs the die to be able to matter.
 */
export function rollApproach(ctx: RollContext, index: number, rng: Rng): Outcome {
  const face = d20(rng);
  const mods = ledgerFor(ctx, face);
  const total = sumLedger(mods);

  const crit = face === CRIT;
  const fumble = face === FUMBLE;
  const success = crit ? true : fumble ? false : total >= ctx.approach.tn;

  const mult = costMultiplier({ ...ctx, approach: ctx.approach });
  const renownDelta = success
    ? ctx.approach.deed
    : -ctx.approach.cost.renown * mult;
  const dreadDelta = success ? 0 : ctx.approach.cost.dread * mult;

  return {
    playerId: ctx.player.id,
    approachId: ctx.approach.id,
    roll: face,
    mods,
    total,
    tn: ctx.approach.tn,
    success,
    renownDelta,
    dreadDelta,
    scar: success ? null : scarFor(ctx.scene, ctx.approach, index),
    hookRefilled: ctx.hookCalled,
  };
}

/**
 * The deadline default.
 *
 * Not a skip, not a stall, not a bot playing for you: a real move that scores
 * badly and taxes the party. An absent player becomes a problem the table can
 * see and reason about, rather than a phase that hangs.
 */
export function flinch(
  player: Player,
  scene: Scene,
  marked: boolean,
  penalties: { renown: number; dread: number; markPenalty: number },
  /**
   * Flinching scales with the night going badly, exactly like every other cost.
   *
   * It used to be flat, which made it the arithmetically correct move as soon as
   * Dread crossed the threshold: a failed middle line cost four to six Renown
   * while not moving cost one. That is the precise opposite of the design, which
   * needs "everybody flinches" to be an unstable equilibrium.
   */
  multiplier = 1
): Outcome {
  const renown = (penalties.renown - (marked ? penalties.markPenalty : 0)) * multiplier;
  return {
    playerId: player.id,
    approachId: "flinch",
    roll: 0,
    mods: [{ label: "you did not move", value: 0 }],
    total: 0,
    tn: 0,
    success: false,
    renownDelta: renown,
    dreadDelta: penalties.dread * multiplier,
    scar: null,
    hookRefilled: false,
  };
}
