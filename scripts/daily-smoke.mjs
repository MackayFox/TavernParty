#!/usr/bin/env node
/**
 * The four dailies, played to completion against a running server.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke:daily    # in another
 *
 * Options (env or flags):
 *   --base=http://localhost:3000   SMOKE_BASE   where the server is
 *   --game=ledger                  only that one
 *
 * THE CONTRACT THIS ASSERTS
 *
 *   GET  /api/daily                    -> { games: ["<slug>", ...] }   (optional)
 *   GET  /api/daily/<slug>?date=ISO    -> { date, par, ...the puzzle }
 *   POST /api/daily/<slug>  { date, ...an answer }  -> { score, par }
 *
 * and four properties, in descending order of how badly getting them wrong would
 * hurt:
 *
 *   1. THE ANSWER IS NEVER IN THE PAYLOAD. A daily is scored server side. If
 *      today's solution can be read out of the JSON the page was served, the
 *      leaderboard is decoration. Checked two ways: no field is named like an
 *      answer, and nothing the submission response reveals as the answer can be
 *      found in the bytes of the initial GET.
 *   2. A CLAIMED SCORE IS NOT A SCORE. Posting a score rather than an answer must
 *      not produce that score. Rejecting it outright and ignoring it are both
 *      correct; echoing it back is not.
 *   3. IT PLAYS TO COMPLETION AND A SCORE COMES BACK.
 *   4. A FUTURE OR MALFORMED DATE FALLS BACK TO TODAY. Otherwise tomorrow's
 *      puzzle is one query string away, and `?date=<script>` is one after that.
 *
 * ponytail: `buildAnswer` below is the one place that knows the shape of a
 * submission, and it sniffs the payload rather than hardcoding four schemas. When
 * a daily's payload changes, that function is the only thing to edit. If it
 * cannot recognise a payload it fails the check and prints the keys it did find,
 * which is the useful failure rather than a silent pass.
 */

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = flag("base", process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const ONLY = flag("game", null);

/** Used only if GET /api/daily does not list them. */
const DEFAULT_GAMES = ["long-way-down", "table-of-six", "ledger", "muster"];

const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = "2099-12-31";
const RUBBISH = "not-a-date";

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const startedAt = Date.now();
let passed = 0;
const failures = [];

function check(label, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
  return ok;
}

const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;

// ---------------------------------------------------------------------------
// HTTP, with one cookie jar for the whole script: a daily is a solo game.
// ---------------------------------------------------------------------------

const jar = new Map();

async function call(method, urlPath, body) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (jar.size > 0) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  let res;
  try {
    res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  } catch (err) {
    return { status: 0, ok: false, json: null, text: "", error: String(err) };
  }
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* an HTML error page; the caller reports the status */
  }
  return { status: res.status, ok: res.ok, json, text };
}

const get = (p) => call("GET", p);
const post = (p, body) => call("POST", p, body);

// ---------------------------------------------------------------------------
// Leak detection
// ---------------------------------------------------------------------------

const ANSWER_KEY = /^(answer|answers|solution|solutions|correct|expected|secret|key|solved)$/i;

/** Every key anywhere in the payload that reads like the answer. */
function answerShapedKeys(value, trail = "") {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => answerShapedKeys(v, `${trail}[${i}]`));
  return Object.entries(value).flatMap(([k, v]) =>
    ANSWER_KEY.test(k) ? [`${trail}.${k}`] : answerShapedKeys(v, `${trail}.${k}`)
  );
}

/**
 * Whatever the submission response reveals as the answer, in a form we can look
 * for in the initial payload. A daily is allowed to hand the answer over AFTER
 * you have played, which is exactly why the before-and-after comparison is the
 * check that matters.
 */
