"use client";

/**
 * Per-day progress in localStorage, so guests keep their streaks and nobody
 * loses a half-finished puzzle to a refresh.
 *
 * Two separate concerns, deliberately:
 *  - `progress` is the in-flight state of one puzzle on one date. Reloading
 *    mid-game must not restart it.
 *  - `done` records every completion including archive practice, because the
 *    calendar question is "have I played this day?", not "did it count?".
 */
import { DAILY_GAMES, type DailyGame } from "./core";

const DONE_KEY = "tp_daily_done";
const PROGRESS_PREFIX = "tp_daily_progress";
const NAME_KEY = "tp_name";

type DoneMap = Partial<Record<DailyGame, Record<string, number>>>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback; // corrupted or blocked storage — behave like a fresh browser
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode). The game still plays; it just
    // will not remember. Never surface this as an error.
  }
}

export function readDone(game: DailyGame): Record<string, number> {
  return readJson<DoneMap>(DONE_KEY, {})[game] ?? {};
}

export function readAllDone(): DoneMap {
  return readJson<DoneMap>(DONE_KEY, {});
}

export function recordDone(game: DailyGame, date: string, score: number): void {
  const map = readJson<DoneMap>(DONE_KEY, {});
  map[game] = { ...(map[game] ?? {}), [date]: score };
  writeJson(DONE_KEY, map);
}

export function progressKey(game: DailyGame, date: string): string {
  return `${PROGRESS_PREFIX}:${game}:${date}`;
}

export function readProgress<T>(game: DailyGame, date: string): T | null {
  return readJson<T | null>(progressKey(game, date), null);
}

export function writeProgress(game: DailyGame, date: string, state: unknown): void {
  writeJson(progressKey(game, date), state);
}

/**
 * Drop progress for dates that are no longer reachable, so localStorage does
 * not grow forever. Keeps anything from the last 10 days plus whatever the
 * archive calendar might still want.
 */
export function pruneProgress(keepDates: readonly string[]): void {
  try {
    const keep = new Set(keepDates);
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${PROGRESS_PREFIX}:`)) continue;
      const date = key.split(":").pop();
      if (date && !keep.has(date)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // Nothing to do; leftover keys are harmless.
  }
}

/** Streaks computed from local storage, for guests. */
export function localStats(game: DailyGame): { streak: number; played: number; best: number } {
  const done = readDone(game);
  const dates = Object.keys(done).sort().reverse();
  if (dates.length === 0) return { streak: 0, played: 0, best: 0 };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  const cursor = new Date();
  if (!done[today]) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (done[iso(cursor)] !== undefined) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    streak,
    played: dates.length,
    best: Math.max(...Object.values(done)),
  };
}

export function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Non-fatal: they will be asked for a name again next time.
  }
}

export { DAILY_GAMES };
