/**
 * WHICH SCHEMAS POSTGREST SERVES, as a pure function of what is already there.
 *
 * Split out of `db.mjs` so it can be tested without a database: that file opens
 * a connection at the top level, so importing it from a test would try to reach
 * production.
 *
 * This is the part worth testing. `npm run db:expose` runs against a Supabase
 * project SHARED with another live site, and the entire safety property of the
 * command is that it adds and never replaces. Getting it wrong would take the
 * other site's API off the air, which is a worse outage than the one it exists
 * to fix and one nobody would think to connect to having run this.
 */

/**
 * The exposed-schema list currently on the `authenticator` role.
 *
 * `rolconfig` is a text[] of `key=value` strings. When PostgREST's list is not
 * on the role at all the value is coming from the project's own configuration,
 * and the default Supabase ships is the pair below, which is exactly what the
 * error names when a schema is missing: "Only the following schemas are
 * exposed: public, graphql_public".
 */
export function exposedList(rolconfig) {
  const found = (rolconfig ?? [])
    .map((c) => /^pgrst\.db_schemas=(.*)$/.exec(String(c))?.[1])
    .find((v) => v !== undefined);
  return (found ?? "public, graphql_public")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The list with our schema on it. Additive, order-preserving, idempotent.
 *
 * Returns the same array contents when the schema is already there, so the
 * caller can compare lengths and skip the write entirely rather than issuing an
 * ALTER ROLE that changes nothing.
 */
export function mergeExposed(rolconfig, schema) {
  const current = exposedList(rolconfig);
  return current.includes(schema) ? current : [...current, schema];
}
