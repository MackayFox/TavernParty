/**
 * Service-role client. Server only, bypasses RLS. Used by the game store,
 * persistence and rate limiting. Never import this from a client component.
 *
 * WHICH POSTGRES SCHEMA IT TALKS TO, and why that is a variable.
 *
 * Supabase bills per organisation and the free tier allows two projects. Tavern
 * Party is the third site in the network, so until there is a plan with room for
 * it, its tables have to live somewhere that already exists. Four of them collide
 * by name with the sites already deployed (`profiles`, `daily_results`,
 * `rate_limits`, `contact_messages`) and so do two functions, which rules out
 * sharing `public`: one pool of usernames across two games, and two games' daily
 * scores in one table, is not a compromise, it is a data-loss bug with a delay on
 * it.
 *
 * So the schema is a variable, defaulting to `public`. Point it at `tavern` and
 * this site keeps its own tables inside somebody else's project; leave it alone
 * and nothing about the deployment changes. The reason it is a variable rather
 * than a rename is that renaming is the thing you cannot undo cheaply: when the
 * plan has room, moving to a dedicated project means changing this one value back
 * and running the migrations, with no code to unpick.
 *
 * ONE THING IT CANNOT DO FROM HERE. PostgREST only serves schemas that are listed
 * as exposed in the project's API settings, and that is a dashboard field. Set
 * `SUPABASE_DB_SCHEMA` without exposing the schema and every query comes back
 * "schema must be one of the following", which is at least a clear error.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Where this site's tables live. `public` unless it is a lodger. */
export function dbSchema(): string {
  return process.env.SUPABASE_DB_SCHEMA?.trim() || "public";
}

export function supabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the new-style secret key; fall back to the legacy service-role JWT.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  /**
   * Cast because the schema is a runtime value.
   *
   * `SupabaseClient` carries the schema name as a type parameter, which is worth
   * something when the schema is a literal and the database types are generated.
   * Neither is true here: this project has no generated types, and which schema it
   * talks to is decided by an environment variable. The cast says so plainly
   * rather than threading a generic nobody reads.
   */
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: dbSchema() },
  }) as unknown as SupabaseClient;
  return cached;
}
