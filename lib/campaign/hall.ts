/**
 * The Hall: what people did with somebody's dungeon, and what they thought.
 *
 * Two halves, deliberately. What HAPPENED is telemetry and nobody can fake it:
 * how many got out, what they scored against par, which floor stopped the rest.
 * What people THOUGHT is a mark, and a mark is only possible from somebody who
 * finished, which is enforced by a foreign key rather than by a route.
 *
 * A previous version of this game shipped a rating rule with a handle on it (bots
 * voted for whoever wore the most public Scars) and it turned out to be worth 78%
 * of games. That is the standard this has to clear: a rating anybody can steer is
 * worse than no rating, because it looks like information.
 */
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { MIN_FINISHERS, wilson } from "./hall-shared";

// Re-exported so the server side has one import for the whole Hall, while the
// browser can reach the threshold and the maths without reaching the database.
export { MIN_FINISHERS, wilson };

export type Standing = { finishers: number; marks: number; wilson: number };
export type RunRecord = {
  code: string;
  playerKey: string;
  score: number;
  par: number;
  finished: boolean;
  depth: number;
  stoppedOn: number | null;
};

const g = globalThis as unknown as {
  __tpRuns?: Map<string, RunRecord>;
  __tpMarks?: Set<string>;
};
const memRuns: Map<string, RunRecord> = (g.__tpRuns ??= new Map());
const memMarks: Set<string> = (g.__tpMarks ??= new Set());

const key = (code: string, player: string) => `${code.toUpperCase()}::${player}`;

/**
 * Record a finished (or abandoned) run, once per person per dungeon.
 *
 * The FIRST run is the one kept, and that is not laziness. It is the one played
 * blind, and after it you know all seven of the dungeon's numbers, so a second
 * attempt is not comparable to anybody else's first. Same reasoning the daily
 * uses for pinning its dice.
 */
export async function recordRun(run: RunRecord): Promise<void> {
  if (!supabaseConfigured()) {
    const k = key(run.code, run.playerKey);
    if (!memRuns.has(k)) memRuns.set(k, { ...run, code: run.code.toUpperCase() });
    return;
  }
  try {
    // Ignore a conflict rather than update: the first run stands.
    await adminClient()
      .from("dungeon_runs")
      .upsert(
        {
          code: run.code.toUpperCase(),
          player_key: run.playerKey,
          score: run.score,
          par: run.par,
          finished: run.finished,
          depth: run.depth,
          stopped_on: run.stoppedOn,
        },
        { onConflict: "code,player_key", ignoreDuplicates: true }
      );
  } catch (err) {
    console.warn("[hall] recordRun failed", err);
  }
}

export async function runOf(code: string, playerKey: string): Promise<RunRecord | null> {
  if (!supabaseConfigured()) return memRuns.get(key(code, playerKey)) ?? null;
  const { data } = await adminClient()
    .from("dungeon_runs")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("player_key", playerKey)
    .maybeSingle();
  if (!data) return null;
  return {
    code: data.code,
    playerKey: data.player_key,
    score: data.score,
    par: data.par,
    finished: data.finished,
    depth: data.depth,
    stoppedOn: data.stopped_on ?? null,
  };
}

/** Say it was worth your time. Only possible if you got to the bottom of it. */
export async function mark(code: string, playerKey: string): Promise<"marked" | "not_finished"> {
  const run = await runOf(code, playerKey);
  if (!run?.finished) return "not_finished";
  if (!supabaseConfigured()) {
    memMarks.add(key(code, playerKey));
    return "marked";
  }
  try {
    await adminClient()
      .from("dungeon_marks")
      .upsert({ code: code.toUpperCase(), player_key: playerKey }, { onConflict: "code,player_key" });
  } catch (err) {
    console.warn("[hall] mark failed", err);
  }
  return "marked";
}

export async function hasMarked(code: string, playerKey: string): Promise<boolean> {
  if (!supabaseConfigured()) return memMarks.has(key(code, playerKey));
  const { data } = await adminClient()
    .from("dungeon_marks")
    .select("code")
    .eq("code", code.toUpperCase())
    .eq("player_key", playerKey)
    .maybeSingle();
  return !!data;
}

export async function standingOf(code: string): Promise<Standing> {
  const upper = code.toUpperCase();
  if (!supabaseConfigured()) {
    const finishers = [...memRuns.values()].filter((r) => r.code === upper && r.finished).length;
    const marks = [...memMarks].filter((k) => k.startsWith(`${upper}::`)).length;
    return { finishers, marks, wilson: wilson(marks, finishers) };
  }
  const [{ count: finishers }, { count: marks }] = await Promise.all([
    adminClient()
      .from("dungeon_runs")
      .select("*", { count: "exact", head: true })
      .eq("code", upper)
      .eq("finished", true),
    adminClient().from("dungeon_marks").select("*", { count: "exact", head: true }).eq("code", upper),
  ]);
  const f = finishers ?? 0;
  const m = marks ?? 0;
  return { finishers: f, marks: m, wilson: wilson(m, f) };
}

/**
 * Where the runs that did not get out actually stopped.
 *
 * The author's most interesting number, and the one that turns the solver's one
 * honest limitation into a feature: the gate predicts a clear rate from perfect
 * play, and this is what people really did. "You said sixty percent would get
 * out. Thirty-one percent did."
 */
export async function floorReportFor(code: string): Promise<{
  plays: number;
  finished: number;
  stops: Record<number, number>;
  meanScore: number | null;
}> {
  const upper = code.toUpperCase();
  let rows: RunRecord[];
  if (!supabaseConfigured()) {
    rows = [...memRuns.values()].filter((r) => r.code === upper);
  } else {
    const { data } = await adminClient().from("dungeon_runs").select("*").eq("code", upper).limit(2000);
    rows = (data ?? []).map((d) => ({
      code: d.code,
      playerKey: d.player_key,
      score: d.score,
      par: d.par,
      finished: d.finished,
      depth: d.depth,
      stoppedOn: d.stopped_on ?? null,
    }));
  }
  const stops: Record<number, number> = {};
  for (const r of rows) {
    if (r.finished || r.stoppedOn === null) continue;
    stops[r.stoppedOn] = (stops[r.stoppedOn] ?? 0) + 1;
  }
  return {
    plays: rows.length,
    finished: rows.filter((r) => r.finished).length,
    stops,
    meanScore: rows.length ? rows.reduce((t, r) => t + r.score, 0) / rows.length : null,
  };
}
