/**
 * Choosing the five scenes.
 *
 * This is where a Hook stops being flavour text. Every player's Hook names a tag
 * it INSERTS, and this module guarantees that tag appears in the deck the whole
 * table has to face. Your history is not a note on your sheet; it is an edit to
 * everybody else's night, and they can see whose fault it was.
 *
 * Scenes and hooks are passed in rather than imported, so the whole thing is
 * testable without the content and the dailies can pin a deck from a date.
 */
import { shuffle, type Rng } from "./random";
import type { Hook, Scene } from "./types";

export type DeckRequest = {
  scenes: readonly Scene[];
  /** One per player who chose a Hook. Duplicates are fine and cost nothing. */
  hooks: readonly Hook[];
  acts: number;
};

/**
 * Greedy, and greedy is correct here.
 *
 * Satisfy the rarest demands first: a tag that only one scene in the pool can
 * provide has to be placed before a tag that a dozen scenes could. Sorting the
 * required tags by how many scenes could satisfy them means a simple pass places
 * as many Inserts as the deck has room for, without any search.
 *
 * When there are more Inserts than Acts some players will not see theirs. That
 * is honest rather than hidden: five Acts cannot carry six promises, and the
 * alternative is silently dropping somebody's choice at random. The order above
 * at least means the unlucky one is the player whose tag was easiest to place.
 */
export function buildDeck(req: DeckRequest, rng: Rng): string[] {
  const { scenes, hooks, acts } = req;
  if (scenes.length === 0) return [];

  const byId = new Map(scenes.map((s) => [s.id, s]));
  const shuffled = shuffle(scenes, rng);

  const required = [...new Set(hooks.map((h) => h.insertTag))];
  const supply = new Map<string, number>();
  for (const tag of required) {
    supply.set(tag, shuffled.filter((s) => s.tags.includes(tag)).length);
  }
  required.sort((a, b) => (supply.get(a) ?? 0) - (supply.get(b) ?? 0));

  const chosen: string[] = [];
  const used = new Set<string>();

  for (const tag of required) {
    if (chosen.length >= acts) break;
    // A scene already chosen may cover this tag too, in which case it is free.
    if (chosen.some((id) => byId.get(id)?.tags.includes(tag))) continue;
    const match = shuffled.find((s) => !used.has(s.id) && s.tags.includes(tag));
    if (!match) continue;
    used.add(match.id);
    chosen.push(match.id);
  }

  for (const scene of shuffled) {
    if (chosen.length >= acts) break;
    if (used.has(scene.id)) continue;
    used.add(scene.id);
    chosen.push(scene.id);
  }

  // A pool smaller than the run repeats rather than ending the night early.
  let i = 0;
  while (chosen.length < acts && shuffled.length > 0) {
    chosen.push(shuffled[i % shuffled.length].id);
    i++;
  }

  return shuffle(chosen, rng);
}

/**
 * Which Inserts the deck actually honoured. Shown to the table, because knowing
 * whose past dragged this in is half the point.
 */
export function honoured(
  deck: readonly string[],
  scenes: readonly Scene[],
  hooks: readonly Hook[]
): string[] {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const tags = new Set(deck.flatMap((id) => byId.get(id)?.tags ?? []));
  return [...new Set(hooks.filter((h) => tags.has(h.insertTag)).map((h) => h.insertTag))];
}

/**
 * The Night turns.
 *
 * At the Dread threshold the final Act is drawn from a worse deck, which here
 * means the hardest scene the table has not already faced: highest reckless
 * target number, then highest total cost. Deliberately resolved at the start of
 * the last Act rather than at deal time, because Dread is not knowable when the
 * deck is built.
 */
export function worstUnseen(
  scenes: readonly Scene[],
  seen: readonly string[]
): Scene | undefined {
  const pool = scenes.filter((s) => !seen.includes(s.id));
  if (pool.length === 0) return undefined;
  const weight = (s: Scene) => {
    const reckless = s.approaches.find((a) => a.reckless);
    const cost = s.approaches.reduce((t, a) => t + a.cost.renown + a.cost.dread, 0);
    return (reckless?.tn ?? 0) * 100 + cost;
  };
  return [...pool].sort((a, b) => weight(b) - weight(a) || a.id.localeCompare(b.id))[0];
}

/** Whose Hook tags this scene carries. Public, and it is a target. */
export function markedBy(
  scene: Scene,
  players: readonly { id: string; hookId: string | null }[],
  hooks: readonly Hook[]
): string[] {
  const byId = new Map(hooks.map((h) => [h.id, h]));
  return players
    .filter((p) => {
      const hook = p.hookId ? byId.get(p.hookId) : undefined;
      return !!hook && scene.tags.includes(hook.callTag);
    })
    .map((p) => p.id);
}
