/**
 * The numbers. Every balance decision in one file so tuning is one diff.
 * See docs/GAME_DESIGN.md for the reasoning behind each.
 */
import type { Ability, RoomSettings } from "./types";

/**
 * How long each beat stays on screen.
 *
 * Everything in this game is simultaneous, so unlike a turn-based board game the
 * length does NOT scale with the number of players: a six-player run takes the
 * same time as a two-player one. That is the main reason this shape was chosen.
 *
 * Beats are deliberately generous. The lesson from the other two sites in the
 * network is that a beat nobody can read is not worth the second it saves, and
 * here the thing being read is the point.
 */
export const TIMINGS = {
  /**
   * The array and the priority order are revealed. Nothing to decide, but there
   * is a lot to read: the shared numbers, what a modifier is, the draft order,
   * and the fact that first crack at a Calling buys last crack at the gear. Eight
   * seconds was not enough to reach sentence two, and the fork it teaches here is
   * what makes the next sixty-five seconds make sense.
   */
  musterMs: 16_000,
  /** Rank up to three of eight Callings. */
  draftCallingMs: 35_000,
  /** Rank up to three of twelve pieces of Kit. */
  draftKitMs: 30_000,
  /** Place six numbers and choose a Hook. The biggest decision in the game. */
  assignMs: 70_000,
  /** Commit an Approach, and optionally nominate somebody. */
  actMs: 60_000,
  /**
   * Read the ledger, see what nobody took, call a Signature or a Blood, and keep
   * or hide the Scar.
   *
   * The longest non-decision window in the game on purpose. It has to cover your
   * own itemised roll, up to five other people's, and two decisions whose default
   * on timeout costs you: an undecided Scar is hidden for you, which is Renown
   * off. Thirty seconds meant a first-timer's first wound was usually taxed while
   * they were still reading.
   */
  actResultMs: 45_000,
  /** Cast a Laurel. */
  balladMs: 35_000,
  /** A bot's visible pause, so a table of one human does not snap past them. */
  botThinkMs: 1_400,
} as const;

/**
 * HOW LONG AN ACT WAITS AFTER THE LAST PERSON COMMITS.
 *
 * Nominating somebody is an ACT-phase action, and the Act was called complete
 * the moment every present human had a choice recorded. On a table where people
 * decide quickly -- the good case -- that meant the last commit resolved the Act
 * in the same breath, and every nomination that followed came back "That is not
 * happening right now." Measured on a six-player run: the whole sixty-second
 * window collapsed to 1.9 seconds, and all six nominations were refused, on
 * every Act of every run.
 *
 * So the mechanic had an economy (`settleNominations`, NOMINATION_SHARE,
 * NOMINATION_PENALTY), a UI, and a smoke test, and could not be reached by
 * anybody who was not slow.
 *
 * Six seconds: long enough to read who went where and press a name, short enough
 * that a table who has all decided is not made to sit through the rest of a
 * minute. The full deadline still applies to anybody who has not committed.
 */
export const ACT_GRACE_MS = 6_000;

/**
 * Rough run length, for the lobby to show. Fixed regardless of table size.
 *
 * IT SUMS THE DEADLINES, WHICH IS NOT WHAT A RUN COSTS. Every decision beat ends
 * the moment the last person at the table has answered, so a table that answers
 * promptly never spends anything like its window: measured on a real six-player
 * five-Act run, DRAFT_CALLING took 1.8s of a 35s deadline, DRAFT_KIT 1.7s, ASSIGN
 * 2.7s and each ACT about 8s of 60. The whole run finished in 4m18s while
 * `/about` and `/how-it-works` advertised about twelve minutes.
 *
 * Overstating it by nearly three times is the expensive direction of wrong: the
 * number's whole job is to answer "have I got time for this before dinner", and
 * it was talking people out of a game they had time for.
 *
 * So the beats you DECIDE in are estimated from how long deciding takes, and only
 * the two beats you READ -- MUSTER, where the table is waiting for people to
 * arrive, and ACT_RESULT, which runs its full length on purpose -- are counted at
 * their deadline. Deliberately still generous: better a run that ends early than
 * one that overruns what somebody was promised.
 */
