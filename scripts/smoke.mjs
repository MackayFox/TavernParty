#!/usr/bin/env node
/**
 * A full three-player run, through the public HTTP API, against a running server.
 *
 *   npm run dev            # in one terminal
 *   npm run smoke          # in another
 *
 * Options (env or flags):
 *   --base=http://localhost:3000   SMOKE_BASE   where the server is
 *   --acts=3                       SMOKE_ACTS   how many Acts to play
 *
 * Why this exists. Every unit test in the repo talks to the engine directly,
 * which is the right way to test the rules and completely blind to the layer that
 * actually breaks in production: identity, redaction, zod schemas, the store, and
 * the fact that phases only advance because somebody polled. This script is the
 * only thing that exercises all of that, so it is the last gate before a human
 * looks at the site.
 *
 * Three things it is careful about.
 *
 * EACH SESSION KEEPS ITS OWN COOKIE JAR. Identity is a signed httpOnly cookie, so
 * three players are three jars. Share one and you have written a very convincing
 * test of one person playing alone.
 *
 * IT ONLY EVER POLLS. There are no server timers: `GET /api/tables/:code` is what
 * ticks a room and advances a deadline. So the loop below is a client, at a
 * client's poll rate, and the run takes as long as a real run takes.
 *
 * IT NEVER TELLS THE SERVER WHAT HAPPENED. Every assertion reads the redacted
 * view. If a check here can only be satisfied by the client being trusted, the
 * check is wrong.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (flag("base", process.env.SMOKE_BASE ?? "http://localhost:3000")).replace(/\/$/, "");
const ACTS = Number(flag("acts", process.env.SMOKE_ACTS ?? "3"));
const POLL_MS = 2000;
/** Generous: the run is on real deadlines, and a cold Next route can be slow. */
const HARD_LIMIT_MS = (60 + 35 + 30 + 70 + ACTS * 95 + 40 + 120) * 1000;

// ---------------------------------------------------------------------------
// Content the client would import. A .mjs script cannot import TypeScript, so it
// reads the two things it genuinely needs out of lib/content: the Hook ids and,
// per scene, the ids of the three Approaches and which one is Reckless. Scraped
// rather than hardcoded so renaming a scene breaks the script loudly instead of
// leaving it quietly testing a stale id.
// ---------------------------------------------------------------------------

function readContent(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

const HOOK_IDS = [...readContent("lib/content/hooks.ts").matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map(
  (m) => m[1]
);

/**
 * sceneId -> { approaches: string[], reckless: string | null }
 *
 * Structural rather than pattern based, because the two decks do not share an id
 * convention (`a01` with `a01-wade`, versus `b1` with `b1a`). The structure they
 * do share is the one the type guarantees: a scene id, then `approaches:`, then
 * exactly three approach ids, one of which is followed by `reckless: true`.
 */
const SCENES = {};
for (const file of ["lib/content/scenes-a.ts", "lib/content/scenes-b.ts"]) {
  let scene = null;
  let approach = null;
  let inApproaches = false;
  for (const t of readContent(file).matchAll(
    /\bid:\s*"([^"]+)"|\bapproaches:|\breckless:\s*true/g
  )) {
    const token = t[0];
    if (token.startsWith("approaches")) {
      inApproaches = true;
    } else if (token.startsWith("reckless")) {
      if (scene && approach) SCENES[scene].reckless = approach;
    } else if (inApproaches && scene && SCENES[scene].approaches.length < 3) {
      approach = t[1];
      SCENES[scene].approaches.push(approach);
      if (SCENES[scene].approaches.length === 3) inApproaches = false;
    } else {
      scene = t[1];
      approach = null;
      inApproaches = false;
      SCENES[scene] = { approaches: [], reckless: null };
    }
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const startedAt = Date.now();
let passed = 0;
const failures = [];
/** Module scope so the summary can report it even if the run threw. */
let phaseReached = "WAITING";

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
const say = (msg) => console.log(`\n[${elapsed()}] ${msg}`);

// ---------------------------------------------------------------------------
// HTTP, with a cookie jar per player
// ---------------------------------------------------------------------------

function session(label) {
  return { label, jar: new Map(), id: null, name: label };
}

async function call(s, method, urlPath, body) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (s.jar.size > 0) {
    headers.cookie = [...s.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  let res;
  try {
    res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  } catch (err) {
    return { status: 0, ok: false, json: null, error: String(err) };
  }
  // getSetCookie is the only way to read more than one Set-Cookie header.
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const raw of cookies) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) s.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON: an HTML error page, which the caller reports as-is */
  }
  return { status: res.status, ok: res.ok, json, text };
}

