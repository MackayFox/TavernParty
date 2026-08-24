/**
 * Daily-game foundations. Pure and deterministic: the same UTC date produces the
 * same puzzle for everybody in the world, with nothing stored anywhere.
 *
 * Nothing in here touches I/O and nothing in here knows an answer, so this is
 * the ONE daily module a client component may import. Every module that can
 * resolve a solution (`longway`, `tableofsix`, `ledger`, `muster`) is server
 * only and reached through `app/api/daily/*`.
 */

export const DAILY_GAMES = ["longway", "tableofsix", "ledger", "muster"] as const;
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
  tableofsix: {
    name: "TABLE OF SIX",
    path: "/daily/tableofsix",
    blurb:
      "Six dice, thrown once for the whole world, and six problems that will not wait. Put the right roll on the right problem.",
    rule: "Give each obstacle exactly one of today's six rolls.",
    glyph: "🎲",
    minScore: -40,
    maxScore: 60,
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

/** Every playable date, newest first, capped. */
export function archiveDates(limit = 120): string[] {
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
