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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn(
      "[boot] No Supabase configured. Multiplayer and the boards are using the " +
        "in-memory store. On a single server that works; on a serverless host each " +
        "instance gets its own copy, so two players may not see the same table."
    );
  }
}
