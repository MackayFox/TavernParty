/**
 * Apply supabase/migrations/*.sql (in name order) to the database.
 * Tracks applied migrations in _migrations, so re-runs are safe.
 *
 *   node scripts/db.mjs migrate
 *   node scripts/db.mjs status
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local loader (no dotenv dependency).
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // No .env.local — rely on the ambient environment (CI).
}

// TLS is on; chain verification is off because Supabase signs Postgres certs
// with its own CA (not in Node's trust store). This script runs locally or in
// CI against a pinned host, never in the app runtime.
const ssl = { rejectUnauthorized: false };

async function connect() {
  const direct = process.env.SUPABASE_DIRECT_CONNECTION_STRING;
  if (direct) {
    const client = new pg.Client({ connectionString: direct, ssl, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      console.log("connected directly");
      return client;
    } catch (err) {
      console.warn(`direct connection failed (${err.code ?? err.message}); trying session pooler`);
    }
  }
  // The direct host is IPv6-only on newer projects; fall back to the IPv4 pooler.
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const region = process.env.SUPABASE_PROJECT_REGION;
  const password = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "");
  if (!projectId || !region || !password) {
    throw new Error(
      "Set SUPABASE_DIRECT_CONNECTION_STRING, or SUPABASE_PROJECT_ID + SUPABASE_PROJECT_REGION + SUPABASE_DB_PASSWORD."
    );
  }
  for (const n of [1, 0]) {
    const url = `postgresql://postgres.${projectId}:${password}@aws-${n}-${region}.pooler.supabase.com:5432/postgres`;
    const pooled = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 8000 });
    try {
      await pooled.connect();
      console.log(`connected via aws-${n} session pooler`);
      return pooled;
    } catch (e2) {
      console.warn(`aws-${n} pooler failed (${e2.code ?? e2.message})`);
    }
  }
  throw new Error("Could not reach the database on any host.");
}

const client = await connect();
const cmd = process.argv[2] ?? "migrate";

/**
 * Which schema the migrations build in.
 *
 * `public` unless this site is a lodger in somebody else's Supabase project, in
 * which case four of its table names collide with the sites already there. See
 * lib/supabase/admin.ts for the whole argument. Every migration is written with
 * unqualified names, so setting the search path is all it takes: nothing in the
 * SQL knows or cares.
 *
 * The grants are not optional. PostgREST connects as `authenticator` and switches
 * role, so without USAGE on the schema every query fails with a permission error
 * that names a role nobody has heard of.
 */
const schema = (process.env.SUPABASE_DB_SCHEMA ?? "").trim() || "public";

try {
  if (schema !== "public") {
    console.log(`schema: ${schema}`);
    await client.query(`create schema if not exists ${schema}`);
    await client.query(`grant usage on schema ${schema} to anon, authenticated, service_role`);
    await client.query(
      `alter default privileges in schema ${schema} grant all on tables to anon, authenticated, service_role`
    );
    await client.query(
      `alter default privileges in schema ${schema} grant all on functions to anon, authenticated, service_role`
    );
  }
  // Everything below runs inside the chosen schema, including the ledger of what
  // has been applied: two sites in one database need two ledgers, or the second
  // one thinks the first one's migrations were its own.
  await client.query(`set search_path to ${schema}, public`);

  await client.query(
    `create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`
  );
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  if (cmd === "status") {
    const { rows } = await client.query(`select name, applied_at from _migrations order by name`);
    const applied = new Set(rows.map((r) => r.name));
    for (const f of files) console.log(`${applied.has(f) ? "applied" : "PENDING"}  ${f}`);
    process.exit(0);
  }

  if (cmd !== "migrate") {
    console.error(`unknown command: ${cmd}`);
    process.exit(1);
  }

  for (const file of files) {
    const { rows } = await client.query(`select 1 from _migrations where name = $1`, [file]);
    if (rows.length) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(`insert into _migrations (name) values ($1)`, [file]);
      await client.query("commit");
      console.log(`apply ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${file}: ${err.message}`);
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
