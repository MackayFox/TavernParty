/**
 * WHAT A TARGET NUMBER MEANS ON A FLOOR THAT HAS ALREADY THROWN ITS DIE.
 *
 * Client-safe on purpose: no content, no prose, no I/O. The desk imports it, and
 * so does anything server-side that wants to say the same thing.
 *
 * THE PROBLEM THIS FIXES, which took writing a dungeon to notice.
 *
 * The desk used to offer three targets per band: 11, 12, 13 on a shallow floor,
 * 16, 17, 18 on a deep one, labelled easy, fair and hard. That is how difficulty
 * works in a game where you roll when you get there. It is NOT how it works here,
 * because every room's die is thrown before anybody chooses, and a floor that
 * threw a 2 cannot be cleared on a target of 11 by any character the game can
 * build. So "easy" meant impossible, all three words meant the same thing, and
 * the author's only working door was the brace. I hit it writing the house's own
 * demo: the solver called three of six floors a single choice wearing a hat, and
 * no selectable number could have fixed it.
 *
 * So the words are now relative to the die. Easy means most people get through,
 * hard means few do, and the NUMBER is derived. The author is also shown the die,
 * because it is a fact about their dungeon and the whole pitch of the desk is
 * that they get to tune against facts rather than guess at distributions.
 *
 * WHY IT IS NOT A LEAK. The author already knows every word of their own dungeon
 * and can read its clear rates off the report. A player is told the target and
 * never the die, which is unchanged. Nothing here reaches the play payload.
 */

/**
 * The spread of ability bonuses a character can actually bring to one check.
 *
 * Measured off the content rather than assumed: the array's best number gives +2
 * or +3, an affinity adds 2, and one piece of kit adds 1 or 2. Nobody arrives
 * with more than about +7, and plenty arrive with 0.
 */
export const BONUS_FLOOR = 0;
export const BONUS_CEILING = 7;

/** A 1 never clears anything and a 20 always does. Both make targets meaningless. */
export const DEAD_DIE = 1;
export const FREE_DIE = 20;

export type Targets = { easy: number; fair: number; hard: number };

/**
 * Three live targets for a floor that threw `die`.
 *
 * Easy sits just above the die, so almost any bonus carries it. Hard sits near
 * the top of what anybody brings, so only somebody built for that ability gets
 * through. Clamped to what the wire will carry, and the clamp is where the honest
 * answer sometimes is: on a 17 you cannot make a check hard, and the desk says so
 * rather than pretending.
 */
export function targetsFor(die: number): Targets {
  const clamp = (n: number) => Math.max(2, Math.min(20, n));
  return {
    easy: clamp(die + 2),
    fair: clamp(die + 5),
    hard: clamp(die + BONUS_CEILING),
  };
}

/** Which word a stored target sits closest to, so a select shows the truth. */
export function wordForTarget(die: number, tn: number): "easy" | "fair" | "hard" {
  const t = targetsFor(die);
  const gaps: [("easy" | "fair" | "hard"), number][] = [
    ["easy", Math.abs(tn - t.easy)],
    ["fair", Math.abs(tn - t.fair)],
    ["hard", Math.abs(tn - t.hard)],
  ];
  return gaps.sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * One sentence about what this floor's die does to it.
 *
 * The most useful line on the desk, because it is the one thing about a dungeon
 * an author cannot work out by reading their own writing.
 */
export function readingOf(die: number): string {
  if (die === DEAD_DIE)
    return "This floor throws a 1, and a 1 never opens anything. Both checks here will fail for everybody, whatever you set them to, so the only real way through is the one that always works. Some floors are a price and that is fine, but do not expect anybody to choose on this one.";
  if (die === FREE_DIE)
    return "This floor throws a 20, and a 20 always opens. Both checks here will clear for everybody, so nothing on this floor costs anything. Fine as a breather, and worth knowing it is one.";
  if (die <= 5)
    return `This floor throws a ${die}, which is poor. Only a low target is a real choice here, and the way through that always works is going to look attractive to most people.`;
  if (die >= 16)
    return `This floor throws a ${die}, which is generous. Even the hardest target you can set will let most people through, so this floor is a gift rather than a test.`;
  return `This floor throws a ${die}. There is room here for a real decision: the target you pick is what decides how many people take the cheap way instead.`;
}
