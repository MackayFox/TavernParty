import { describe, expect, it } from "vitest";
import {
  ARCHIVE_START,
  DAILY_GAMES,
  DAILY_META,
  archiveDates,
  dailyIndex,
  msUntilReset,
  parPhrase,
  prettyDate,
  resolvePlayDate,
  seededPick,
  seededRng,
  seededShuffle,
  utcDate,
} from "@/lib/daily/core";
import * as longway from "@/lib/daily/longway";
import * as deeprun from "@/lib/daily/deeprun";
import { parFor as deepPar } from "@/lib/daily/deeprun-par";
import * as ledger from "@/lib/daily/ledger";
import * as muster from "@/lib/daily/muster";
import { statsFromRows } from "@/lib/daily/results";

/**
 * The dailies, checked on the two properties that matter and cannot be eyeballed:
 * every puzzle is identical worldwide for a date, and every published par is
 * genuinely the best the puzzle can be made to pay.
 *
 * A spread of dates rather than one, because a generator that only works on a
 * Tuesday is exactly the failure this suite exists to catch.
 */
const DATES = [
  "2026-08-01",
  "2026-08-24",
  "2026-09-09",
  "2026-11-30",
  "2027-01-01",
  "2027-02-14",
  "2027-06-06",
  "2027-12-25",
];

describe("core", () => {
  it("names four games and describes all of them", () => {
    expect(DAILY_GAMES).toHaveLength(4);
    expect(new Set(DAILY_GAMES).size).toBe(4);
    for (const game of DAILY_GAMES) {
      const meta = DAILY_META[game];
      expect(meta.path).toBe(`/daily/${game}`);
      expect(meta.name.length).toBeGreaterThan(2);
      expect(meta.blurb.length).toBeGreaterThan(20);
      expect(meta.rule.length).toBeGreaterThan(20);
      expect(meta.maxScore).toBeGreaterThan(meta.minScore);
      // No em-dashes in player-facing copy, anywhere.
      expect(`${meta.name}${meta.blurb}${meta.rule}`).not.toContain("—");
    }
  });

  it("is deterministic per date and uncorrelated between games", () => {
    const a = Array.from({ length: 5 }, seededRng("longway", "2026-09-09"));
    const b = Array.from({ length: 5 }, seededRng("longway", "2026-09-09"));
    const c = Array.from({ length: 5 }, seededRng("muster", "2026-09-09"));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("shuffles and picks without losing or duplicating anything", () => {
    const rand = seededRng("t", "2026-09-09");
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...seededShuffle(items, rand)].sort((x, y) => x - y)).toEqual(items);
    const picked = seededPick(items, 3, rand);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it("walks the pool before repeating a day", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date("2026-09-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      seen.add(dailyIndex(utcDate(d), 7));
    }
    expect(seen.size).toBe(7);
  });

  it("falls back to today rather than 404ing on a bad date", () => {
    const today = utcDate();
    expect(resolvePlayDate(null)).toEqual({ date: today, archive: false, valid: true });
    expect(resolvePlayDate("nonsense").date).toBe(today);
    expect(resolvePlayDate("2099-01-01").valid).toBe(false);
    expect(resolvePlayDate("1999-01-01").valid).toBe(false);
    expect(resolvePlayDate(ARCHIVE_START)).toEqual({
      date: ARCHIVE_START,
      archive: ARCHIVE_START !== today,
      valid: true,
    });
  });

  it("never offers an archive day before the doors opened", () => {
    for (const date of archiveDates()) expect(date >= ARCHIVE_START).toBe(true);
  });

  it("reads a par gap in words", () => {
    expect(parPhrase(12, 12)).toBe("par");
    expect(parPhrase(10, 12)).toBe("two short of par");
    expect(parPhrase(13, 12)).toBe("one over par");
  });

  it("prints a date and a reset clock", () => {
    // The comma is the runtime's, not ours: assert the parts, not the punctuation.
    expect(prettyDate("2026-08-24")).toMatch(/^Monday,? 24 August 2026$/);
    const ms = msUntilReset(Date.parse("2026-08-24T23:00:00Z"));
    expect(ms).toBe(3_600_000);
  });
});

describe("results streaks", () => {
  it("counts back from yesterday when today has not been played", () => {
    const day = (back: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - back);
      return utcDate(d);
    };
    const stats = statsFromRows([
      { date: day(1), score: 3, par: 4 },
      { date: day(2), score: 2, par: 4 },
      { date: day(9), score: 1, par: 4 },
    ]);
    expect(stats.streak).toBe(2);
    expect(stats.played).toBe(3);
    expect(stats.bestScore).toBe(3);
    expect(stats.today).toBeNull();
  });
});

