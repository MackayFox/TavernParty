/**
 * Daily-game foundations. Pure and deterministic: the same UTC date produces the
 * same puzzle for everybody in the world, with nothing stored anywhere.
 *
 * Nothing in here touches I/O and nothing in here knows an answer, so this is
 * the ONE daily module a client component may import. Every module that can
 * resolve a solution (`longway`, `deeprun`, `ledger`, `muster`) is server
 * only and reached through `app/api/daily/*`.
 */

import { CRIT, FUMBLE } from "@/lib/game/rules";

export const DAILY_GAMES = ["longway", "deeprun", "ledger", "muster"] as const;
export type DailyGame = (typeof DAILY_GAMES)[number];

export type DailyMeta = {
  name: string;
  path: string;
  /** One or two lines for the hub card. */
  blurb: string;
  /** The rule, in one short line, shown above the first input. */
  rule: string;
  glyph: string;
  /**
   * Score bounds, used to reject an impossible score at the persistence
   * boundary. Higher is always better; three of the four also publish a par.
   */
  minScore: number;
  maxScore: number;
};

export const DAILY_META: Record<DailyGame, DailyMeta> = {
  longway: {
    name: "THE LONG WAY DOWN",
    path: "/daily/longway",
    blurb:
      "Five doors, and five dice you can see coming. One character, already made, and nothing left to blame.",
    rule: "You know every roll before you make it. Choose which door each one goes through.",
    glyph: "🚪",
    minScore: 0,
    maxScore: 99,
  },
  /**
   * Replaced TABLE OF SIX, which was the same puzzle as THE LONG WAY DOWN in a
   * plainer coat: both were "here are N dice you can already see, assign them to
   * N targets". This one is the only daily where you do NOT know the number
   * before you choose, which is the whole reason it is here.
   */
  deeprun: {
    name: "THE DEEP RUN",
    path: "/daily/deeprun",
    blurb:
      "Build somebody, take them down six floors, and find out what is in each room when you open it. The same dungeon for everybody, and you will not all come back.",
    rule: "Every room owns its die. You only see the number once you are in the room.",
    glyph: "🕯️",
    minScore: 0,
    maxScore: 62,
  },
  ledger: {
    name: "THE LEDGER",
    path: "/daily/ledger",
    blurb:
      "Five drinkers, five debts and four statements that are all true. Work out who owes what.",
    rule: "Four true statements. Three checks, and each one costs you a mark.",
    glyph: "📖",
    minScore: 0,
    maxScore: 4,
  },
  muster: {
    name: "MUSTER",
    path: "/daily/muster",
    blurb:
      "Tonight's six numbers, one Calling, one piece of kit, five doors. Character creation as the whole game.",
    rule: "Place tonight's six numbers, pick a Calling and one piece of kit, then face the night.",
    glyph: "🛡",
    minScore: 0,
    maxScore: 5,
  },
};

/** "YYYY-MM-DD" for a Date, in UTC. */
export function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** FNV-1a of a string, giving a stable 32-bit seed. */
export function dateSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. Small, fast, and good enough for a puzzle. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A generator keyed to one game on one date, so the four games never correlate:
 * knowing today's dice in one of them tells you nothing about another.
 */
export function seededRng(game: string, date: string): () => number {
  return mulberry32(dateSeed(`${game}:${date}`));
}

/** Deterministic Fisher-Yates. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], rand: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** `count` distinct items, chosen for a date. */
export function seededPick<T>(items: readonly T[], count: number, rand: () => number): T[] {
  return seededShuffle(items, rand).slice(0, count);
}

/**
 * Which entry in a fixed-length pool belongs to this date. Days since the epoch
 * rather than a hash, so consecutive days never repeat until the pool has been
 * used up.
 */
export function dailyIndex(date: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return ((days % poolSize) + poolSize) % poolSize;
}

/** The earliest date the archive goes back to. Before the doors opened, nothing. */
export const ARCHIVE_START = "2026-08-01";

export type PlayDate = { date: string; archive: boolean; valid: boolean };

/**
 * Resolve a `?date=` parameter. Anything missing, malformed, in the future or
 * before the archive falls back to today rather than 404ing: a link that has
 * aged badly should still hand you a game.
 */
export function resolvePlayDate(raw: string | null | undefined): PlayDate {
  const today = utcDate();
  if (!raw) return { date: today, archive: false, valid: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: today, archive: false, valid: false };
  if (Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))
    return { date: today, archive: false, valid: false };
  if (raw > today || raw < ARCHIVE_START) return { date: today, archive: false, valid: false };
  return { date: raw, archive: raw !== today, valid: true };
}

