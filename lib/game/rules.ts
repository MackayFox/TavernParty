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

/** Rough run length, for the lobby to show. Fixed regardless of table size. */
export function estimateRunMs(settings: Pick<RoomSettings, "acts">): number {
  return (
    TIMINGS.musterMs +
    TIMINGS.draftCallingMs +
    TIMINGS.draftKitMs +
    TIMINGS.assignMs +
    settings.acts * (TIMINGS.actMs + TIMINGS.actResultMs) +
    TIMINGS.balladMs
  );
}

/** "about 10 min" */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 2) return `about ${Math.round(ms / 1000)} sec`;
  return `about ${minutes} min`;
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
export const DREAD_DOUBLE_AT = 3;
export const DREAD_TURN_AT = 5;
export const DREAD_MAX = 8;

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
  maxPlayers: 5,
  acts: 5,
  actSeconds: TIMINGS.actMs / 1000,
  visibility: "public",
};

/** How many ranked choices a draft accepts. */
export const DRAFT_RANKS = 3;

/** Company announcements kept in the room state. */
export const LOG_MAX = 60;

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