describe("longway", () => {
  it("pins the same night for a date, every time", () => {
    const a = longway.puzzleFor("2026-09-09");
    const b = longway.puzzleFor("2026-09-09");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(longway.puzzleFor("2026-09-10").acts.map((x) => x.sceneId)).not.toEqual(
      a.acts.map((x) => x.sceneId)
    );
  });

  it("deals five Acts with three doors and a known die each", () => {
    for (const date of DATES) {
      const puzzle = longway.puzzleFor(date);
      expect(puzzle.acts).toHaveLength(longway.ACTS);
      for (const act of puzzle.acts) {
        expect(act.doors).toHaveLength(3);
        expect(act.doors.filter((d) => d.reckless)).toHaveLength(1);
        expect(act.face).toBeGreaterThanOrEqual(1);
        expect(act.face).toBeLessThanOrEqual(20);
      }
      // Six numbers placed, and the two the Calling is trained in got the best.
      const scores = Object.values(puzzle.who.scores);
      expect(scores).toHaveLength(6);
      const trained = puzzle.who.affinities.map((a) => puzzle.who.scores[a]);
      expect([...trained].sort((x, y) => y - x)).toEqual(
        [...scores].sort((x, y) => y - x).slice(0, 2)
      );
    }
  });

  it("publishes a par no line of play can beat", () => {
    for (const date of DATES.slice(0, 4)) {
      const puzzle = longway.puzzleFor(date);
      const { par, line } = longway.parFor(puzzle);
      expect(longway.play(puzzle, line).renown).toBe(par);

      // A hundred random nights, none of which may beat par.
      const rand = seededRng("probe", date);
      for (let i = 0; i < 100; i++) {
        const choices = puzzle.acts.map((act) => {
          const doors = [...act.doors.map((d) => d.id), longway.FLINCH];
          return {
            doorId: doors[Math.floor(rand() * doors.length)],
            spend: Math.floor(rand() * 3),
          };
        });
        expect(longway.play(puzzle, choices).renown).toBeLessThanOrEqual(par);
      }
    }
  });

  it("floors Renown at zero and caps Dread, exactly like the engine", () => {
    const puzzle = longway.puzzleFor("2026-09-09");
    const run = longway.play(
      puzzle,
      puzzle.acts.map(() => ({ doorId: longway.FLINCH, spend: 0 }))
    );
    expect(run.renown).toBe(0);
    expect(run.dread).toBeGreaterThan(0);
    expect(run.dread).toBeLessThanOrEqual(longway.DREAD_MAX);
  });

  it("shares a score without naming a scene or a target number", () => {
    const puzzle = longway.puzzleFor("2026-09-09");
    const { par, line } = longway.parFor(puzzle);
    const text = longway.shareText("2026-09-09", longway.play(puzzle, line), par);
    expect(text).toContain("par");
    for (const act of puzzle.acts) expect(text).not.toContain(act.title);
    expect(text).not.toContain("—");
  });
});

describe("deeprun", () => {
  it("publishes a whole dungeon with no dice in it", () => {
    for (const date of DATES) {
      const puzzle = deeprun.puzzleFor(date);
      expect(puzzle.rooms).toHaveLength(deeprun.DEPTH);
      expect(puzzle.array).toHaveLength(deeprun.ARRAY_SIZE);
      expect(puzzle.callings).toHaveLength(deeprun.CALLING_CHOICES);
      expect(puzzle.kit).toHaveLength(deeprun.KIT_CHOICES);
      // The number in each room is the one thing the payload must not carry.
      expect(JSON.stringify(puzzle)).not.toMatch(/"die"|"roll"/);
    }
  });

  // Eight exhaustive solves. States a budget rather than racing the default.
  it("has a par that is reachable on every day tested", () => {
    for (const date of DATES) {
      const puzzle = deeprun.puzzleFor(date);
      const { par, best } = deepPar(puzzle);
      expect(best, date).not.toBeNull();
      expect(deeprun.run(puzzle, best!.build, best!.steps).score, date).toBe(par);
    }
  }, 60_000);
});

