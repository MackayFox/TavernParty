/**
 * MUSTER — build a character, then find out whether it was the right one.
 *
 * SERVER ONLY: it computes par, so no client component imports it.
 *
 * Character creation as the whole game (GAME_DESIGN §7.4), because for a lot of
 * people it always was. The budget is the thing the live game already has: six
 * numbers rolled once for everybody, and the only question is where they go.
 * Add one Calling and one piece of kit and that is a build. Then tonight's five
 * doors, with tonight's five dice already thrown and published, decide whether
 * it was a good one.
 *
 * There is no luck left in it. Every die is known before you place a number, so
 * a score below par is a build decision and nothing else.
 *
 * Only the seven pieces of kit that carry an ability bonus are offered. The five
 * charge items (torches, rerolls, a mirror to look round a corner) do real work
 * in a live run and nothing at all in a night with no hidden numbers and no
 * second throws, and offering a choice that cannot matter is worse than offering
 * fewer choices.
 */
import { CALLINGS } from "@/lib/content/callings";
import { KIT } from "@/lib/content/kit";
import { SCENES } from "@/lib/content/scenes";
import { d20, rollScore } from "@/lib/game/random";
import {
  ABILITY_LABEL,
  AFFINITY_BONUS,
  ARRAY_DICE,
  ARRAY_DROP,
  ARRAY_SIZE,
  DIE_SIDES,
  abilityMod,
} from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";
import { clears, parPhrase, seededRng, seededShuffle } from "./core";

export const TRIALS = 5;

/**
 * Twelve nights, named after the place rather than the thing in it. A player
 * should be able to picture the job before they read a single number.
 */
const ENCOUNTERS = [
  "The Weir Gate",
  "The Long Cellar",
  "The Toll House",
  "The Drowned Yard",
  "The Bell Pit",
  "The Winter Fair",
  "The Sallow Crossing",
  "The Charcoal Stack",
  "The Lime Kiln",
  "The Barrow Field",
  "The Night Market",
  "The Quarry Road",
] as const;

export type Trial = {
  id: string;
  label: string;
  ability: Ability;
  tn: number;
  /** Already thrown, already published. */
  face: number;
};

export type CallingCard = {
  id: string;
  name: string;
  blurb: string;
  affinities: [Ability, Ability];
};

export type KitCard = {
  id: string;
  name: string;
  blurb: string;
  ability: Ability;
  value: number;
};

export type Puzzle = {
  date: string;
  encounter: string;
  /** The budget: six numbers, rolled once, the same for everybody. */
  array: number[];
  abilities: readonly Ability[];
  trials: Trial[];
  callings: CallingCard[];
  kit: KitCard[];
  sides: number;
};

export type Build = {
  /** `placement[i]` is which array slot goes to `abilities[i]`. */
  placement: number[];
  callingId: string;
  kitId: string;
};

// ---------------------------------------------------------------------------
// Building the night
// ---------------------------------------------------------------------------

const OFFERED_KIT: KitCard[] = KIT.filter((k) => k.bonus !== null).map((k) => ({
  id: k.id,
  name: k.name,
  blurb: k.blurb,
  ability: k.bonus!.ability,
  value: k.bonus!.value,
}));

const OFFERED_CALLINGS: CallingCard[] = CALLINGS.map((c) => ({
  id: c.id,
  name: c.name,
  blurb: c.blurb,
  affinities: c.affinities,
}));

const CACHE = new Map<string, Puzzle>();

export function puzzleFor(date: string): Puzzle {
  const cached = CACHE.get(date);
  if (cached) return cached;
  const built = build(date);
  CACHE.set(date, built);
  return built;
}

/**
 * The night has to be beatable and it must not be beatable outright.
 *
 * A set of five doors whose par is five is not a puzzle: any half-sensible build
 * clears everything and the score stops meaning anything. So candidate nights
 * are drawn in a seeded order and the first one whose par is two, three or four
 * is kept, which guarantees that at least one door cannot be answered and the
 * whole game is choosing which one to give up. Par is computed for each
 * candidate, which is forty thousand builds a candidate and cheap enough to do
 * a dozen times once a day.
 */
function build(date: string): Puzzle {
  const rand = seededRng("muster", date);
  const array = Array.from({ length: ARRAY_SIZE }, () => rollScore(ARRAY_DICE, ARRAY_DROP, rand));
  const encounter = ENCOUNTERS[Math.floor(rand() * ENCOUNTERS.length)];

  const pool = seededShuffle(
    SCENES.flatMap((scene) =>
      scene.approaches.map((a) => ({
        id: a.id,
        label: a.label,
        ability: a.ability,
        tn: a.tn,
        sceneId: scene.id,
      }))
    ),
    rand
  );

  let fallback: Puzzle | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const trials: Trial[] = [];
    const scenes = new Set<string>();
    const faces = Array.from({ length: TRIALS }, () => d20(rand));
    for (const candidate of pool) {
      if (trials.length === TRIALS) break;
      if (scenes.has(candidate.sceneId)) continue;
      scenes.add(candidate.sceneId);
      trials.push({
        id: candidate.id,
        label: candidate.label,
        ability: candidate.ability,
        tn: candidate.tn,
        face: faces[trials.length],
      });
    }
    // A different slice of the pool next time round, so the retry is a real one.
    pool.push(...pool.splice(0, 3));

    const puzzle: Puzzle = {
      date,
      encounter,
      array,
      abilities: ABILITIES,
      trials,
      callings: OFFERED_CALLINGS,
      kit: OFFERED_KIT,
      sides: DIE_SIDES,
    };
    fallback ??= puzzle;
    // computePar, not parFor: caching a candidate's par under this date would
    // hand the next candidate the previous one's answer.
    const { par } = computePar(puzzle);
    if (par >= 2 && par <= TRIALS - 1) return puzzle;
  }
  // Never seen in practice. A night that is merely easy beats no night at all.
  return fallback!;
}

