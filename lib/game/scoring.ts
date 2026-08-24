/**
 * The Ballad. Who walks out with the Hoard.
 *
 * Pure, so the whole ending can be asserted in a unit test rather than played to.
 */
import {
  KEPT_SCAR_NEEDS_MEDIAN,
  KEPT_SCAR_VALUE,
  LAUREL_VALUE,
} from "./rules";
import type { Player, Standing } from "./types";

/**
 * The middle of the table, taking the UPPER of the two middles on an even count.
 *
 * Not a rounding preference, a correctness one. The gate below only bites if
 * being "at the median" is something you can fail, and with the lower middle the
 * bottom player of a two-person table is always at it, so the clamp did nothing
 * at exactly the table size where the degenerate strategy is easiest to run. A
 * unit test caught this before any of it shipped.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length - 1) / 2)];
}

/**
 * Final standings.
 *
 * Kept Scars pay only at or above the table median Renown. That gate is the
 * anti-degenerate clamp: without it the winning line is to never take a risk,
 * collect cheap Scars and keep all of them, which is the failure mode every
 * consequence economy has and the one that makes a game feel broken once
 * somebody notices it.
 *
 * Laurels are a secret vote worth eight, and they exist so the player who is out
 * of contention by Act IV still holds something the leaders want.
 */
export function standingsFor(players: readonly Player[]): Standing[] {
  const renowns = players.map((p) => p.renown);
  const gate = median(renowns);

  const laurelCounts = new Map<string, number>();
  for (const voter of players) {
    const target = voter.laurelFor;
    // Never yourself. Enforced on submission too, belt and braces.
    if (!target || target === voter.id) continue;
    if (!players.some((p) => p.id === target)) continue;
    laurelCounts.set(target, (laurelCounts.get(target) ?? 0) + 1);
  }

  const rows: Standing[] = players.map((p) => {
    const kept = p.scars.filter((s) => s.kept === true);
    const keptScars = kept.length;
    const scarPays = !KEPT_SCAR_NEEDS_MEDIAN || p.renown >= gate;
    // A Scar kept with a Blood power pays whatever your Renown. That exemption
    // is Thornborn's entire reason to exist, and it cannot open the degenerate
    // line back up: it is once a run, so it is worth one Scar, ever.
    const paying = scarPays ? keptScars : kept.filter((s) => s.free).length;
    const laurels = laurelCounts.get(p.id) ?? 0;
    const total = p.renown + paying * KEPT_SCAR_VALUE + laurels * LAUREL_VALUE;
    return {
      playerId: p.id,
      name: p.name,
      renown: p.renown,
      keptScars,
      laurels,
      total,
      placement: 0,
      hoard: false,
    };
  });

  // Highest total, then Renown, then fewest Scars hidden, then name. Fully
  // deterministic: the winner must never depend on array order.
  const byId = new Map(players.map((p) => [p.id, p]));
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.renown - a.renown ||
      (byId.get(a.playerId)?.stats.scarsHidden ?? 0) -
        (byId.get(b.playerId)?.stats.scarsHidden ?? 0) ||
      a.name.localeCompare(b.name)
  );

  let placement = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied = prev !== undefined && prev.total === row.total;
    if (!tied) placement = i + 1;
    row.placement = placement;
  });

  /**
   * Exactly one player takes the Hoard, even on a tie. The party survived
   * together and one of them got paid: "joint winners" is not the ending this
   * game is telling, so the deterministic sort above breaks it.
   */
  if (rows.length > 0) rows[0].hoard = true;

  return rows;
}