const post = (s, p, body) => call(s, "POST", p, body ?? {});
const get = (s, p) => call(s, "GET", p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Tavern Party smoke test`);
  console.log(`  server : ${BASE}`);
  console.log(`  acts   : ${ACTS}`);
  console.log(`  scenes : ${Object.keys(SCENES).length} parsed, ${HOOK_IDS.length} hooks\n`);

  const host = session("HOST");
  const two = session("TALL FEN");
  const three = session("WET HARRY");
  const humans = [host, two, three];

  // -- reachable? ----------------------------------------------------------
  const lobby = await get(host, "/api/tables");
  if (!check("server is up and GET /api/tables answers", lobby.ok && Array.isArray(lobby.json?.tables), `status ${lobby.status}${lobby.error ? ` ${lobby.error}` : ""}`)) {
    return;
  }

  // -- open a table --------------------------------------------------------
  const created = await post(host, "/api/tables", {
    name: "The smoke test",
    visibility: "public",
    displayName: host.name,
    settings: { maxPlayers: 5, acts: ACTS },
  });
  const code = created.json?.code;
  if (!check("host opens a table", created.ok && typeof code === "string" && code.length === 6, `status ${created.status} ${created.text?.slice(0, 120) ?? ""}`)) {
    return;
  }
  console.log(`      table ${code}`);

  const table = `/api/tables/${code}`;
  const viewAs = async (s) => (await get(s, table)).json;

  // -- two more sit down ---------------------------------------------------
  for (const s of [two, three]) {
    const joined = await post(s, `${table}/join`, { displayName: s.name });
    check(`${s.label} joins`, joined.ok, `status ${joined.status}`);
  }

  // -- and a stranger ------------------------------------------------------
  const bot = await post(host, `${table}/bot`);
  check("host sits a stranger down", bot.ok, `status ${bot.status}`);

  let view = await viewAs(host);
  check("four at the table, one of them a stranger", view?.players?.length === 4 && view.players.some((p) => p.isBot), `players ${view?.players?.length}`);

  const notHost = await post(two, `${table}/start`);
  check("a non-host cannot start the run", !notHost.ok && notHost.status === 400, `status ${notHost.status}`);

  // -- everybody learns their own id --------------------------------------
  for (const s of humans) {
    const v = await viewAs(s);
    s.id = v?.me?.id ?? null;
  }
  check("each session has its own identity", new Set(humans.map((s) => s.id)).size === 3 && humans.every((s) => s.id), humans.map((s) => s.id).join(", "));

  // -- start ---------------------------------------------------------------
  const startRun = await post(host, `${table}/start`);
  check("host starts the run", startRun.ok, `status ${startRun.status}`);

  view = await viewAs(host);
  check("phase is MUSTER and the house array is six numbers", view?.phase === "MUSTER" && view.houseArray?.length === 6, `phase ${view?.phase} array ${JSON.stringify(view?.houseArray)}`);

  // -----------------------------------------------------------------------
  // The polling loop. Everything below happens because a client polled.
  // -----------------------------------------------------------------------
  const done = new Set();
  const once = (key, fn) => {
    if (done.has(key)) return null;
    done.add(key);
    return fn();
  };
  phaseReached = view?.phase ?? "?";
  const deadline = Date.now() + HARD_LIMIT_MS;
  let actsSeen = 0;

  while (Date.now() < deadline) {
    // Every human polls, which is what ticks the room and keeps presence alive.
    const views = [];
    for (const s of humans) views.push([s, await viewAs(s)]);
    view = views[0][1];
    if (!view) {
      check("the table is still readable", false, "the poll came back empty");
      break;
    }

    if (view.phase !== phaseReached) {
      say(`phase ${phaseReached} -> ${view.phase}`);
      phaseReached = view.phase;
    }

    switch (view.phase) {
      case "DRAFT_CALLING":
      case "DRAFT_KIT": {
        const which = view.phase === "DRAFT_CALLING" ? "callingDraft" : "kitDraft";
        await once(`wants:${view.phase}`, async () => {
          for (const [s, v] of views) {
            const pool = v?.[which]?.pool ?? [];
            // Everybody wants the same thing first, on purpose: the draft is only
            // a game because it can deny you.
            const wants = [pool[0], pool[1], pool[2]].filter(Boolean);
            const r = await post(s, `${table}/wants`, { wants });
            check(`${s.label} submits ranked wants in ${view.phase}`, r.ok, `status ${r.status}`);
          }
        });
        break;
      }

      case "ASSIGN": {
        // The Callings were granted on the way in here.
        await once("draft-granted", async () => {
          const v = await viewAs(host);
          const callings = v.players.map((p) => p.callingId);
          check("everybody has a Calling and no two are the same", callings.every(Boolean) && new Set(callings).size === callings.length, JSON.stringify(callings));
          check("everybody has a piece of Kit", v.players.every((p) => p.kitIds?.length > 0), JSON.stringify(v.players.map((p) => p.kitIds)));
        });

        await once("assign", async () => {
          const array = view.houseArray ?? [];
          const abilities = ["brawn", "deft", "grit", "wits", "nerve", "charm"];
          for (const [i, s] of humans.entries()) {
            // A different arrangement of the same six numbers per player, so the
            // server is being asked to accept a permutation and nothing else.
            const rotated = array.map((_, j) => array[(j + i) % array.length]);
            const scores = Object.fromEntries(abilities.map((a, j) => [a, rotated[j]]));
            const r = await post(s, `${table}/assign`, {
              scores,
              hookId: HOOK_IDS[i % HOOK_IDS.length],
            });
            check(`${s.label} assigns the array and takes a Hook`, r.ok, `status ${r.status} ${r.text?.slice(0, 120) ?? ""}`);
          }
          // The array is the array: it may be rearranged, never rewritten.
          const cheat = Object.fromEntries(abilities.map((a) => [a, 18]));
          const rejected = await post(host, `${table}/assign`, { scores: cheat, hookId: HOOK_IDS[0] });
          check("the server refuses numbers the house did not roll", !rejected.ok, `status ${rejected.status}`);
        });
        break;
      }

      case "ACT": {
        const act = view.act;
        if (!act) break;
        await once(`commit:${act.index}`, async () => {
          actsSeen = Math.max(actsSeen, act.index);
          const scene = SCENES[act.sceneId];
          if (!check(`Act ${act.index} scene ${act.sceneId} is known to this script`, !!scene && scene.approaches.length === 3, `parsed ${JSON.stringify(scene)}`)) return;

          check(`Act ${act.index} keeps the Reckless target number back`, act.recklessTn === null, `recklessTn ${act.recklessTn}`);

          // One player goes through the contested door; the others take a safe
          // line. And the host shoves somebody towards it first, which is what
          // nomination is for.
          const nomination = await post(host, `${table}/nominate`, { nomineeId: two.id });
          check(`Act ${act.index}: host nominates somebody`, nomination.ok, `status ${nomination.status}`);
          const self = await post(host, `${table}/nominate`, { nomineeId: host.id });
          check(`Act ${act.index}: nobody can nominate themselves`, !self.ok, `status ${self.status}`);

          const safe = scene.approaches.filter((a) => a !== scene.reckless);
          for (const [i, s] of humans.entries()) {
            const approachId = i === 0 && scene.reckless ? scene.reckless : safe[i % safe.length];
            const r = await post(s, `${table}/commit`, { approachId, spendTokens: i === 0 ? 1 : 0 });
            check(`Act ${act.index}: ${s.label} commits`, r.ok, `status ${r.status} ${r.text?.slice(0, 120) ?? ""}`);
          }
          const twice = await post(host, `${table}/commit`, { approachId: safe[0], spendTokens: 0 });
          check(`Act ${act.index}: a second commit is refused`, !twice.ok, `status ${twice.status}`);
        });
        break;
      }

      case "ACT_RESULT": {
        const act = view.act;
        if (!act?.outcomes) break;
        await once(`result:${act.index}`, async () => {
          const outcomes = act.outcomes;
          check(`Act ${act.index}: everybody has an outcome`, outcomes.length === view.players.length, `${outcomes.length} of ${view.players.length}`);

          // The ledger is the point: a total is always the sum of named parts.
          const itemised = outcomes.every(
            (o) => Array.isArray(o.mods) && o.mods.length > 0 && o.mods.reduce((t, m) => t + m.value, 0) === o.total
          );
          check(`Act ${act.index}: every total is the sum of its named sources`, itemised, JSON.stringify(outcomes.map((o) => [o.total, o.mods])).slice(0, 200));

          // Same doctrine on the consequence side, which used to print one
          // figure with the Mark bonus, both doublings, any nomination payout
          // and the clamp at zero Renown all folded silently into it.
          const consequences = outcomes.every(
            (o) =>
              Array.isArray(o.costMods) &&
              o.costMods.reduce((t, m) => t + m.value, 0) === o.renownDelta
          );
          check(
            `Act ${act.index}: every Renown figure is the sum of its named causes`,
            consequences,
            JSON.stringify(outcomes.map((o) => [o.renownDelta, o.costMods])).slice(0, 240)
          );

          const scene = SCENES[act.sceneId];
          const onReckless = outcomes.filter((o) => o.approachId === scene?.reckless).length;
          check(`Act ${act.index}: at most one player took the Reckless line`, onReckless <= 1, `${onReckless} took it`);

          check(`Act ${act.index}: the Reckless target number is shown afterwards`, typeof act.recklessTn === "number", `recklessTn ${act.recklessTn}`);

          // Keep or hide, one decision each, alternating so both branches run.
          let keep = act.index % 2 === 0;
          for (const [s, v] of views) {
            for (const scar of (v?.me?.scars ?? []).filter((x) => x.kept === null)) {
              const r = await post(s, `${table}/scar`, { scarId: scar.id, keep });
              check(`Act ${act.index}: ${s.label} ${keep ? "keeps" : "hides"} a Scar`, r.ok, `status ${r.status}`);
              keep = !keep;
            }
          }
        });
        break;
      }

      case "BALLAD": {
        await once("laurel", async () => {
          const self = await post(host, `${table}/laurel`, { targetId: host.id });
          check("nobody can toast themselves", !self.ok, `status ${self.status}`);
          for (const [i, s] of humans.entries()) {
            const target = humans[(i + 1) % humans.length];
            const r = await post(s, `${table}/laurel`, { targetId: target.id });
            check(`${s.label} casts a Laurel`, r.ok, `status ${r.status}`);
          }
          const v = await viewAs(host);
          check("a Laurel is secret: only your own vote comes back", v.players.every((p) => p.hasVoted !== undefined) && v.me.laurelFor === humans[1].id && !("laurelFor" in v.players[0]), `me.laurelFor ${v.me?.laurelFor}`);
        });
        break;
      }

      case "FINAL":
        break;

      default:
        break;
    }

    if (view.phase === "FINAL") break;
    await sleep(POLL_MS);
  }

  // -- the ending ----------------------------------------------------------
  say(`phase reached: ${phaseReached}`);
  check("the run reached FINAL", phaseReached === "FINAL", `stopped at ${phaseReached}`);
  check(`all ${ACTS} Acts were played`, actsSeen === ACTS, `saw ${actsSeen}`);

  if (phaseReached === "FINAL") {
    const final = await viewAs(host);
    const standings = final?.standings ?? [];
    check("there are standings for everybody", standings.length === final.players.length, `${standings.length} of ${final.players.length}`);
    const winners = standings.filter((s) => s.hoard);
    check("exactly one player walks out with the Hoard", winners.length === 1, `${winners.length} winners: ${JSON.stringify(winners.map((w) => w.name))}`);
    check("every standing has a placement", standings.every((s) => s.placement >= 1), JSON.stringify(standings.map((s) => s.placement)));
    if (winners[0]) console.log(`      ${winners[0].name} takes it on ${winners[0].total}`);

    // -- another round -----------------------------------------------------
    const notHostAgain = await post(two, `${table}/again`);
    check("a non-host cannot call for another round", !notHostAgain.ok, `status ${notHostAgain.status}`);

    const again = await post(host, `${table}/again`);
    check("host calls for a rematch", again.ok, `status ${again.status}`);

    const reset = await viewAs(host);
    check(
      "the table is back to WAITING with the night wiped",
      reset?.phase === "WAITING" &&
        reset.dread === 0 &&
        !reset.standings &&
        reset.houseArray === null &&
        reset.players.length === final.players.length &&
        reset.players.every((p) => p.renown === 0 && p.callingId === null && p.scars.length === 0),
      `phase ${reset?.phase} dread ${reset?.dread}`
    );
  }
}

await main().catch((err) => {
  check("the script itself did not throw", false, String(err?.stack ?? err));
});

console.log(`\n${"-".repeat(60)}`);
console.log(`${passed} passed, ${failures.length} failed, ${elapsed()} wall clock`);
console.log(`phase reached: ${phaseReached}`);
if (failures.length > 0) {
  console.log(`\nfailed checks:`);
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failures.length > 0 ? 1 : 0);
