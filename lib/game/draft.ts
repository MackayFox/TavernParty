/**
 * Ranked simultaneous commit.
 *
 * Every draft in the game is this one interaction: each player submits up to
 * three ranked wants, and the tick grants each their highest surviving choice in
 * priority order. Nobody waits for anybody, which is the whole reason it was
 * chosen over a turn-based snake draft on a poll-driven server.
 *
 * Pure and deterministic. Given the same pool, wants and priority it always
 * produces the same grant, which is what lets the dailies replay a draft.
 */
import { DRAFT_RANKS } from "./rules";
import type { DraftState } from "./types";

export function freshDraft(pool: readonly string[]): DraftState {
  return { pool: [...pool], wants: {}, granted: {} };
}

/** Trim and de-duplicate a submission. Unknown ids are dropped, not an error. */
export function normaliseWants(
  raw: readonly string[],
  pool: readonly string[]
): string[] {
  const valid = new Set(pool);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= DRAFT_RANKS) break;
  }
  return out;
}

/**
 * Resolve the whole draft at once.
 *
 * Players are served in `priority` order. Each takes the highest of their wants
 * that is still available. A player who wanted nothing available, or submitted
 * nothing at all, is given the first remaining item rather than nothing: an
 * empty character sheet is not a playable state, and a silent skip would punish
 * a dropped connection far more than the design intends.
 *
 * `granted` is returned rather than mutated in so the caller decides when it
 * becomes visible.
 */
export function resolveDraft(
  draft: DraftState,
  priority: readonly string[]
): Record<string, string> {
  const available = new Set(draft.pool);
  const granted: Record<string, string> = {};

  for (const playerId of priority) {
    if (available.size === 0) break;
    const wants = draft.wants[playerId] ?? [];
    let chosen = wants.find((id) => available.has(id));
    if (chosen === undefined) {
      // Deliberately the first remaining rather than a random one: with a fixed
      // pool order this keeps the whole draft reproducible from the seed.
      chosen = draft.pool.find((id) => available.has(id));
    }
    if (chosen === undefined) break;
    granted[playerId] = chosen;
    available.delete(chosen);
  }

  return granted;
}

/**
 * Who picks first.
 *
 * The Kit draft runs in REVERSE. One reversed array, and it turns a
 * strictly-better draft position into a real fork: first crack at the Callings
 * means last crack at the gear, so there is no seat at the table that is simply
 * the best one.
 */
export function reversePriority(priority: readonly string[]): string[] {
  return [...priority].reverse();
}