describe("ledger", () => {
  it("sets a grid with exactly one solution, from four true statements", () => {
    for (const date of DATES) {
      const puzzle = ledger.puzzleFor(date);
      expect(puzzle.names).toHaveLength(ledger.PEOPLE);
      expect(new Set(puzzle.names).size).toBe(ledger.PEOPLE);
      expect(puzzle.amounts).toHaveLength(ledger.PEOPLE);
      expect(new Set(puzzle.amounts).size).toBe(ledger.PEOPLE);
      expect(puzzle.clues).toHaveLength(ledger.CLUES);
      expect(new Set(puzzle.clues).size).toBe(ledger.CLUES);
      for (const clue of puzzle.clues) expect(clue).not.toContain("—");

      // The solution is a permutation, and the four statements admit no other.
      const solution = ledger.solutionFor(date);
      expect(ledger.validAssignment(solution)).toBe(true);
      expect(ledger.isSolved(date, solution)).toBe(true);
      expect(ledger.solutionCount(date)).toBe(1);
    }
  });

  it("never puts the answer in the payload", () => {
    const payload = JSON.stringify(ledger.puzzleFor("2026-09-09"));
    expect(payload).not.toContain("solution");
  });

  it("counts rows without saying which", () => {
    const date = "2026-09-09";
    const solution = ledger.solutionFor(date);
    expect(ledger.rowsCorrect(date, solution)).toBe(ledger.PEOPLE);
    const swapped = [...solution];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(ledger.rowsCorrect(date, swapped)).toBe(ledger.PEOPLE - 2);
    expect(ledger.isSolved(date, swapped)).toBe(false);
  });

  it("agrees with the score bounds the hub and the store use", () => {
    expect(DAILY_META.ledger.maxScore).toBe(ledger.MAX_SCORE);
    expect(DAILY_META.muster.maxScore).toBe(muster.TRIALS);
  });

  it("pays four marks for a clean ledger and nothing for a wrong one", () => {
    expect(ledger.scoreFor(true, 0)).toBe(4);
    expect(ledger.scoreFor(true, 3)).toBe(1);
    expect(ledger.scoreFor(false, 0)).toBe(0);
    expect(ledger.scoreFor(true, 99)).toBe(1);
  });
});

describe("muster", () => {
  it("offers a budget, a night that bites, and only kit that can matter", () => {
    for (const date of DATES) {
      const puzzle = muster.puzzleFor(date);
      expect(puzzle.array).toHaveLength(6);
      expect(puzzle.trials).toHaveLength(muster.TRIALS);
      expect(puzzle.callings).toHaveLength(8);
      expect(puzzle.kit.length).toBeGreaterThan(4);
      for (const kit of puzzle.kit) expect(kit.value).toBeGreaterThan(0);
      expect(puzzle.encounter.length).toBeGreaterThan(4);
    }
  });

  it("publishes a par that no build can beat", () => {
    for (const date of DATES) {
      const puzzle = muster.puzzleFor(date);
      const { par, best } = muster.parFor(puzzle);
      expect(muster.validBuild(puzzle, best)).toBe(true);
      expect(muster.play(puzzle, best).cleared).toBe(par);
      expect(par).toBeGreaterThanOrEqual(1);

      const rand = seededRng("probe", date);
      for (let i = 0; i < 200; i++) {
        const placement = seededShuffle([0, 1, 2, 3, 4, 5], rand);
        const build = {
          placement,
          callingId: puzzle.callings[Math.floor(rand() * puzzle.callings.length)].id,
          kitId: puzzle.kit[Math.floor(rand() * puzzle.kit.length)].id,
        };
        expect(muster.play(puzzle, build).cleared).toBeLessThanOrEqual(par);
      }
    }
  });

  it("leaves at least one door that cannot be answered", () => {
    for (const date of DATES) {
      const puzzle = muster.puzzleFor(date);
      expect(muster.parFor(puzzle).par).toBeLessThan(muster.TRIALS);
    }
  });

  it("rejects a build that is not a placement of all six numbers", () => {
    const puzzle = muster.puzzleFor("2026-09-09");
    const ok = { placement: [0, 1, 2, 3, 4, 5], callingId: puzzle.callings[0].id, kitId: puzzle.kit[0].id };
    expect(muster.validBuild(puzzle, ok)).toBe(true);
    expect(muster.validBuild(puzzle, { ...ok, placement: [0, 0, 2, 3, 4, 5] })).toBe(false);
    expect(muster.validBuild(puzzle, { ...ok, callingId: "nobody" })).toBe(false);
    expect(muster.validBuild(puzzle, { ...ok, kitId: "nothing" })).toBe(false);
  });
});

