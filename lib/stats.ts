/**
 * The permanent record, read side.
 *
 * Server-only: it uses the service role. Never import this from a client
 * component. Everything here degrades to empty rather than throwing, because a
 * profile page that cannot load its history should show an empty history, not a
 * 500: the run still happened.
 */
import { adminClient, supabaseConfigured } from "./supabase/admin";

export type RunRow = {
  runId: number;
  code: string;
  finishedAt: string;
  acts: number;
  players: number;
  callingId: string | null;
  bloodId: string | null;
  hookId: string | null;
  renown: number;
  keptScars: number;
  laurels: number;
  total: number;
  placement: number;
  hoard: boolean;
};

export type PlayerRecord = {
  runs: number;
  hoards: number;
  bestTotal: number;
  totalRenown: number;
  scarsKept: number;
  laurels: number;
  /** The Calling they reach for, and how often. */
  favouriteCalling: string | null;
  favouriteCallingRuns: number;
};

export async function getUserByUsername(username: string) {
  if (!supabaseConfigured()) return null;
  const { data } = await adminClient()
    .from("profiles")
    .select("id, username, created_at")
    .ilike("username", username)
    .maybeSingle();
  return data ?? null;
}

export async function getRunHistory(userId: string, limit = 40): Promise<RunRow[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await adminClient()
    .from("run_players")
    .select(
      "run_id, calling_id, blood_id, hook_id, renown, kept_scars, laurels, total, placement, hoard, runs(code, acts, players, finished_at)"
    )
    .eq("user_id", userId)
    .order("run_id", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return data.map((row) => {
    const run = row.runs as unknown as
      | { code: string; acts: number; players: number; finished_at: string }
      | null;
    return {
      runId: row.run_id as number,
      code: run?.code ?? "",
      finishedAt: run?.finished_at ?? "",
      acts: run?.acts ?? 0,
      players: run?.players ?? 0,
      callingId: row.calling_id as string | null,
      bloodId: row.blood_id as string | null,
      hookId: row.hook_id as string | null,
      renown: row.renown as number,
      keptScars: row.kept_scars as number,
      laurels: row.laurels as number,
      total: row.total as number,
      placement: row.placement as number,
      hoard: row.hoard as boolean,
    };
  });
}

/** Pure, so it can be tested without a database. */
export function summariseRuns(rows: RunRow[]): PlayerRecord {
  if (rows.length === 0)
    return {
      runs: 0,
      hoards: 0,
      bestTotal: 0,
      totalRenown: 0,
      scarsKept: 0,
      laurels: 0,
      favouriteCalling: null,
      favouriteCallingRuns: 0,
    };

  const byCalling = new Map<string, number>();
  for (const r of rows) {
    if (r.callingId) byCalling.set(r.callingId, (byCalling.get(r.callingId) ?? 0) + 1);
  }
  // Alphabetical tiebreak, so a tie renders the same on every reload.
  const favourite = [...byCalling.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0];

  return {
    runs: rows.length,
    hoards: rows.filter((r) => r.hoard).length,
    bestTotal: Math.max(...rows.map((r) => r.total)),
    totalRenown: rows.reduce((t, r) => t + r.renown, 0),
    scarsKept: rows.reduce((t, r) => t + r.keptScars, 0),
    laurels: rows.reduce((t, r) => t + r.laurels, 0),
    favouriteCalling: favourite?.[0] ?? null,
    favouriteCallingRuns: favourite?.[1] ?? 0,
  };
}

export async function getPlayerRecord(userId: string): Promise<PlayerRecord> {
  return summariseRuns(await getRunHistory(userId, 500));
}

export type LeaderboardRow = {
  username: string;
  hoards: number;
  runs: number;
  bestTotal: number;
};

/**
 * Ranked by Hoards taken, because that is what winning is here, then by best
 * single night. Deliberately not by total Renown accumulated: that rewards
 * playing a lot rather than playing well.
 *
 * Pure, so it can be tested without a database.
 */
export function rankPlayers(
  entries: { username: string; total: number; hoard: boolean }[],
  limit = 50
): LeaderboardRow[] {
  const byUser = new Map<string, LeaderboardRow>();
  for (const e of entries) {
    if (!e.username) continue;
    const row =
      byUser.get(e.username) ?? { username: e.username, hoards: 0, runs: 0, bestTotal: 0 };
    row.runs++;
    if (e.hoard) row.hoards++;
    row.bestTotal = Math.max(row.bestTotal, e.total ?? 0);
    byUser.set(e.username, row);
  }
  return [...byUser.values()]
    .sort(
      (a, b) =>
        b.hoards - a.hoards || b.bestTotal - a.bestTotal || a.username.localeCompare(b.username)
    )
    .slice(0, limit);
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  if (!supabaseConfigured()) return [];
  // ponytail: 2000 rows aggregated in Node. Swap for a materialised view when
  // there are enough runs that this is the slow part of the page.
  const { data, error } = await adminClient()
    .from("run_players")
    .select("total, hoard, profiles(username)")
    .not("user_id", "is", null)
    .limit(2000);
  if (error || !data) return [];

  return rankPlayers(
    data.map((row) => {
      const profile = row.profiles as unknown as { username: string } | null;
      return {
        username: profile?.username ?? "",
        total: (row.total as number) ?? 0,
        hoard: Boolean(row.hoard),
      };
    }),
    limit
  );
}
