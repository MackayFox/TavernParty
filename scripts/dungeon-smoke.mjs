#!/usr/bin/env node
/**
 * The whole authoring loop against a running server.
 *
 *   npm run dev              # in one terminal
 *   npm run smoke:dungeon    # in another
 *
 * The unit tests cover the same seams, and they still missed two real bugs that
 * this catches, which is the whole argument for having it: a guest could open a
 * draft and never edit it, and the share text linked to the wrong game. Both
 * needed a real cookie jar and a real server, because both were about identity
 * and URLs rather than about logic.
 *
 * THE PROPERTIES IT ASSERTS, worst-first:
 *
 *   1. THE DOOR CARRIES NO ANSWER. A dungeon's GET must not contain the win or
 *      lose prose of any door, and must not contain a die. Somebody who reads
 *      the JSON must not know more than somebody who reads the page.
 *   2. THE GATE CANNOT BE ROUTED AROUND. Publishing a dungeon nobody can finish
 *      has to fail even though the desk is the thing that normally checks.
 *   3. A PUBLISHED DUNGEON IS FROZEN, or a score posted on Tuesday was set on a
 *      different dungeon to the one somebody plays on Thursday.
 *   4. IT PLAYS, through the same handler as the daily, and the share points at
 *      the dungeon.
 *   5. SOMEBODY ELSE'S DRAFT IS NOT YOURS.
 */

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = flag("base", process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
const failures = [];
const started = Date.now();

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

/** One jar per author, because ownership is the thing most likely to be wrong. */
function jar() {
  const cookies = new Map();
  return {
    async call(method, path, body) {
      const headers = { accept: "application/json" };
      if (body !== undefined) headers["content-type"] = "application/json";
      if (cookies.size)
        headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const pair = raw.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* an HTML error page; the caller reports the status */
      }
      return { status: res.status, ok: res.ok, json, text };
    },
  };
}

const SETUP =
  "The floor gives way to a stair nobody built, and the air coming up it is warm and smells of nothing at all.";

function room(id, band, a1, tn1, a2, tn2, costOverride) {
  // Cost normally follows the band. The impossible fixture overrides it, because
  // a band-3 cost of 4 against a starting Vigour of 5 is survivable and the first
  // version of that fixture published happily.
  const cost = costOverride ?? band + 1;
  return {
    id,
    band,
    title: `The ${id} Floor`,
    setup: SETUP,
    options: [
      { id: `${id}a`, label: "Force it", kind: "check", ability: a1, tn: tn1, vigour: cost,
        promise: "Straight at it, and quickly.", win: "It gives, and you are through.",
        lose: "It does not give, and you feel that for a while." },
      { id: `${id}b`, label: "Work it out", kind: "check", ability: a2, tn: tn2, vigour: cost,
        promise: "Look at it properly first.", win: "You see the way of it and take it.",
        lose: "You do not see it, and looking cost you." },
      { id: `${id}c`, label: "Take the hit", kind: "brace", vigour: cost,
        promise: "Pay and pass.", win: "You are through, and it cost you.",
        lose: "You are through, and it cost you." },
    ],
  };
}

const GOOD = {
  title: "The Weeping Stair",
  intro: "Wet from the first floor to the last, and do not count on a rope.",
  rooms: [
    room("first", 2, "brawn", 14, "wits", 15),
    room("second", 2, "wits", 14, "grit", 15),
    room("third", 3, "brawn", 17, "charm", 16),
  ],
  callingIds: ["warden", "knife", "hedgewitch"],
  kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
  baseVigour: 9,
};

/** Legal at the wire and impossible in play. */
const IMPOSSIBLE = {
  ...GOOD,
  title: "Nobody Comes Back",
  // Eight floors, the highest target and the highest cost the wire will carry,
  // against the least Vigour anybody may start with.
  rooms: Array.from({ length: 8 }, (_, i) => room(`x${i}`, 3, "brawn", 20, "wits", 20, 8)),
  baseVigour: 5,
};