export function estimateRunMs(settings: Pick<RoomSettings, "acts">): number {
  /** What a table actually takes to make one decision together, generously. */
  const decide = 12_000;
  return (
    TIMINGS.musterMs +
    decide + // the Calling draft
    decide + // the Kit draft
    decide * 2 + // ASSIGN, which is six numbers and a Hook rather than a ranking
    settings.acts * (decide + ACT_GRACE_MS + TIMINGS.actResultMs) +
    decide // the Ballad
  );
}

/** "about 10 min" */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 2) return `about ${Math.round(ms / 1000)} sec`;
  return `about ${minutes} min`;
}

/**
 * The same length, as a sentence rather than as a stat block.
 *
 * `formatDuration` is right in a dropdown and in a table, and it was being
 * interpolated into prose all over the site: "A whole roleplaying night in about
 * 7 min" is an h1, and "you can go and play it in a browser in about 7 min"
 * opens a page written for search. An abbreviated unit mid-sentence reads as a
 * template variable rather than as writing, which is exactly the tell that makes
 * a page look generated.
 *
 * Small numbers spelled out, because that is what the rest of the writing does:
 * "You needed fourteen, the die gave eleven", "Five doors".
 */
const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

export function spellDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const word = WORDS[minutes] ?? String(minutes);
  return `about ${word} minute${minutes === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// The house array
// ---------------------------------------------------------------------------

/**
 * Six numbers, rolled once for the whole room, assigned by everybody.
 *
 * Four dice, drop the lowest, six times. Classic, and the variance is a feature
 * rather than a fairness problem precisely because it is shared: if the table
 * gets a 6 in the spread, everybody has to decide who lives with it.
 */
export const ARRAY_SIZE = 6;
export const ARRAY_DICE = 4;
export const ARRAY_DROP = 1;

/** The familiar curve. Range -4 to +4 on a 3-18 score. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------

export const DIE_SIDES = 20;
/** A Calling is good at two things. */
export const AFFINITY_BONUS = 2;
/** What a Hook token is worth when you spend one. */
export const HOOK_TOKEN_VALUE = 5;
/** How many a Hook starts with, and refills to. */
export const HOOK_TOKENS_MAX = 2;
/** A natural 20 always succeeds, a natural 1 always fails. */
export const CRIT = DIE_SIDES;
export const FUMBLE = 1;

/**
 * Does this face, with this total behind it, clear that target number?
 *
 * THE ONE COPY. The dailies grew their own version of this and drifted: a
 * client labelled a guaranteed-fail door "(enough)" and a guaranteed-pass door
 * "(short)" on the one game whose entire pitch is perfect information. That was
 * fixed by putting the predicate in `lib/daily/core.ts`, which the engine cannot
 * import, so the live game kept a fourth copy of the same three lines. It lives
 * here now, and `lib/daily/core.ts` re-exports it, because the rule is a rule of
 * the game rather than a rule of the dailies.
 */
export function clears(face: number, total: number, tn: number): boolean {
  if (face === CRIT) return true;
  if (face === FUMBLE) return false;
  return total >= tn;
}

// ---------------------------------------------------------------------------
// Renown
// ---------------------------------------------------------------------------

/** Being Marked pays you to take the Act, and docks you for flinching from it. */
export const MARK_BONUS = 2;
export const MARK_FLINCH_PENALTY = 1;

/** The deadline default. A real move that scores badly, never a skip. */
export const FLINCH_RENOWN = -1;
export const FLINCH_DREAD = 1;

/** A nominator's share of the prize if their nominee pulls it off. */
export const NOMINATION_SHARE = 0.5;
/** What each nominator eats if the nominee fails. */
export const NOMINATION_PENALTY = 2;

/** Spending a Torch reveals the Reckless target number. */
export const REVEAL_COST_TORCHES = 1;

// ---------------------------------------------------------------------------
// Dread — collective, with published thresholds
// ---------------------------------------------------------------------------

/**
 * Hard thresholds rather than a soft divisor, because a rounding error is not
 * frightening in Act II. Dread is what makes "everybody flinches" unstable:
 * somebody has to go through the door.
 */
/**
 * The solo figures, and the shape everything else scales from.
 *
 * Kept as constants because the dailies are one-player games and are tuned
 * against exactly these, and because the front page and the rules page want a
 * number to print.
 */
export const DREAD_DOUBLE_AT = 3;
export const DREAD_TURN_AT = 5;
export const DREAD_MAX = 8;

/**
 * The same thresholds, per table size.
 *
 * Dread is generated PER PLAYER and was measured against a fixed ceiling, so the
 * escalation that reads as tension at two players was a timetable at six. Mean
 * party Dread after each Act over 1,500 six-handed runs was 1.68, 4.00, 6.77,
 * 7.78, 7.98 against a doubling threshold of 3 and a ceiling of 8: the doubling
 * threshold was crossed in 100% of runs by a mean of Act 2.1, the turning
 * threshold in 100% by Act 2.7, and 42% of all keep-or-hide decisions happened
 * with Dread already pinned at the ceiling, where keeping a Scar taxes the party
 * literally nothing. Every published threshold was a schedule and every Dread
 * cost in the game was free.
 *
 * Linear in the head count, because the supply is. A two-player table keeps
 * roughly the numbers it was tuned with.
 */
export function dreadThresholds(players: number): {
  double: number;
  turn: number;
  max: number;
} {
  const n = Math.max(1, players);
  return { double: 2 + n, turn: 3 + 2 * n, max: 4 + 3 * n };
}

/**
 * A night that is going well lets the party breathe.
 *
 * Dread had no downward direction at all: every source added and nothing ever
 * subtracted, so it could only ratchet. One point back when MORE THAN HALF the
 * players who committed cleared their Act. A majority rather than everybody,
 * because at six players with realistic success rates "everybody succeeded"
 * fires about 1.5% of the time and would have been decoration.
 */
export const DREAD_RELIEF = 1;

/** Keeping a Scar is a personal gain funded by a tax on everybody. */
export const KEEP_SCAR_DREAD = 1;
/** Hiding one costs you now, and nobody else anything. */
export const HIDE_SCAR_RENOWN = 2;

// ---------------------------------------------------------------------------
// What the Signatures are worth
//
// One per Calling, once in the whole run. Bigger and louder than a Blood power,
// because the Calling is the exclusive draft and the loudest choice a player
// makes: being the only WARDEN at the table has to mean something the table can
// see happen.
// ---------------------------------------------------------------------------

/** Chanter. Declared before the roll, so it is a bet rather than a rescue. */
export const SIGNATURE_BOOST = 5;
/** Hedge-witch. Enough to pull the party back under a threshold, not to reset. */
export const SIGNATURE_CLEAR_DREAD = 3;
/** Knife. A cut of somebody else's Deed, taken from nobody: the story grows. */
export const SIGNATURE_STEAL_SHARE = 0.5;
/** Oathbound. What carrying somebody else's wound is worth to you. */
export const SIGNATURE_OATH_RENOWN = 4;

// ---------------------------------------------------------------------------
// What the Blood powers are worth
// ---------------------------------------------------------------------------

/**
 * Ashkin moves their own Renown loss onto the party as Dread.
 *
 * Flat, not proportional, because Renown runs to the dozens and Dread tops out
 * at eight: converting one into the other at any rate makes a single bad Act
 * able to end the night. Two is enough that the table notices and argues, which
 * is the whole point of the Blood.
 */
export const ASHKIN_DREAD = 2;

/**
 * Emberkin's personal cut for shielding the party.
 *
 * Without it the power is pure charity, and in a game exactly one player wins,
 * a rational drafter never takes pure charity. Small on purpose: it should read
 * as a thank-you from the table, not as the reason you did it.
 */
export const EMBERKIN_RENOWN = 2;

// ---------------------------------------------------------------------------
// The Ballad
// ---------------------------------------------------------------------------

export const KEPT_SCAR_VALUE = 4;
/**
 * Kept Scars pay only if your Renown is at or above the table median.
 *
 * The anti-degenerate clamp. Without it, a player can win by never taking a
 * risk and collecting cheap Scars, which is the failure mode every consequence
 * economy has.
 */
export const KEPT_SCAR_NEEDS_MEDIAN = true;
export const LAUREL_VALUE = 8;

// ---------------------------------------------------------------------------
// Table shape
// ---------------------------------------------------------------------------

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MIN_ACTS = 3;
export const MAX_ACTS = 7;

/**
 * Every scarce pool is floored at its four-player size regardless of table size.
 *
 * ponytail: a mitigation, not a fix. A two-player table will always have less
 * draft tension than a five-player one, because scarcity is the tension. If two
 * players ever becomes the common case, the upgrade is to make the pools
 * genuinely smaller at small tables so the denial still bites.
 */
export const SCARCITY_FLOOR_PLAYERS = 4;

/** Only one player may take the Reckless line in an Act. It is one door. */
export const RECKLESS_IS_EXCLUSIVE = true;

export const DEFAULT_SETTINGS: RoomSettings = {
  /**
   * Six, matching MAX_PLAYERS and matching what the product says everywhere.
   *
   * It was five, while "two to six players" appeared in nine places across the
   * front page, the rules page, the about page and the metadata. Nothing in the UI
   * exposes the setting, and the only two callers of `createRoom` pass no settings
   * at all, so EVERY table the product could create seated five and a sixth friend
   * was turned away from a game that had just advertised room for them. Caught by a
   * balance test that tried to sit six down and was told the table was full.
   */
  maxPlayers: MAX_PLAYERS,
  acts: 5,
  actSeconds: TIMINGS.actMs / 1000,
  visibility: "public",
};

/** How many ranked choices a draft accepts. */
export const DRAFT_RANKS = 3;

/**
 * How much of the chronicle the room state carries.
 *
 * The biggest single line in the payload, and the room state is read out of
 * Postgres on every poll: at 60 the log measured 5,035 B of a 9,666 B state row,
 * 52% of it, and a six player run is 1,710 of those reads. `Chronicle` renders
 * twelve entries and nothing else in the product reads the log at all, so the
 * other forty-eight existed only to be paid for, 285 times each per player.
 *
 * Sixteen rather than twelve so the rail is never showing the very bottom of the
 * buffer. Raise it only along with what the Chronicle shows.
 */
export const LOG_MAX = 16;

/** Presence and host migration, matched to the rest of the network. */
export const PRESENCE_TIMEOUT_MS = 15_000;
export const HOST_MIGRATION_GRACE_MS = 10_000;
export const HEARTBEAT_PERSIST_MS = 20_000;

/** Ability display names, so the UI never hardcodes them. */
export const ABILITY_LABEL: Record<Ability, string> = {
  brawn: "Brawn",
  deft: "Deft",
  grit: "Grit",
  wits: "Wits",
  nerve: "Nerve",
  charm: "Charm",
};

/** One line each, for the tooltip on the sheet. */
export const ABILITY_BLURB: Record<Ability, string> = {
  brawn: "Lifting, breaking, holding a door that does not want to be held.",
  deft: "Hands and feet. Locks, ledges, pockets, knives.",
  grit: "Carrying on after the point where carrying on stopped being sensible.",
  wits: "Noticing. Remembering. Working out what the room is for.",
  nerve: "Not running. Not flinching. Not showing it.",
  charm: "Being believed, whether or not you are telling the truth.",
};
