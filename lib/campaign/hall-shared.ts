/**
 * The two bits of the Hall that a client component is allowed to know.
 *
 * Split out of `hall.ts` because that file imports the Supabase service-role
 * client, and anything a browser bundle touches must never reach it. This is
 * pure arithmetic and one number, so both sides can share it honestly instead of
 * the UI hardcoding a copy of the threshold that drifts.
 */

/** Below this many finishers a dungeon is New, not ranked. */
export const MIN_FINISHERS = 5;

/**
 * Wilson lower bound on marks per finisher, z = 1.96.
 *
 * Not marks per play, which punishes a hard dungeon for being hard by counting
 * everybody who died against it. Not a raw count, which is a popularity ratchet
 * where the first thing seen wins forever. And not a plain average, which lets
 * one mark out of one finisher sit above forty out of fifty. The lower bound of
 * the interval is the whole point: it asks how confident we are, not how lucky.
 */
export function wilson(marks: number, finishers: number): number {
  if (finishers <= 0) return 0;
  const p = marks / finishers;
  const z = 1.96;
  const z2 = z * z;
  return (
    (p + z2 / (2 * finishers) - z * Math.sqrt((p * (1 - p) + z2 / (4 * finishers)) / finishers)) /
    (1 + z2 / finishers)
  );
}
