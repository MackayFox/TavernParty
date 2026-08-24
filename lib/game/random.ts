/**
 * Randomness, injectable so the engine stays testable.
 *
 * The engine never calls Math.random directly: every entry point takes an
 * optional `rng` so a test can pin every die roll, card draw and shuffle.
 */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Fisher-Yates. Returns a new array. */
export function shuffle<T>(arr: readonly T[], rng: Rng = defaultRng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(arr: readonly T[], rng: Rng = defaultRng): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Weighted pick. Items without a weight count as 1. Never returns undefined
 *  for a non-empty array. */
export function pickWeighted<T extends { weight?: number }>(
  arr: readonly T[],
  rng: Rng = defaultRng
): T | undefined {
  if (arr.length === 0) return undefined;
  const total = arr.reduce((sum, item) => sum + Math.max(0, item.weight ?? 1), 0);
  if (total <= 0) return arr[0];
  let roll = rng() * total;
  for (const item of arr) {
    roll -= Math.max(0, item.weight ?? 1);
    if (roll < 0) return item;
  }
  return arr[arr.length - 1];
}

/** A single six-sided die. */
export function d6(rng: Rng = defaultRng): number {
  return 1 + Math.floor(rng() * 6);
}

/** Integer in [min, max] inclusive. */
export function intBetween(min: number, max: number, rng: Rng = defaultRng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A twenty-sided die. The only die this game rolls in play. */
export function d20(rng: Rng = defaultRng): number {
  return 1 + Math.floor(rng() * 20);
}

/**
 * One ability score: roll `dice` six-sided dice, drop the lowest `drop`, sum the
 * rest. Rolled once per array slot, and the resulting array is shared by the
 * whole room, so the variance is a feature rather than a fairness problem.
 */
export function rollScore(dice: number, drop: number, rng: Rng = defaultRng): number {
  const faces: number[] = [];
  for (let i = 0; i < dice; i++) faces.push(d6(rng));
  faces.sort((a, b) => a - b);
  return faces.slice(drop).reduce((sum, f) => sum + f, 0);
}