/**
 * Every playable date, newest first.
 *
 * The limit is a safety valve, not a page size: the archive page renders all of
 * them, so at 120 the shelf would have started quietly dropping its oldest day
 * every morning from the end of November 2026, with nothing on the page to say
 * so. A year of four links a day is heavy but honest, and it is a server
 * component with no JavaScript in it, so the cost is bytes rather than time.
 *
 * ponytail: no paging. Page it by month when the shelf passes a year, which is
 * also roughly when the page stops being scannable by a human being.
 */
export function archiveDates(limit = 366): string[] {
  const out: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < limit; i++) {
    const d = utcDate(cursor);
    if (d < ARCHIVE_START) break;
    out.push(d);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/** "Tuesday 12 August 2026" */
export function prettyDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Milliseconds until the next UTC midnight, for the "next one in" clock. */
export function msUntilReset(from: number = Date.now()): number {
  const next = new Date(from);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - from;
}

/**
 * What a daily GET may be cached for.
 *
 * Every one of them is a pure function of a date: the same bytes for everybody
 * in the world, changing once at UTC midnight and never in between. They were
 * being fetched uncached after hydration, so every player paid a round trip for
 * a constant.
 *
 * Today expires exactly at the reset, with no floor under it: a floor would mean
 * serving yesterday's puzzle for a few seconds after midnight, which is the one
 * thing a daily may never do. An archive date is finished and cannot change
 * again, so it is cached for as long as anything is willing to hold it.
 */
export function dailyCacheControl(archive: boolean, from: number = Date.now()): string {
  if (archive) return "public, max-age=86400, s-maxage=604800, immutable";
  const ttl = Math.max(0, Math.floor(msUntilReset(from) / 1000));
  return `public, max-age=${ttl}, s-maxage=${ttl}`;
}

// ---------------------------------------------------------------------------
// The rule that outranks the arithmetic
//
// A natural 1 always fails and a natural 20 always succeeds, whatever the total
// comes to (lib/game/rules, and `rollApproach` in lib/game/resolve). Three of
// the four dailies publish the die before you choose, and all three were showing
// a player their own sum against the target number and calling it: a face-1 door
// was labelled "enough" and a face-20 door was labelled "short", on the games
// whose entire pitch is that you can see what is coming.
//
// So the predicate lives here, once, and both sides of the wall use it: the
// server to resolve a door and the client to label one. They cannot disagree.
// ---------------------------------------------------------------------------

/**
 * Does this face, with this total behind it, clear that target number?
 *
 * Re-exported from `lib/game/rules.ts` rather than defined here. It was defined
 * here first, which left the live game's own copy in `lib/game/resolve.ts`
 * untouched, because the engine may not import from `lib/daily`. Four copies
 * became two. Two is still one too many, so the rule lives with the other rules
 * and this is the door the dailies come in by.
 */
export { clears } from "@/lib/game/rules";

/**
 * The lowest face that clears `tn` with `bonus` on it, for a die nobody has
 * thrown yet. Floored at 2 and capped at 20 by the same rule: "a 1 or better" is
 * a promise the server will not keep, and a door needing a 21 is not shut,
 * because a 20 opens it anyway.
 */
export function faceNeeded(tn: number, bonus: number): number {
  return Math.min(CRIT, Math.max(FUMBLE + 1, tn - bonus));
}

/** The words for a door with a known face, before it is taken. */
export function reachNote(face: number, reach: number, tn: number): string {
  if (face === CRIT) return "a 20, so it opens whatever you bring";
  if (face === FUMBLE) return "a 1, so it stays shut whatever you bring";
  return reach >= tn ? "enough" : `short by ${tn - reach}`;
}

/** Said out loud wherever a player is reading dice off a screen. */
export const DIE_RULE =
  "A 1 on the die always fails and a 20 always clears, whatever the total comes to.";

/**
 * "par", "two short of par". The share line for every game that publishes one.
 *
 * Par here is the best achievable, found by brute force, so a score can never
 * beat it and the golf convention is upside down: being *under* par would read
 * as a triumph when it is a shortfall. "Two short of par" cannot be misread.
 * The over case is guarded anyway, because a par that a player beats is a bug
 * worth seeing rather than hiding.
 */
export function parPhrase(score: number, par: number): string {
  const gap = par - score;
  if (gap === 0) return "par";
  const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const size = Math.abs(gap);
  const n = size <= 10 ? words[size] : String(size);
  return gap > 0 ? `${n} short of par` : `${n} over par`;
}
