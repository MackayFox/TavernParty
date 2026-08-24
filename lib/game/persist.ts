/**
 * Writing a finished run into the permanent record.
 *
 * Only ever called once, on the transition into FINAL, and deliberately
 * best-effort: a failure here must never stop a table seeing its own standings.
 * The run happened whether or not we managed to write it down.
 *
 * Guests are not persisted at all. They played, they saw the result, and their
 * streaks live in their own browser. That is the whole reason the site works
 * before any database exists.
 */
import { adminClient, supabaseConfigured } from "../supabase/admin";
import type { Room } from "./types";

/** A registered player has a UUID; a guest has a signed cookie id. */
function isRegisteredId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function persistRun(room: Room): Promise<void> {
  if (!supabaseConfigured()) return;
  const standings = room.standings;
  if (!standings || standings.length === 0) return;

  try {
    const db = adminClient();
    const { data: run, error } = await db
      .from("runs")
      .insert({
        code: room.code,
        acts: room.settings.acts,
        players: room.players.length,
        dread: room.dread,
      })
      .select("id")
      .single();
    if (error || !run) {
      console.warn("[persist] could not write the run", error);
      return;
    }

    const rows = standings.map((s) => {
      const p = room.players.find((x) => x.id === s.playerId);
      return {
        run_id: run.id,
        // A guest is recorded by name only. There is nothing to attach them to,
        // and inventing a row for them would be a foreign key waiting to fail.
        user_id: isRegisteredId(s.playerId) ? s.playerId : null,
        name: s.name,
        calling_id: p?.callingId ?? null,
        blood_id: p?.bloodId ?? null,
        hook_id: p?.hookId ?? null,
        renown: s.renown,
        kept_scars: s.keptScars,
        laurels: s.laurels,
        total: s.total,
        placement: s.placement,
        hoard: s.hoard,
      };
    });

    const { error: playersError } = await db.from("run_players").insert(rows);
    if (playersError) console.warn("[persist] could not write the players", playersError);
  } catch (err) {
    console.warn("[persist] failed", err);
  }
}