async function main() {
  console.log(`\nTHE DESK`);
  console.log(`  base   : ${BASE}`);

  const alex = jar();
  const bev = jar();

  // ---- 2. the gate cannot be routed around ------------------------------
  const bad = await alex.call("POST", "/api/dungeons", { name: "ALEX" });
  if (!check("a draft opens with a code", !!bad.json?.code, `status ${bad.status}`)) return;
  await alex.call("PUT", `/api/dungeons/${bad.json.code}`, IMPOSSIBLE);
  const refused = await alex.call("POST", `/api/dungeons/${bad.json.code}/publish`, {});
  check(
    "the gate refuses one nobody can get out of",
    refused.status === 400 && refused.json?.report?.ok === false,
    `status ${refused.status}`
  );
  check(
    "and it names the floor they stop on",
    /floor \d/.test(JSON.stringify(refused.json?.report?.notes ?? [])),
    JSON.stringify(refused.json?.report?.notes ?? []).slice(0, 160)
  );

  // ---- the happy path ---------------------------------------------------
  const made = await alex.call("POST", "/api/dungeons", { name: "ALEX" });
  const code = made.json?.code;
  if (!check("a second draft opens", !!code, `status ${made.status}`)) return;

  const saved = await alex.call("PUT", `/api/dungeons/${code}`, GOOD);
  check("a guest can save their own draft", saved.ok, `status ${saved.status} ${saved.text.slice(0, 80)}`);

  const report = await alex.call("POST", `/api/dungeons/${code}/report`, {});
  check("the gate reports on it", report.json?.ok === true, JSON.stringify(report.json).slice(0, 140));
  check(
    "and the report is made of real numbers",
    typeof report.json?.par === "number" && report.json.par > 0 && report.json.builds > 0,
    `par ${report.json?.par} builds ${report.json?.builds}`
  );
  check(
    "the difficulty is one of the derived words",
    ["A walk", "Fair", "Stiff", "Brutal", "Only just"].includes(report.json?.difficulty),
    String(report.json?.difficulty)
  );

  const published = await alex.call("POST", `/api/dungeons/${code}/publish`, {});
  check("it publishes", published.json?.ok === true, `status ${published.status}`);

  // ---- 3. frozen --------------------------------------------------------
  const edited = await alex.call("PUT", `/api/dungeons/${code}`, { ...GOOD, title: "Renamed" });
  check(
    "a published dungeon refuses to be edited underneath its link",
    edited.status === 409,
    `status ${edited.status}`
  );

  // ---- 5. not yours -----------------------------------------------------
  const theirs = await bev.call("PUT", `/api/dungeons/${code}`, GOOD);
  check("somebody else cannot save over it", theirs.status === 403, `status ${theirs.status}`);
  const peek = await bev.call("GET", `/api/dungeons/${code}`);
  check(
    "and they get the door rather than the draft",
    peek.json?.mine === false && !peek.json?.draft,
    JSON.stringify(peek.json).slice(0, 120)
  );

  // ---- 1. no answer in the payload --------------------------------------
  const puzzle = await bev.call("GET", `/api/daily/deeprun?c=${code}`);
  const raw = JSON.stringify(puzzle.json ?? {});
  check("the door serves the dungeon", puzzle.json?.rooms?.length === 3, `status ${puzzle.status}`);
  check("it carries no win prose", !raw.includes("It gives, and you are through"), "leaked a win");
  check("it carries no lose prose", !raw.includes("It does not give"), "leaked a lose");
  check("it carries no die", !/"(die|roll)"/.test(raw), "leaked a die");

  // ---- 4. it plays ------------------------------------------------------
  const p = puzzle.json;
  const played = await bev.call("POST", `/api/daily/deeprun?c=${code}`, {
    callingId: p.callings[0].id,
    placement: [0, 1, 2, 3, 4, 5],
    kitIds: [p.kit[0].id, p.kit[1].id],
    steps: p.rooms.map((r) => ({ optionId: r.options[0].id })),
  });
  check("it plays to the bottom", played.json?.finished === true, `status ${played.status}`);
  check(
    "and scores against the par it published",
    typeof played.json?.score === "number" && played.json.par === report.json.par,
    `score ${played.json?.score} par ${played.json?.par} vs ${report.json?.par}`
  );
  check(
    "the prose only arrives once a floor is committed to",
    /It gives, and you are through|It does not give/.test(JSON.stringify(played.json?.lines ?? [])),
    "no prose in the played lines"
  );
  const share = played.json?.share ?? "";
  check("the share names the dungeon", share.includes("THE WEEPING STAIR"), share.slice(0, 60));
  check("the share links to the dungeon", share.includes(`/d/${code}`), share);
  check("the share does not link to the daily", !share.includes("/daily/deeprun"), share);
  check("every url in it has a scheme", !/[^/]tavernparty\.co\.uk/.test(share.replace(/https:\/\//g, "https://")), share);

  // ---- the daily is untouched -------------------------------------------
  const daily = await bev.call("GET", "/api/daily/deeprun");
  check("the daily still serves its own dungeon", !!daily.json?.rooms && daily.json.dungeon === null);

  // ---- the shelf ---------------------------------------------------------
  const shelf = await alex.call("GET", "/api/dungeons");
  check(
    "the shelf has rooms on it for the first author to pick",
    (shelf.json?.pool?.length ?? 0) > 0,
    `${shelf.json?.pool?.length ?? 0} rooms`
  );
  check(
    "and the author sees their own work",
    (shelf.json?.mine?.length ?? 0) >= 2,
    `${shelf.json?.mine?.length ?? 0} drafts`
  );

  // ---- the pages ---------------------------------------------------------
  for (const path of ["/write", `/d/${code}`]) {
    const res = await fetch(`${BASE}${path}`);
    check(`${path} answers`, res.status === 200, `status ${res.status}`);
  }
}

await main().catch((err) => check("the script itself did not throw", false, String(err?.stack ?? err)));

console.log(`\n${"-".repeat(60)}`);
console.log(`${passed} passed, ${failures.length} failed, ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (failures.length) {
  console.log(`\nfailed checks:`);
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failures.length ? 1 : 0);