function revealedAnswer(json) {
  if (!json || typeof json !== "object") return null;
  for (const [k, v] of Object.entries(json)) {
    if (!ANSWER_KEY.test(k)) continue;
    // A verdict is not an answer. `solved: false` matches the key pattern, and
    // searching the initial payload for the string "false" finds `archive:false`
    // in every single one of them, so a boolean here reports a leak that is not
    // there. Only a structure or a real string can be the answer being handed
    // over; the key pattern still catches a boolean on the GET side, where a
    // `solved` field genuinely would be a leak.
    if (typeof v === "object" && v !== null) return JSON.stringify(v);
    if (typeof v === "string" && v.length > 1) return JSON.stringify(v);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Playing one
// ---------------------------------------------------------------------------

/**
 * Turn a puzzle payload into a submission the route will actually accept.
 *
 * One builder per game, written against that route's zod schema. This used to be
 * a single structural guesser with a chain of `?? ` fallbacks for every
 * plausible field name, which is a tempting shape for a script written before
 * the routes exist and a worthless one afterwards: it guessed wrong on all four
 * and produced a 400 from every daily, which reads as four broken games rather
 * than as one wrong script.
 *
 * A builder returns null when the payload stops looking like the game it is
 * meant to be, so a contract change fails loudly here instead of quietly posting
 * something the route happens to tolerate.
 */
const BUILDERS = {
  /**
   * Five drinkers, five amounts, one amount each. Closing the ledger is the
   * final answer. The permutation below is almost certainly the wrong one, and
   * that is fine: the check is that the server scores it, not that this script
   * can solve a logic puzzle.
   */
  ledger(p) {
    if (!Array.isArray(p.names) || !Array.isArray(p.amounts)) return null;
    if (p.names.length !== p.amounts.length) return null;
    return { assignment: p.names.map((_, i) => i), mode: "close", checksUsed: 0 };
  },

  /** One door per Act, and deliberately never the Reckless one. */
  longway(p) {
    if (!Array.isArray(p.acts) || p.acts.length === 0) return null;
    const choices = [];
    for (const act of p.acts) {
      const doors = act?.doors;
      if (!Array.isArray(doors) || doors.length === 0) return null;
      const door = doors.find((d) => !d.reckless) ?? doors[0];
      if (typeof door?.id !== "string") return null;
      choices.push({ doorId: door.id, spend: 0 });
    }
    return { choices };
  },

  /** The house array placed one number per ability, plus a Calling and a Kit. */
  muster(p) {
    if (!Array.isArray(p.array) || !Array.isArray(p.abilities)) return null;
    if (p.array.length !== p.abilities.length) return null;
    const callingId = p.callings?.[0]?.id;
    const kitId = p.kit?.[0]?.id;
    if (typeof callingId !== "string" || typeof kitId !== "string") return null;
    return { placement: p.array.map((_, i) => i), callingId, kitId };
  },

  /** Six rolls, six obstacles, one roll each. */
  tableofsix(p) {
    if (!Array.isArray(p.faces) || !Array.isArray(p.obstacles)) return null;
    if (p.faces.length !== p.obstacles.length) return null;
    return { slots: p.obstacles.map((_, i) => i) };
  },
};

function buildAnswer(game, payload) {
  if (!payload || typeof payload !== "object") return null;
  return BUILDERS[game]?.(payload) ?? null;
}

async function playOne(game) {
  console.log(`\n--- ${game} ---`);

  // 1. Today's puzzle -----------------------------------------------------
  const today = await get(`/api/daily/${game}?date=${TODAY}`);
  if (
    !check(
      `${game}: today's puzzle is served`,
      today.ok && !!today.json,
      `status ${today.status} ${today.error ?? today.text.slice(0, 120)}`
    )
  ) {
    return;
  }
  const payload = today.json;
  check(`${game}: the payload says which date it is`, payload.date === TODAY, `date ${payload.date}`);

  // 2. No answer in it ----------------------------------------------------
  const leaks = answerShapedKeys(payload);
  check(`${game}: nothing in the payload is named like an answer`, leaks.length === 0, leaks.join(", "));

  // 3. A claimed score is not a score -------------------------------------
  const claimed = await post(`/api/daily/${game}`, { date: TODAY, score: 999_999 });
  const claimedBack = claimed.json?.score;
  check(
    `${game}: a client-claimed score is not accepted as the score`,
    !claimed.ok || claimedBack !== 999_999,
    `status ${claimed.status} score ${claimedBack}`
  );

  // 4. Play it ------------------------------------------------------------
  const answer = buildAnswer(game, payload);
  if (
    !check(
      `${game}: this script recognises the payload well enough to answer it`,
      answer !== null,
      `top-level keys: ${Object.keys(payload).join(", ")}`
    )
  ) {
    return;
  }

  const played = await post(`/api/daily/${game}`, { date: TODAY, ...answer });
  const score = played.json?.score;
  check(
    `${game}: playing it to completion returns a score`,
    played.ok && typeof score === "number" && Number.isFinite(score),
    `status ${played.status} body ${played.text.slice(0, 160)}`
  );
  if (typeof played.json?.par === "number") {
    console.log(`      score ${score}, par ${played.json.par}`);
  }

  // 5. The answer was not in the payload before we played -----------------
  const revealed = revealedAnswer(played.json);
  if (revealed) {
    check(
      `${game}: the answer revealed on submission was not already in the payload`,
      !today.text.includes(revealed.replace(/^"|"$/g, "")),
      `found ${revealed.slice(0, 80)} in the initial GET`
    );
  }

  // 6. Dates --------------------------------------------------------------
  const future = await get(`/api/daily/${game}?date=${FUTURE}`);
  check(
    `${game}: a future date falls back to today`,
    future.ok && future.json?.date === TODAY,
    `status ${future.status} date ${future.json?.date}`
  );

  const rubbish = await get(`/api/daily/${game}?date=${encodeURIComponent(RUBBISH)}`);
  check(
    `${game}: a malformed date falls back to today`,
    rubbish.ok && rubbish.json?.date === TODAY,
    `status ${rubbish.status} date ${rubbish.json?.date}`
  );

  // A future puzzle must not be reachable by any route, so its payload must be
  // byte-identical to today's rather than merely labelled today.
  if (future.ok && rubbish.ok) {
    check(
      `${game}: the fallback serves today's puzzle, not a relabelled one`,
      future.text === today.text && rubbish.text === today.text,
      "the fallback payload differs from today's"
    );
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Tavern Party daily smoke test`);
  console.log(`  server : ${BASE}`);
  console.log(`  date   : ${TODAY}`);

  const index = await get("/api/daily");
  let games = Array.isArray(index.json?.games) ? index.json.games : null;
  if (games) {
    games = games.map((g) => (typeof g === "string" ? g : g?.id ?? g?.slug)).filter(Boolean);
  }
  if (!games || games.length === 0) {
    console.log(`  games  : GET /api/daily did not list them, using the built-in list`);
    games = DEFAULT_GAMES;
  }
  if (ONLY) games = games.filter((g) => g === ONLY);
  console.log(`  games  : ${games.join(", ")}`);

  check("there are four dailies", games.length === 4 || !!ONLY, `found ${games.length}`);

  for (const game of games) await playOne(game);
}

await main().catch((err) => {
  check("the script itself did not throw", false, String(err?.stack ?? err));
});

console.log(`\n${"-".repeat(60)}`);
console.log(`${passed} passed, ${failures.length} failed, ${elapsed()} wall clock`);
if (failures.length > 0) {
  console.log(`\nfailed checks:`);
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failures.length > 0 ? 1 : 0);
