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
import { useEffect, useState } from "react";
import { DAILY_GAMES, type DailyGame } from "./core";

const DONE_KEY = "tp_daily_done";
/** Only days played on their own date. The streak is computed from this one. */
const COUNTED_KEY = "tp_daily_counted";
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
  // The FIRST score for a date stands, the way the server's own write does with
  // ignoreDuplicates. Overwriting meant replaying a puzzle you had already seen
  // the answer to could raise the number you had already banked.
  if (map[game]?.[date] !== undefined) return;
  map[game] = { ...(map[game] ?? {}), [date]: score };
  writeJson(DONE_KEY, map);
}

/**
 * WHAT COUNTED, as opposed to what was played.
 *
 * Two maps rather than one, and the split is the fix for a real hole: a streak
 * was computed by walking backwards through the SAME map that records archive
 * practice, so yesterday's puzzle played today from the archive extended your
 * streak. Twenty-five archive days are live, so any streak was farmable in a few
 * minutes, while three separate strings promised the archive did not count.
 *
 * `done` still records practice on purpose, because the question it answers is
 * "have I played this day?" and the calendar needs that. This second map answers
 * "did that count?", and only a puzzle played on its own date ever enters it.
 */
export function recordCounted(game: DailyGame, date: string, score: number): void {
  const map = readJson<DoneMap>(COUNTED_KEY, {});
  if (map[game]?.[date] !== undefined) return;
  map[game] = { ...(map[game] ?? {}), [date]: score };
  writeJson(COUNTED_KEY, map);
}

export function readCounted(game: DailyGame): Record<string, number> {
  return readJson<DoneMap>(COUNTED_KEY, {})[game] ?? {};
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

/**
 * Streaks computed from local storage, for guests.
 *
 * From `counted`, never from `done`: `done` includes archive practice, and
 * walking it backwards is what made a streak farmable from the archive in a few
 * minutes. `played` and `best` still come from everything, because those are
 * counts of what somebody did rather than claims about consecutive days.
 */
export function localStats(game: DailyGame): { streak: number; played: number; best: number } {
  const done = readCounted(game);
  const everything = readDone(game);
  const dates = Object.keys(everything).sort().reverse();
  if (dates.length === 0) return { streak: 0, played: 0, best: 0 };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  const cursor = new Date();
  /*
   * `undefined`, not falsy. `done[today]` is a SCORE, and three of the four
   * dailies can legitimately score nought: 0 of 4 on the Ledger is common and is
   * its own `minScore`. Testing truthiness threw today's play away and started
   * the walk at yesterday, so a fourteen-day streak read 13 after one bad Ledger
   * and a first-timer whose first ever puzzle scored zero was told "Streak: 0
   * days" beside their own finished game. The loop below already had this right.
   */
  if (done[today] === undefined) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (done[iso(cursor)] !== undefined) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    streak,
    played: dates.length,
    best: Math.max(...Object.values(everything)),
  };
}

/**
 * The streak, seeded from storage on mount instead of only after a win.
 *
 * All four dailies used to hold the streak in a bare `useState<number | null>`
 * that nothing wrote to until the finish handler ran. Play a puzzle and it read
 * "Streak: 1 day"; reload the page and the completed result came back out of
 * localStorage without going through the finish handler, so the streak stayed
 * null and the shell rendered `streak ?? 0` — "Streak: 0 days", next to your
 * own finished game. Come back the next morning and the number protecting your
 * habit said nought, which is the fastest way to stop having the habit.
 *
 * The read has to be in an effect and not in the initialiser: localStorage does
 * not exist on the server, and seeding from it during render is a hydration
 * mismatch. So it stays null for one paint, which is the state the shell was
 * already written for.
 */
export function useLocalStreak(
  game: DailyGame
): [number | null, (n: number | null) => void] {
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => setStreak(localStats(game).streak), [game]);
  return [streak, setStreak];
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
