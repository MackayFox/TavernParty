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
 *   6. MARKS WORK OVER THE WIRE. The payload carries what each door wants, and a
 *      shut door posted straight at the server ends the run rather than opening.
 *
 * ONE DEV-SERVER GOTCHA. Run it twice after editing a route. The first hit after
 * an edit pays for Next's on-demand compile, and a route that takes long enough
 * can fail a check that passes on every subsequent run. That is the dev server,
 * not the product.
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

/**
 * The happy-path dungeon, and every floor costs TWO on purpose.
 *
 * Six Vigour of tolls against a starting nine, so a player who braces all three
 * floors still walks out whatever the dice did. That is not cosmetic: the checks
 * further down need somebody who FINISHED, a dungeon's dice come from its code,
 * and the server picks the code. With band-priced tolls (three, three, four) the
 * same run got out on some codes and died on others, so three Hall checks failed
 * about one run in four and read exactly like a bug in the mark endpoint. It was
 * a bug in the fixture: the run had genuinely not got to the bottom.
 */
const GOOD = {
  title: "The Weeping Stair",
  intro: "Wet from the first floor to the last, and do not count on a rope.",
  rooms: [
    room("first", 2, "brawn", 14, "wits", 15, 2),
    room("second", 2, "wits", 14, "grit", 15, 2),
    room("third", 3, "brawn", 17, "charm", 16, 2),
  ],
  callingIds: ["warden", "knife", "hedgewitch"],
  kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
  baseVigour: 9,
};

/**
 * Legal at the wire and impossible in play.
 *
 * Eight floors, the highest target and the highest cost the wire will carry,
 * against the least Vigour anybody may start with, AND only one Calling with the
 * bare two things on the shelf.
 *
 * That last part is not decoration. A dungeon's dice come from its code, the
 * server picks the code, and clearing a check costs nothing, so with three
 * Callings and four kit this fixture published on 3% of codes: a lucky set of
 * eight dice plus one of 108 builds walks out of it. Narrowing the allowed
 * characters took that to 0 in 250 codes, with never more than two survivors on
 * the worst one. The unit test pins its code instead, which a script talking to a
 * real server over HTTP cannot do.
 */
