/**
 * The tag vocabulary. The coordination point for all the content.
 *
 * Scenes carry tags. A Hook names one tag it INSERTS into the deck and one it is
 * CALLED BY. A Calling's Failing names a tag that exploits it. All three have to
 * draw from the same closed list or the guarantees quietly stop being guarantees,
 * so this file is the only place a tag may be invented, and a test asserts that
 * nothing anywhere references a tag that is not here.
 *
 * Twenty is deliberate: enough that a Hook feels specific, few enough that a
 * five-scene deck can honour several Inserts at once.
 */
export const TAGS = [
  "debt",
  "patrol",
  "crowd",
  "dark",
  "height",
  "water",
  "fire",
  "vermin",
  "lock",
  "beast",
  "clergy",
  "gentry",
  "thief",
  "drink",
  "cold",
  "ruins",
  "uncanny",
  "corpse",
  "oath",
  "trade",
] as const;

export type Tag = (typeof TAGS)[number];

/** What each tag means, so content stays consistent about it. */
export const TAG_MEANING: Record<Tag, string> = {
  debt: "money owed, and somebody who has come for it",
  patrol: "people with authority and a reason to ask questions",
  crowd: "too many bodies in too small a space",
  dark: "no light, or not enough of it",
  height: "a drop, a roof, a ladder, a rope",
  water: "a river, a flooded cellar, rain that will not stop",
  fire: "something burning that should not be",
  vermin: "small things, many of them",
  lock: "a door, a chest, a mechanism between you and the thing",
  beast: "something large and not interested in negotiating",
  clergy: "a temple, a rite, somebody certain they are right",
  gentry: "the people who own the building you are standing in",
  thief: "somebody else is also stealing this",
  drink: "a tavern, a wake, a celebration going badly",
  cold: "weather, or a cellar, that is taking something from you",
  ruins: "a place that used to be for something else",
  uncanny: "the unexplained, and it has noticed you",
  corpse: "a body, and the question of what to do about it",
  oath: "a promise somebody is about to be held to",
  trade: "a bargain, a market, a price being named",
};

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

export function isTag(value: string): value is Tag {
  return TAG_SET.has(value);
}
