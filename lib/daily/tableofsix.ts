/**
 * TABLE OF SIX — six rolls, six obstacles, one assignment.
 *
 * SERVER ONLY: it can compute the optimum, so no client component imports it.
 *
 * The one daily with no fiction in it at all (GAME_DESIGN §7.2). Six d20 results
 * are thrown once for the whole world and published, six obstacles each carry a
 * target number, and you give exactly one roll to each. That is the entire game.
 *
 * The optimum is found by walking all 720 permutations, which is both the honest
 * answer and cheaper than being clever about it. It is genuinely not a greedy
 * problem: a natural 20 clears anything and a natural 1 clears nothing, so the
 * best line usually involves deciding which obstacle to feed the 1 to rather
 * than which one to win.
 */
import { SCENES } from "@/lib/content/scenes";
import { CRIT, DIE_SIDES, FUMBLE } from "@/lib/game/rules";
import { d20 } from "@/lib/game/random";
import type { Ability } from "@/lib/game/types";
import { parPhrase, seededRng, seededShuffle } from "./core";

export const SLOTS = 6;

export type Obstacle = {
  id: string;
  label: string;
  ability: Ability;
  /** Meet or beat it and the obstacle pays. */
  tn: number;
  /** What clearing it is worth. */
  deed: number;
  /** What failing it costs. */
  cost: number;
};

export type Puzzle = {
  date: string;
  /** Six d20 faces, in the order they were thrown. Identical worldwide. */
  faces: number[];
  obstacles: Obstacle[];
  sides: number;
};

/**
 * Six obstacles with six different target numbers, from six different scenes.
 *
 * Distinct target numbers are the only real constraint: two obstacles with the
 * same number and different rewards make one of them strictly pointless, and the
 * puzzle loses a decision. The pool is ninety approaches across thirty scenes,
 * so a greedy pass off a seeded shuffle always fills it.
 */
export function puzzleFor(date: string): Puzzle {
  const rand = seededRng("tableofsix", date);
  const pool = seededShuffle(
    SCENES.flatMap((scene) =>
      scene.approaches.map((a) => ({
        id: a.id,
        label: a.label,
        ability: a.ability,
        tn: a.tn,
        deed: a.deed,
        cost: a.cost.renown,
        sceneId: scene.id,
      }))
    ),
    rand
  );

  const obstacles: Obstacle[] = [];
  const tns = new Set<number>();
  const scenes = new Set<string>();
  for (const candidate of pool) {
    if (obstacles.length === SLOTS) break;
    if (tns.has(candidate.tn) || scenes.has(candidate.sceneId)) continue;
    tns.add(candidate.tn);
    scenes.add(candidate.sceneId);
    const { sceneId: _sceneId, ...obstacle } = candidate;
    obstacles.push(obstacle);
  }

  return {
    date,
    faces: Array.from({ length: SLOTS }, () => d20(rand)),
    obstacles: seededShuffle(obstacles, rand),
    sides: DIE_SIDES,
  };
}

/**
 * What one roll is worth against one obstacle. A natural 20 always succeeds and
 * a natural 1 always fails, exactly as in a live Act, which is what stops the
 * whole thing being a sorting exercise.
 */
export function valueOf(face: number, obstacle: Obstacle): number {
  const cleared = face === CRIT ? true : face === FUMBLE ? false : face >= obstacle.tn;
  return cleared ? obstacle.deed : -obstacle.cost;
}

export type Line = { obstacleId: string; face: number; slot: number; cleared: boolean; value: number };
export type Result = { total: number; lines: Line[] };

/**
 * Score an assignment. `slots[i]` is which die (by its published position) goes
 * to `obstacles[i]`, so the client only ever sends six small integers and the
 * server does not have to trust a face value it was told.
 */
export function score(puzzle: Puzzle, slots: readonly number[]): Result {
  const lines = puzzle.obstacles.map((obstacle, i) => {
    const slot = slots[i];
    const face = puzzle.faces[slot];
    const value = valueOf(face, obstacle);
    return {
      obstacleId: obstacle.id,
      face,
      slot,
      cleared: value > 0,
      value,
    };
  });
  return { total: lines.reduce((sum, l) => sum + l.value, 0), lines };
}

/** Exactly six distinct slot indexes, and nothing else. */
export function validSlots(slots: readonly number[]): boolean {
  return (
    slots.length === SLOTS &&
    slots.every((s) => Number.isInteger(s) && s >= 0 && s < SLOTS) &&
    new Set(slots).size === SLOTS
  );
}

/**
 * The optimum, over all 720 permutations. Cached per date: it is a pure function
 * of the puzzle and every player on a given day asks the same question.
 */
const OPTIMA = new Map<string, { par: number; best: number[] }>();

export function parFor(puzzle: Puzzle): { par: number; best: number[] } {
  const cached = OPTIMA.get(puzzle.date);
  if (cached) return cached;

  let par = -Infinity;
  let best: number[] = [];
  const slots: number[] = [];
  const used = Array<boolean>(SLOTS).fill(false);

  const walk = (i: number, running: number) => {
    if (i === SLOTS) {
      if (running > par) {
        par = running;
        best = [...slots];
      }
      return;
    }
    for (let slot = 0; slot < SLOTS; slot++) {
      if (used[slot]) continue;
      used[slot] = true;
      slots.push(slot);
      walk(i + 1, running + valueOf(puzzle.faces[slot], puzzle.obstacles[i]));
      slots.pop();
      used[slot] = false;
    }
  };
  walk(0, 0);

  const result = { par, best };
  OPTIMA.set(puzzle.date, result);
  return result;
}

/** The assignment the player is handed to start from. Dice in published order. */
export function startingSlots(): number[] {
  return Array.from({ length: SLOTS }, (_, i) => i);
}

export function shareText(date: string, result: Result, par: number): string {
  const grid = result.lines.map((l) => (l.cleared ? "🟩" : "🟥")).join("");
  return [
    `TABLE OF SIX ${date}`,
    `${result.total}, ${parPhrase(result.total, par)}`,
    grid,
    "tavernparty.co.uk/daily/tableofsix",
  ].join("\n");
}