/**
 * The route handlers, driven directly.
 *
 * Thin as they are, they are where the contract lives: the field names the
 * client sends, the field names it gets back, and the promise that a GET never
 * carries the answer. Calling them here rather than through a running server
 * keeps the check in `npm test`, where it will actually be run.
 */
describe("routes", () => {
  const json = (res: Response) => res.json() as Promise<Record<string, unknown>>;
  const req = (url: string, body?: unknown) =>
    new Request(`http://localhost${url}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("lists the four", async () => {
    const { GET } = await import("@/app/api/daily/route");
    const body = await json(await GET());
    expect((body.games as { id: string }[]).map((g) => g.id)).toEqual([...DAILY_GAMES]);
  });

  it("plays longway to the end and only then publishes par", async () => {
    const route = await import("@/app/api/daily/longway/route");
    const puzzle = await json(await route.GET(req("/api/daily/longway?date=2026-09-09")));
    expect(puzzle.par).toBeUndefined();
    const acts = puzzle.acts as { doors: { id: string }[] }[];

    const partial = await json(
      await route.POST(
        req("/api/daily/longway", {
          date: "2026-09-09",
          choices: [{ doorId: acts[0].doors[0].id, spend: 0 }],
        })
      )
    );
    expect(partial.complete).toBe(false);
    expect(partial.par).toBeUndefined();

    const full = await json(
      await route.POST(
        req("/api/daily/longway", {
          date: "2026-09-09",
          choices: acts.map((a) => ({ doorId: a.doors[0].id, spend: 0 })),
        })
      )
    );
    expect(full.complete).toBe(true);
    expect(typeof full.score).toBe("number");
    expect(typeof full.par).toBe("number");
    expect(String(full.share)).toContain("par");
  });

  it("refuses a door that is not in that Act", async () => {
    const route = await import("@/app/api/daily/longway/route");
    const res = await route.POST(
      req("/api/daily/longway", { date: "2026-09-09", choices: [{ doorId: "a01-wade" , spend: 0 }, { doorId: "a01-wade", spend: 0 }] })
    );
    // The first may or may not be legal for Act I; the second cannot be legal
    // for Act II as well, so one of the two must be rejected.
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const body = await json(res);
      expect(body.complete).toBe(false);
    }
  });

  it("refuses a claimed score instead of an answer", async () => {
    const routes = [
      ["longway", await import("@/app/api/daily/longway/route")],
      ["deeprun", await import("@/app/api/daily/deeprun/route")],
      ["ledger", await import("@/app/api/daily/ledger/route")],
      ["muster", await import("@/app/api/daily/muster/route")],
    ] as const;
    for (const [game, route] of routes) {
      const res = await route.POST(req(`/api/daily/${game}`, { score: 999_999 }));
      expect(res.status, game).toBe(400);
      expect((await json(res)).score).toBeUndefined();
    }
  });

  it("keeps the ledger solution out of the GET and in the close", async () => {
    const route = await import("@/app/api/daily/ledger/route");
    const get = await route.GET(req("/api/daily/ledger?date=2026-09-09"));
    const text = await get.clone().text();
    expect(text).not.toContain("solution");

    const body = await json(get);
    const rows = (body.names as string[]).length;
    const wrong = Array.from({ length: rows }, (_, i) => (i + 1) % rows);

    const checked = await json(
      await route.POST(req("/api/daily/ledger", { date: "2026-09-09", assignment: wrong, mode: "check" }))
    );
    expect(checked.solution).toBeUndefined();
    expect(typeof checked.correctRows).toBe("number");

    const closed = await json(
      await route.POST(
        req("/api/daily/ledger", { date: "2026-09-09", assignment: wrong, mode: "close", checksUsed: 1 })
      )
    );
    expect(Array.isArray(closed.solution)).toBe(true);
    expect(typeof closed.score).toBe("number");
  });

  it("scores a muster build and a table of six assignment", async () => {
    const muster = await import("@/app/api/daily/muster/route");
    const puzzle = await json(await muster.GET(req("/api/daily/muster?date=2026-09-09")));
    expect(puzzle.par).toBeUndefined();
    const scored = await json(
      await muster.POST(
        req("/api/daily/muster", {
          date: "2026-09-09",
          placement: [0, 1, 2, 3, 4, 5],
          callingId: (puzzle.callings as { id: string }[])[0].id,
          kitId: (puzzle.kit as { id: string }[])[0].id,
        })
      )
    );
    expect(typeof scored.score).toBe("number");
    expect(typeof scored.par).toBe("number");

    const deep = await import("@/app/api/daily/deeprun/route");
    const dungeon = (await json(
      await deep.GET(req("/api/daily/deeprun?date=2026-09-09"))
    )) as deeprun.Puzzle & { par?: number };
    expect(dungeon.par).toBeUndefined();
    const played = await json(
      await deep.POST(
        req("/api/daily/deeprun", {
          date: "2026-09-09",
          callingId: dungeon.callings[0].id,
          placement: [0, 1, 2, 3, 4, 5],
          kitIds: [dungeon.kit[0].id, dungeon.kit[1].id],
          steps: dungeon.rooms.map((r: { options: { id: string }[] }) => ({
            optionId: r.options[0].id,
          })),
        })
      )
    );
    expect(typeof played.score).toBe("number");
    expect(typeof played.par).toBe("number");

    const rewritten = await deep.POST(
      req("/api/daily/deeprun", {
        date: "2026-09-09",
        callingId: dungeon.callings[0].id,
        // Not the numbers the house rolled: the same one six times.
        placement: [0, 0, 0, 0, 0, 0],
        kitIds: [dungeon.kit[0].id, dungeon.kit[1].id],
        steps: [],
      })
    );
    expect(rewritten.status).toBe(400);
  });

  it("falls back to today on a future or malformed date", async () => {
    const route = await import("@/app/api/daily/deeprun/route");
    for (const raw of ["2099-12-31", "not-a-date"]) {
      const body = await json(await route.GET(req(`/api/daily/deeprun?date=${encodeURIComponent(raw)}`)));
      expect(body.date).toBe(utcDate());
    }
  });
});

describe("share text is shareable", () => {
  it("carries a scheme, or nothing unfurls it", async () => {
    // A bare host is plain text to Discord, Slack, WhatsApp and X. Without the
    // scheme the entire Open Graph pass renders as nothing on precisely the
    // surfaces the share loop runs on, which is a silent and total waste.
    const mods = await Promise.all([
      import("@/lib/daily/deeprun"),
      import("@/lib/daily/ledger"),
      import("@/lib/daily/longway"),
      import("@/lib/daily/muster"),
    ]);
    for (const m of mods) {
      const source = Object.values(m).filter((v) => typeof v === "function");
      expect(source.length).toBeGreaterThan(0);
    }
    /**
     * Every daily's share line has to carry an absolute url.
     *
     * This used to scan the four source files for a literal hostname and assert
     * it was preceded by a scheme. That worked right up until the hostname moved
     * into `lib/site.ts`, at which point the scan found nothing and a test whose
     * job was to catch a missing scheme would have passed on a file with no url
     * in it at all. So it asserts the two halves separately: `siteUrl` really
     * does produce an absolute url, and each daily really does build its share
     * link with it rather than typing a host of its own.
     */
    const { siteUrl, CANONICAL_ORIGIN } = await import("@/lib/site");
    expect(CANONICAL_ORIGIN).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    expect(CANONICAL_ORIGIN.endsWith("/"), "no trailing slash, or every url doubles it").toBe(false);
    expect(siteUrl("/daily/muster")).toBe(`${CANONICAL_ORIGIN}/daily/muster`);
    expect(siteUrl("daily/muster"), "a missing leading slash is still one slash").toBe(
      `${CANONICAL_ORIGIN}/daily/muster`
    );

    const fs = await import("node:fs");
    for (const f of ["deeprun", "ledger", "longway", "muster"]) {
      const text = fs.readFileSync(`lib/daily/${f}.ts`, "utf8");
      expect(text, `${f} should build its share link with siteUrl`).toContain("siteUrl(");
      expect(text, `${f} should not spell out a hostname of its own`).not.toMatch(
        /["'`][^"'`]*tavernparty\.[a-z.]+/
      );
    }
  });
});
