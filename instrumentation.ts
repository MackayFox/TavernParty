/**
 * WHAT HAS TO BE TRUE BEFORE THIS SERVER TAKES A REQUEST.
 *
 * Next runs `register` once when the server process starts, before any route is
 * served, which is the only place a missing environment variable can be turned
 * into a crash rather than a mystery.
 *
 * THE FAILURE THIS EXISTS FOR, found by actually starting a production build
 * with an empty environment. Without GUEST_COOKIE_SECRET the site came up, served
 * the front page, served all four dailies, rendered the Deep Run, and then died
 * with "Something went wrong on our end" the first time somebody tried to sit at
 * a table. The secret is only read when an identity is minted, so the fault hides
 * behind every page that does not need one. FRIDAY.md claimed production refused
 * to start without it. It did not. It refused to let anybody play, which is worse,
 * because it looks like a bug in the game.
 *
 * Loud and early, then, with the fix in the message. A deploy that is missing a
 * variable should fail in the build log where somebody is already looking, not in
 * one player's console an hour later.
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!process.env.GUEST_COOKIE_SECRET) missing.push("GUEST_COOKIE_SECRET");

  if (missing.length > 0) {
    const what = missing.join(", ");
    // Thrown rather than logged: a process that carries on is a process somebody
    // will point a domain at.
    throw new Error(
      `Refusing to start: ${what} is not set. Guest identity is signed with it, so ` +
        `without it nobody can sit at a table or post a daily score, and every page ` +
        `that does not need an identity will look perfectly fine. Set it to any long ` +
        `random string in the Vercel project's environment variables and redeploy. ` +
        `It must be the same value across deployments, or every existing guest cookie ` +
        `stops verifying and everybody loses their scores.`
    );
  }

  /**
   * Supabase is optional and its absence is NOT an error: the whole site runs on
   * the in-memory store, which is how it was built and tested before there was a
   * database. But on a serverless host that store is per instance, so two players
   * can land on two different machines and see two different tables. It is worth
   * one line in the log rather than a silent difference in behaviour.
   */
  /**
   * Ask the same question the store asks, not a similar one.
   *
   * This used to read NEXT_PUBLIC_SUPABASE_URL directly, which is wrong twice
   * over: Next inlines NEXT_PUBLIC_* at BUILD time, so the value here is whatever
   * was set when the bundle was made rather than what the server is running with,
   * and the store's own decision also depends on the secret key. The two could
   * therefore disagree, and did: a build carrying a URL but running without a key
   * took the "database is configured" branch and then failed to reach it, so the
   * in-memory store was used without being seeded and without the warning that
   * explains it.
   */
  const { supabaseConfigured } = await import("@/lib/supabase/admin");
  if (!supabaseConfigured()) {
    console.warn(
      "[boot] No Supabase configured. Multiplayer and the boards are using the " +
        "in-memory store. On a single server that works; on a serverless host each " +
        "instance gets its own copy, so two players may not see the same table."
    );
    await seedMemory();
    return;
  }

  await checkDatabase();
}

/**
 * Ask the database one question at boot, so a misconfiguration says what it is.
 *
 * Written after a real deployment spent an afternoon answering "Something went
 * wrong on our end" to every request that touched a table. The cause was one
 * sentence long and PostgREST was saying it on every single response: the schema
 * this site's tables live in was not in the project's exposed list. Nobody reads
 * a 500 body, and every page that needs no database looked perfect.
 *
 * A warning rather than a throw. A site whose dailies work is worth serving even
 * when its multiplayer cannot, and the four daily games need no database at all.
 */
async function checkDatabase() {
  try {
    const { adminClient, dbSchema } = await import("@/lib/supabase/admin");
    const { error } = await adminClient().from("tables").select("code").limit(1);
    if (!error) {
      console.warn(`[boot] Database reachable, schema ${dbSchema()}.`);
      return;
    }
    const schema = dbSchema();
    // PGRST106 is the one that costs an afternoon, so it gets the instructions.
    const hint =
      error.code === "PGRST106" || /Invalid schema/i.test(error.message)
        ? `The schema "${schema}" is not exposed by the API. Add it in the Supabase ` +
          `dashboard under Settings, API, Exposed schemas, next to "public". Nothing ` +
          `needs redeploying afterwards: this is read per request.`
        : error.code === "PGRST205" || /Could not find the table/i.test(error.message)
          ? `The tables are not in schema "${schema}". Run npm run db:migrate with ` +
            `SUPABASE_DB_SCHEMA set to the same value this deployment uses.`
          : "Check the project URL and the service key.";
    console.warn(
      `[boot] DATABASE NOT USABLE (${error.code ?? "unknown"}): ${error.message}
` +
        `[boot] ${hint}
` +
        `[boot] The four dailies need no database and will work. Tables, the Hall ` +
        `and the dungeon builder will not.`
    );
  } catch (err) {
    console.warn("[boot] Could not reach the database at all.", err);
  }
}

/**
 * Put the shelf and the house's own dungeon in the in-memory store.
 *
 * Only on memstore, and that condition is the whole point. With a database the
 * shelf is seeded once with `npm run seed:rooms` and stays there; without one it
 * dies with the process, so every restart left the Hall empty and the desk with
 * nothing to pick from. Somebody opening the builder for the first time on a
 * fresh server met a shelf with nothing on it, which is exactly the cold start
 * the shelf exists to prevent.
 *
 * Deliberately quiet about failure. This is a convenience for a server with no
 * database, and a site that runs is worth more than a site that refuses to start
 * because its demo content did not load.
 */
async function seedMemory() {
  try {
    const { seedHouseContent } = await import("@/lib/campaign/seed");
    const { rooms, demo } = await seedHouseContent();
    console.warn(
      `[boot] Shelf seeded with ${rooms} rooms. ` +
        (demo?.published
          ? `The Stone Walk is up: ${demo.difficulty}, par ${demo.par}.`
          : "The Stone Walk did not publish, which means the gate refused it.")
    );
  } catch (err) {
    console.warn("[boot] Could not seed the house content.", err);
  }
}
