/**
 * Daily-result persistence and streak maths, for registered users only.
 *
 * SERVER ONLY. It imports the service-role client, so a client component must
 * never touch it. Guests are a first-class path and keep everything in
 * localStorage via `lib/daily/local.ts`: nothing about a guest's game depends on
 * any of this working, or on Supabase being configured at all.
 *
 * The table columns are `day` and `par` (see supabase/migrations), not `date`
 * and not `best`, and the unique key is (user_id, game, day).
 */
import { adminClient } from "../supabase/admin";
import { utcDate, type DailyGame } from "./core";

export type DailyStats = {
  today: { date: string; score: number; par: number | null } | null;
  streak: number;
  bestStreak: number;
  bestScore: number;
  played: number;
};

const EMPTY: DailyStats = {
  today: null,
  streak: 0,
  bestStreak: 0,
  bestScore: 0,
  played: 0,
};

type Row = { date: string; score: number; par: number | null };

/**
 * First completion of the day wins. `ignoreDuplicates` means a replay, or a
 * second POST crafted by hand, can never improve a score already recorded.
 */
export async function saveDailyResult(
  userId: string,
  game: DailyGame,
  score: number,
  par: number | null = null,
  date: string = utcDate()
): Promise<void> {
  const { error } = await adminClient()
    .from("daily_results")
    .upsert(
      { user_id: userId, game, day: date, score, par },
      { onConflict: "user_id,game,day", ignoreDuplicates: true }
    );
  // A failed save must never break the result screen, so it is logged and
  // swallowed. The score is already in the player's localStorage either way.
  if (error) console.error("[daily] save failed", error);
}

export async function getDailyStats(userId: string, game: DailyGame): Promise<DailyStats> {
  const { data, error } = await adminClient()
    .from("daily_results")
    .select("day, score, par")
    .eq("user_id", userId)
    .eq("game", game)
    .order("day", { ascending: false })
    .limit(500);
  if (error || !data) return EMPTY;
  return statsFromRows(data.map(toRow));
}

/** All four games in one query, for the hub. */
export async function getAllDailyStats(
  userId: string
): Promise<Partial<Record<DailyGame, DailyStats>>> {
  const { data, error } = await adminClient()
    .from("daily_results")
    .select("game, day, score, par")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(2000);
  if (error || !data) return {};
  const byGame = new Map<string, Row[]>();
  for (const row of data) {
    const list = byGame.get(String(row.game)) ?? [];
    list.push(toRow(row));
    byGame.set(String(row.game), list);
  }
  const out: Partial<Record<DailyGame, DailyStats>> = {};
  for (const [game, rows] of byGame) out[game as DailyGame] = statsFromRows(rows);
  return out;
}

function toRow(row: { day: unknown; score: unknown; par?: unknown }): Row {
  return {
    date: String(row.day).slice(0, 10),
    score: Number(row.score),
    par: row.par === null || row.par === undefined ? null : Number(row.par),
  };
}

/**
 * Streaks count back from today, or from yesterday when today has not been
 * played yet. Otherwise opening the page before your first game of the day
 * would show a streak of zero, which is both a lie and a bad feeling.
 */
export function statsFromRows(rows: readonly Row[]): DailyStats {
  if (rows.length === 0) return EMPTY;
  const today = utcDate();
  const dates = new Set(rows.map((r) => r.date));

  const cursor = new Date();
  if (!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (dates.has(utcDate(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // The longest run anywhere in the history.
  let bestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...dates].sort()) {
    run = previous !== null && isNextDay(previous, date) ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }

  return {
    today: rows.find((r) => r.date === today) ?? null,
    streak,
    bestStreak,
    bestScore: rows.reduce((a, r) => Math.max(a, r.score), rows[0].score),
    played: dates.size,
  };
}

function isNextDay(previous: string, next: string): boolean {
  const d = new Date(`${previous}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return utcDate(d) === next;
}