const IMPOSSIBLE = {
  ...GOOD,
  title: "Nobody Comes Back",
  rooms: Array.from({ length: 8 }, (_, i) => room(`x${i}`, 3, "brawn", 20, "wits", 20, 8)),
  callingIds: ["warden"],
  kitIds: ["tarred-rope", "whetstone"],
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
    // Either honest refusal: nobody gets out (which names the floor that stops
    // them), or so few do that it is a lock rather than a dungeon. Both are the
    // gate doing its job, and which one you get depends on the dice the server's
    // code chose.
    "and it says something useful about why",
    /floor \d|lock, not a dungeon/.test(JSON.stringify(refused.json?.report?.notes ?? [])),
    JSON.stringify(refused.json?.report?.notes ?? []).slice(0, 200)
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
  // `finished` only means the submission covered every floor. Getting OUT is the
  // separate property, and it is the one the Hall checks below depend on.
  check(
    "and comes back out alive, whatever the dice did",
    played.json?.out === true,
    `out ${played.json?.out} vigour ${played.json?.vigour}`
  );
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

  // ---- the Hall ----------------------------------------------------------
  // The rule worth proving over HTTP: a mark is impossible without a finished
  // run, and the front shelf is not reachable from a form. Bev finished the run
  // above, so she may say it was good. Alex never played it, so he may not.
  const bevMark = await bev.call("POST", `/api/dungeons/${code}/mark`, {});
  check("somebody who got out can say it was worth their time", bevMark.ok, `status ${bevMark.status}`);
  check(
    "and the standing counts them",
    bevMark.json?.standing?.marks === 1 && bevMark.json?.standing?.finishers === 1,
    JSON.stringify(bevMark.json?.standing)
  );
  const twice = await bev.call("POST", `/api/dungeons/${code}/mark`, {});
  check("saying it twice is still once", twice.json?.standing?.marks === 1, JSON.stringify(twice.json?.standing));

  const carol = jar();
  await carol.call("GET", "/api/dungeons");
  const unearned = await carol.call("POST", `/api/dungeons/${code}/mark`, {});
  check(
    "somebody who never went down cannot rate it",
    unearned.status === 403,
    `status ${unearned.status} ${String(unearned.json?.error ?? "").slice(0, 60)}`
  );

  const hall = await carol.call("GET", "/api/dungeons/hall");
  check(
    "the Hall does not list a dungeon nobody shelved",
    !JSON.stringify(hall.json?.fresh ?? []).includes(code),
    "an unlisted dungeon reached the front page"
  );

  const submitted = await alex.call("POST", `/api/dungeons/${code}/submit`, {});
  check("its author can ask for a place in the Hall", submitted.ok, `status ${submitted.status}`);
  const notMine = await bev.call("POST", `/api/dungeons/${code}/submit`, {});
  check("somebody else cannot submit it", notMine.status === 403, `status ${notMine.status}`);
  const stillOut = await carol.call("GET", "/api/dungeons/hall");
  check(
    "asking is not the same as being on the shelf",
    !JSON.stringify(stillOut.json?.fresh ?? []).includes(code),
    "a submission listed itself"
  );

  const queue = await alex.call("GET", "/api/admin/dungeons");
  check(
    "the moderation queue is not a door a guest can rattle",
    queue.status === 404,
    `status ${queue.status}`
  );

  // ---- the author's own numbers -------------------------------------------
  const log = await alex.call("GET", `/api/dungeons/${code}/log`);
  check("the author can read what really happened", log.ok, `status ${log.status}`);
  check(
    "and it sets the solver's guess beside it",
    typeof log.json?.predicted === "number" && log.json?.plays >= 1,
    JSON.stringify(log.json).slice(0, 140)
  );
  const peekLog = await bev.call("GET", `/api/dungeons/${code}/log`);
  check("nobody else can read it", peekLog.status === 403, `status ${peekLog.status}`);

  // ---- 6. marks, over the wire -------------------------------------------
  /**
   * The one seam the unit tests cannot reach: does the payload carry the gating
   * rules, and does the server refuse a shut door posted straight at it?
   *
   * Floor one's brace hands out the lamp, floor two's checks want it, and floor
   * two's brace is deliberately ungated because the gate insists on that. So a
   * run that takes the lamp gets three floors, and a run that posts floor two's
   * gated check without it stops on floor one.
   */
  const dana = jar();
  const markMade = await dana.call("POST", "/api/dungeons", { name: "DANA" });
  const mcode = markMade.json?.code;
  const GATED = {
    ...GOOD,
    title: "The Lamp Or Nothing",
    rooms: [
      {
        ...room("m1", 2, "brawn", 14, "wits", 15),
        options: room("m1", 2, "brawn", 14, "wits", 15).options.map((o) =>
          o.kind === "brace" ? { ...o, sets: ["the lamp"] } : o
        ),
      },
      {
        ...room("m2", 2, "brawn", 14, "grit", 15),
        options: room("m2", 2, "brawn", 14, "grit", 15).options.map((o) =>
          o.kind === "check" ? { ...o, needs: ["the lamp"] } : o
        ),
      },
      room("m3", 3, "brawn", 17, "charm", 16),
    ],
  };
  await dana.call("PUT", `/api/dungeons/${mcode}`, GATED);
  const gatedReport = await dana.call("POST", `/api/dungeons/${mcode}/report`, {});
  check(
    "the gate is happy with a dungeon whose second floor wants the lamp",
    gatedReport.json?.ok === true,
    JSON.stringify(gatedReport.json?.notes ?? []).slice(0, 200)
  );
  const gatedPub = await dana.call("POST", `/api/dungeons/${mcode}/publish`, {});
  check("it publishes", gatedPub.json?.ok === true, `status ${gatedPub.status}`);

  const gatedPuzzle = await dana.call("GET", `/api/daily/deeprun?c=${mcode}`);
  const secondFloor = gatedPuzzle.json?.rooms?.[1]?.options ?? [];
  check(
    "the payload says which doors want what",
    secondFloor.some((o) => (o.needs ?? []).includes("the lamp")),
    JSON.stringify(secondFloor.map((o) => o.needs))
  );
  check(
    "and it says what the first floor hands out",
    (gatedPuzzle.json?.rooms?.[0]?.options ?? []).some((o) => (o.sets ?? []).includes("the lamp")),
    "no sets in the payload"
  );

  const gp = gatedPuzzle.json;
  const brace = (i) => gp.rooms[i].options.find((o) => o.kind === "brace").id;
  const gatedCheck = gp.rooms[1].options.find((o) => (o.needs ?? []).length > 0).id;

  const withLamp = await dana.call("POST", `/api/daily/deeprun?c=${mcode}`, {
    callingId: gp.callings[0].id,
    placement: [0, 1, 2, 3, 4, 5],
    kitIds: [gp.kit[0].id, gp.kit[1].id],
    steps: [{ optionId: brace(0) }, { optionId: gatedCheck }, { optionId: brace(2) }],
  });
  check(
    "carrying the lamp opens the door that wanted it",
    withLamp.json?.lines?.length === 3,
    `${withLamp.json?.lines?.length} floors, status ${withLamp.status}`
  );
  check(
    "and the run says what is being carried",
    (withLamp.json?.lines?.[0]?.marks ?? []).includes("the lamp"),
    JSON.stringify(withLamp.json?.lines?.[0]?.marks)
  );

  const withoutLamp = await dana.call("POST", `/api/daily/deeprun?c=${mcode}`, {
    callingId: gp.callings[0].id,
    placement: [0, 1, 2, 3, 4, 5],
    kitIds: [gp.kit[0].id, gp.kit[1].id],
    // Floor one's UNGATED check instead of its brace, so no lamp, and then
    // straight at the door that wants one.
    steps: [
      { optionId: gp.rooms[0].options.find((o) => o.kind === "check").id },
      { optionId: gatedCheck },
      { optionId: brace(2) },
    ],
  });
  check(
    "posting a shut door straight at the server stops the run there",
    withoutLamp.json?.lines?.length === 1 && withoutLamp.json?.out === false,
    `${withoutLamp.json?.lines?.length} floors, out ${withoutLamp.json?.out}`
  );

  // ---- 7. the front door, as a first-timer meets it -----------------------
  /**
   * THE CHECK THAT WAS MISSING, and the reason a real bug shipped.
   *
   * Every call above sends a name of its own, so the create route was proved to
   * work and the SCREEN was never exercised. On the real page "Start one" posted
   * an empty body, the route correctly answered "put a name to it first", and the
   * page offered nowhere to put one. A dead end on the front door of the feature,
   * behind a suite of passing tests.
   *
   * So: the request the page actually makes when somebody has not been here
   * before, and the page itself carrying somewhere to type.
   */
  const nameless = await jar().call("POST", "/api/dungeons", {});
  check(
    "a draft with no name is refused, and says so",
    nameless.status === 400 && /name/i.test(String(nameless.json?.error ?? "")),
    `status ${nameless.status} ${String(nameless.json?.error ?? "").slice(0, 60)}`
  );
  const deskHtml = await (await fetch(`${BASE}/write`)).text();
  check(
    "and the desk has a box to put one in",
    /Your name, for the byline/.test(deskHtml),
    "no name field on /write"
  );

  // ---- 8. the house dungeon needs no database ----------------------------
  const house = await bev.call("GET", "/api/daily/deeprun?c=LNGWLK");
  check(
    "The Stone Walk is playable whatever the database is doing",
    house.json?.rooms?.length === 6,
    `status ${house.status}`
  );
  const housePage = await fetch(`${BASE}/d/LNGWLK`);
  check("and its page is not a 404", housePage.status === 200, `status ${housePage.status}`);

  // ---- the pages ---------------------------------------------------------
  for (const path of ["/write", "/dungeons", `/d/${code}`]) {
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