// ---------------------------------------------------------------------------
// Resolving a build
// ---------------------------------------------------------------------------

export type TrialResult = {
  id: string;
  label: string;
  ability: Ability;
  face: number;
  tn: number;
  /** Named contributions, in the order they should be read. */
  mods: { label: string; value: number }[];
  total: number;
  cleared: boolean;
};

export type Result = { cleared: number; trials: TrialResult[] };

export function validBuild(puzzle: Puzzle, build: Build): boolean {
  return (
    build.placement.length === ARRAY_SIZE &&
    build.placement.every((s) => Number.isInteger(s) && s >= 0 && s < ARRAY_SIZE) &&
    new Set(build.placement).size === ARRAY_SIZE &&
    puzzle.callings.some((c) => c.id === build.callingId) &&
    puzzle.kit.some((k) => k.id === build.kitId)
  );
}

/** The six ability scores a placement produces. */
export function scoresOf(puzzle: Puzzle, placement: readonly number[]): Record<Ability, number> {
  const out = {} as Record<Ability, number>;
  puzzle.abilities.forEach((ability, i) => {
    out[ability] = puzzle.array[placement[i]] ?? 10;
  });
  return out;
}

/**
 * A trial is cleared on the same rule a live Act uses: a natural 20 always
 * succeeds, a natural 1 always fails, and everything in between is the ledger
 * against the target number.
 */
function resolve(
  trial: Trial,
  scores: Record<Ability, number>,
  calling: CallingCard,
  kit: KitCard
): TrialResult {
  const mods = [{ label: "d20", value: trial.face }];
  const mod = abilityMod(scores[trial.ability]);
  if (mod !== 0) mods.push({ label: ABILITY_LABEL[trial.ability], value: mod });
  if (calling.affinities.includes(trial.ability))
    mods.push({ label: `trained: ${calling.name.toLowerCase()}`, value: AFFINITY_BONUS });
  if (kit.ability === trial.ability)
    mods.push({ label: kit.name.toLowerCase(), value: kit.value });

  const total = mods.reduce((sum, m) => sum + m.value, 0);
  // Shared with the door labels on the page, so what the build promises and what
  // the night pays are the same sentence.
  const cleared = clears(trial.face, total, trial.tn);
  return {
    id: trial.id,
    label: trial.label,
    ability: trial.ability,
    face: trial.face,
    tn: trial.tn,
    mods,
    total,
    cleared,
  };
}

export function play(puzzle: Puzzle, build: Build): Result {
  const calling = puzzle.callings.find((c) => c.id === build.callingId)!;
  const kit = puzzle.kit.find((k) => k.id === build.kitId)!;
  const scores = scoresOf(puzzle, build.placement);
  const trials = puzzle.trials.map((t) => resolve(t, scores, calling, kit));
  return { cleared: trials.filter((t) => t.cleared).length, trials };
}

/**
 * Par: the most doors any build can clear, by exhaustive search over every
 * placement, every Calling and every piece of kit. Seven hundred and twenty
 * placements times eight times seven, which is forty thousand builds and about
 * as long as one database round trip. Cached per date.
 */
const PARS = new Map<string, { par: number; best: Build }>();

export function parFor(puzzle: Puzzle): { par: number; best: Build } {
  const cached = PARS.get(puzzle.date);
  if (cached) return cached;
  const result = computePar(puzzle);
  PARS.set(puzzle.date, result);
  return result;
}

function computePar(puzzle: Puzzle): { par: number; best: Build } {
  let par = -1;
  let best: Build = { placement: [0, 1, 2, 3, 4, 5], callingId: puzzle.callings[0].id, kitId: puzzle.kit[0].id };

  for (const placement of permutations(ARRAY_SIZE)) {
    const scores = scoresOf(puzzle, placement);
    for (const calling of puzzle.callings) {
      for (const kit of puzzle.kit) {
        let cleared = 0;
        for (const trial of puzzle.trials) {
          if (resolve(trial, scores, calling, kit).cleared) cleared++;
        }
        if (cleared > par) {
          par = cleared;
          best = { placement: [...placement], callingId: calling.id, kitId: kit.id };
          // Nothing can beat clearing everything, so stop looking.
          if (par === puzzle.trials.length) return { par, best };
        }
      }
    }
  }

  return { par, best };
}

/** All orderings of 0..n-1. Built once per size and reused. */
const PERM_CACHE = new Map<number, number[][]>();
function permutations(n: number): number[][] {
  const cached = PERM_CACHE.get(n);
  if (cached) return cached;
  const out: number[][] = [];
  const walk = (left: number[], acc: number[]) => {
    if (left.length === 0) {
      out.push([...acc]);
      return;
    }
    for (let i = 0; i < left.length; i++) {
      acc.push(left[i]);
      walk([...left.slice(0, i), ...left.slice(i + 1)], acc);
      acc.pop();
    }
  };
  walk(
    Array.from({ length: n }, (_, i) => i),
    []
  );
  PERM_CACHE.set(n, out);
  return out;
}

export function shareText(date: string, result: Result, par: number, encounter: string): string {
  const grid = result.trials.map((t) => (t.cleared ? "🟩" : "🟥")).join("");
  return [
    `MUSTER ${date}`,
    `${encounter}: ${result.cleared} of ${result.trials.length}, ${parPhrase(result.cleared, par)}`,
    grid,
    "tavernparty.co.uk/daily/muster",
  ].join("\n");
}
