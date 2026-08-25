/**
 * THE HALL: what happened, what people thought, and who is allowed to say so.
 *
 * The ranking is the part worth testing hardest, because the previous version of
 * a rating rule in this codebase had a handle on it (bots voted for whoever wore
 * the most public Scars) and it turned out to be worth 78% of games. A rating
 * anybody can steer is worse than no rating, because it looks like information.
 *
 * So: one mark out of one finisher must not outrank forty out of fifty, a mark
 * must be impossible without finishing, and the queue must be invisible rather
 * than merely forbidden.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomDef } from "@/lib/daily/deeprun-data";
import { wilson } from "@/lib/campaign/hall-shared";

/** Whoever the current request is. Mutable, so a stranger can be tested. */
let who: { id: string; kind: string; displayName?: string; username?: string } | null = {
  id: "guest_author",
  kind: "guest",
  displayName: "ALEX",
};

vi.mock("@/lib/identity", () => ({
  getIdentity: async () => who,
  getGuestId: async () => who?.id ?? null,
  getOrCreateGuestId: async () => who?.id ?? "guest_author",
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseConfigured: () => false,
  adminClient: () => {
    throw new Error("not configured");
  },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => null, clientIp: () => "test" }));

const SETUP = "The floor gives way to a stair nobody built, and the air coming up it is warm.";

function room(id: string, tn: number, vigour: number): RoomDef {
  return {
    id,
    band: 2,
    title: `Floor ${id}`,
    setup: SETUP,
    options: [
      { id: `${id}-a`, label: "Force it", kind: "check", ability: "brawn", tn, vigour,
        promise: "Straight at it.", win: "It gives.", lose: "It does not." },
      { id: `${id}-b`, label: "Read it", kind: "check", ability: "wits", tn, vigour,
        promise: "Work it out.", win: "You see it.", lose: "You do not." },
      { id: `${id}-c`, label: "Take the hit", kind: "brace", vigour,
        promise: "Pay and pass.", win: "Through, and it cost you.", lose: "Through, and it cost you." },
    ],
  };
}

const good = {
  title: "The Weeping Stair",
  intro: "Wet from the first floor to the last, and do not count on a rope.",
  rooms: [room("h1", 12, 2), room("h2", 13, 3), room("h3", 14, 3)],
  callingIds: ["warden", "knife", "hedgewitch"],
  kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
  baseVigour: 9,
};

const req = (url: string, body?: unknown) =>
  new Request(`https://tavernparty.co.uk${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const put = (url: string, body: unknown) =>
  new Request(`https://tavernparty.co.uk${url}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

let index: typeof import("@/app/api/dungeons/route");
let one: typeof import("@/app/api/dungeons/[code]/route");
let publish: typeof import("@/app/api/dungeons/[code]/publish/route");
let markRoute: typeof import("@/app/api/dungeons/[code]/mark/route");
let submitRoute: typeof import("@/app/api/dungeons/[code]/submit/route");
let logRoute: typeof import("@/app/api/dungeons/[code]/log/route");
let hallRoute: typeof import("@/app/api/dungeons/hall/route");
let queueRoute: typeof import("@/app/api/admin/dungeons/route");
let actRoute: typeof import("@/app/api/admin/dungeons/[code]/route");
let hall: typeof import("@/lib/campaign/hall");
let play: typeof import("@/app/api/daily/deeprun/route");

beforeEach(async () => {
  who = { id: "guest_author", kind: "guest", displayName: "ALEX" };
  index = await import("@/app/api/dungeons/route");
  one = await import("@/app/api/dungeons/[code]/route");
  publish = await import("@/app/api/dungeons/[code]/publish/route");
  markRoute = await import("@/app/api/dungeons/[code]/mark/route");
  submitRoute = await import("@/app/api/dungeons/[code]/submit/route");
  logRoute = await import("@/app/api/dungeons/[code]/log/route");
  hallRoute = await import("@/app/api/dungeons/hall/route");
  queueRoute = await import("@/app/api/admin/dungeons/route");
  actRoute = await import("@/app/api/admin/dungeons/[code]/route");
  hall = await import("@/lib/campaign/hall");
  play = await import("@/app/api/daily/deeprun/route");
});

/** A published dungeon, owned by whoever `who` currently is. */
async function published(title = good.title): Promise<string> {
  const made = await json(await index.POST(req("/api/dungeons", {})));
  const code = made.code as string;
  const params = Promise.resolve({ code });
  await one.PUT(put(`/api/dungeons/${code}`, { ...good, title }), { params });
  await publish.POST(req(`/api/dungeons/${code}/publish`, {}), { params });
  return code;
}

const finisher = (code: string, id: string, score = 20) =>
  hall.recordRun({ code, playerKey: id, score, par: 20, finished: true, depth: 3, stoppedOn: null });

describe("the ranking", () => {
  it("is zero when nobody has finished", () => {
    expect(wilson(0, 0)).toBe(0);
  });

  it("puts forty out of fifty above one out of one", () => {
    // The whole reason this is a Wilson bound rather than a division. A new
    // dungeon with one friendly vote must not sit on top of the Hall.
    expect(wilson(40, 50)).toBeGreaterThan(wilson(1, 1));
  });

  it("rises with evidence at the same rate of approval", () => {
    expect(wilson(20, 20)).toBeGreaterThan(wilson(5, 5));
    expect(wilson(50, 100)).toBeGreaterThan(wilson(5, 10));
  });

  it("rises with approval at the same amount of evidence", () => {
    expect(wilson(8, 10)).toBeGreaterThan(wilson(4, 10));
  });

  it("never leaves the unit interval", () => {
    for (const [m, f] of [[0, 1], [1, 1], [3, 7], [99, 100], [500, 1000]] as const) {
      const w = wilson(m, f);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("is a LOWER bound, so it sits under the raw rate", () => {
    expect(wilson(8, 10)).toBeLessThan(0.8);
  });
});

describe("a run", () => {
  it("keeps the FIRST one, because that is the one played blind", async () => {
    const code = await published();
    await hall.recordRun({ code, playerKey: "p1", score: 7, par: 20, finished: false, depth: 2, stoppedOn: 2 });
    await hall.recordRun({ code, playerKey: "p1", score: 31, par: 20, finished: true, depth: 3, stoppedOn: null });
    const run = await hall.runOf(code, "p1");
    expect(run?.score).toBe(7);
    expect(run?.finished).toBe(false);
  });

  it("is counted per person, not per attempt", async () => {
    const code = await published();
    await finisher(code, "p1");
    await finisher(code, "p1");
    await finisher(code, "p2");
    expect((await hall.standingOf(code)).finishers).toBe(2);
  });
});

describe("a mark", () => {
  it("is refused before you have got to the bottom of it", async () => {
    const code = await published();
    who = { id: "walker", kind: "guest", displayName: "BEV" };
    const res = await markRoute.POST(req(`/api/dungeons/${code}/mark`, {}), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(403);
    expect(String((await json(res)).error)).toMatch(/bottom of it/i);
  });

  it("is refused after a run that did not get out", async () => {
    const code = await published();
    await hall.recordRun({ code, playerKey: "died", score: 4, par: 20, finished: false, depth: 2, stoppedOn: 2 });
    who = { id: "died", kind: "guest", displayName: "BEV" };
    const res = await markRoute.POST(req(`/api/dungeons/${code}/mark`, {}), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(403);
  });

  it("counts once somebody has finished, and does not double up", async () => {
    const code = await published();
    await finisher(code, "out1");
    who = { id: "out1", kind: "guest", displayName: "BEV" };
    const params = Promise.resolve({ code });
    await markRoute.POST(req(`/api/dungeons/${code}/mark`, {}), { params });
    await markRoute.POST(req(`/api/dungeons/${code}/mark`, {}), { params });
    const standing = await hall.standingOf(code);
    expect(standing.marks).toBe(1);
    expect(standing.finishers).toBe(1);
  });

  it("404s for a dungeon that was taken down", async () => {
    const code = await published();
    await finisher(code, "out2");
    // A moderator takes it down.
    who = { id: "admin_1", kind: "user", username: "adam" };
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "ban" }), {
      params: Promise.resolve({ code }),
    });
    who = { id: "out2", kind: "guest", displayName: "BEV" };
    const res = await markRoute.POST(req(`/api/dungeons/${code}/mark`, {}), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(404);
  });
});

describe("the Hall listing", () => {
  it("holds a thin dungeon out of the ranking and still lists it under New", async () => {
    const thin = await published("One Vote Wonder");
    await finisher(thin, "t1");
    who = { id: "t1", kind: "guest" };
    await markRoute.POST(req(`/api/dungeons/${thin}/mark`, {}), {
      params: Promise.resolve({ code: thin }),
    });

    who = { id: "guest_author", kind: "guest", displayName: "ALEX" };
    const solid = await published("Evidence");
    for (let i = 0; i < hall.MIN_FINISHERS; i++) {
      await finisher(solid, `s${i}`);
      who = { id: `s${i}`, kind: "guest" };
      await markRoute.POST(req(`/api/dungeons/${solid}/mark`, {}), {
        params: Promise.resolve({ code: solid }),
      });
    }

    // Both are unlisted at this point, so neither is in the Hall at all: the
    // front shelf is filled by a person, never by a form.
    who = { id: "admin_1", kind: "user", username: "adam" };
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    for (const code of [thin, solid])
      await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "list" }), {
        params: Promise.resolve({ code }),
      });

    const body = await json(await hallRoute.GET());
    const ranked = (body.wellThoughtOf as { code: string }[]).map((d) => d.code);
    const fresh = (body.fresh as { code: string }[]).map((d) => d.code);
    expect(ranked).toContain(solid);
    expect(ranked).not.toContain(thin);
    expect(fresh).toContain(thin);
  });

  it("does not list a dungeon nobody shelved", async () => {
    const code = await published("Link Only");
    const body = await json(await hallRoute.GET());
    const all = [...(body.fresh as { code: string }[])].map((d) => d.code);
    expect(all).not.toContain(code);
  });
});

describe("the queue", () => {
  it("moves a published dungeon from unlisted to submitted, and no further", async () => {
    const code = await published();
    const params = Promise.resolve({ code });
    const res = await submitRoute.POST(req(`/api/dungeons/${code}/submit`, {}), { params });
    expect(res.status).toBe(200);
    const { getDungeon } = await import("@/lib/campaign/store");
    expect((await getDungeon(code))?.visibility).toBe("submitted");
  });

  it("cannot be submitted by somebody it does not belong to", async () => {
    const code = await published();
    who = { id: "stranger", kind: "guest", displayName: "BEV" };
    const res = await submitRoute.POST(req(`/api/dungeons/${code}/submit`, {}), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(403);
  });

  it("is a 404 rather than a 403 for anybody who is not a moderator", async () => {
    // Not tidiness: a page that says "you are not allowed in here" is a page
    // that tells you there is a here.
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "guest_author", kind: "guest", displayName: "ALEX" };
    expect((await queueRoute.GET()).status).toBe(404);
  });

  it("is closed to a guest calling themselves the admin's name", async () => {
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "liar", kind: "guest", displayName: "adam" };
    expect((await queueRoute.GET()).status).toBe(404);
  });

  it("shows a moderator every word of a submitted dungeon", async () => {
    const code = await published("Read Me");
    await submitRoute.POST(req(`/api/dungeons/${code}/submit`, {}), {
      params: Promise.resolve({ code }),
    });
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "admin_1", kind: "user", username: "adam" };
    const body = await json(await queueRoute.GET());
    const queue = body.queue as { code: string; prose: string[] }[];
    const mine = queue.find((d) => d.code === code);
    expect(mine).toBeTruthy();
    // The setup of every floor, so nothing needs opening to be read.
    expect(mine!.prose).toContain(SETUP);
    expect(mine!.prose).toContain("It gives.");
  });
});

describe("the play log", () => {
  it("is the author's and nobody else's", async () => {
    const code = await published();
    who = { id: "stranger", kind: "guest", displayName: "BEV" };
    const res = await logRoute.GET(req(`/api/dungeons/${code}/log`), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(403);
  });

  it("names the floor that stopped people, by its title", async () => {
    const code = await published();
    await hall.recordRun({ code, playerKey: "d1", score: 4, par: 20, finished: false, depth: 2, stoppedOn: 2 });
    await hall.recordRun({ code, playerKey: "d2", score: 4, par: 20, finished: false, depth: 2, stoppedOn: 2 });
    await finisher(code, "d3", 30);
    const body = await json(
      await logRoute.GET(req(`/api/dungeons/${code}/log`), { params: Promise.resolve({ code }) })
    );
    expect(body.plays).toBe(3);
    expect(body.finished).toBe(1);
    const stops = body.stops as { floor: number; title: string; count: number }[];
    expect(stops).toEqual([{ floor: 2, title: "Floor h2", count: 2 }]);
  });

  it("sets the solver's prediction beside what actually happened", async () => {
    const code = await published();
    await finisher(code, "e1", 30);
    const body = await json(
      await logRoute.GET(req(`/api/dungeons/${code}/log`), { params: Promise.resolve({ code }) })
    );
    // Both are rates, and the gap between them is the point of the screen: the
    // gate solves for perfect play, so it is always the optimistic one.
    expect(body.predicted).toBeGreaterThan(0);
    expect(body.observed).toBe(1);
  });
});

describe("chosen for the week", () => {
  it("shelves it, stamps it, and the stamp does not move on a second choosing", async () => {
    const code = await published("The Chosen One");
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "admin_1", kind: "user", username: "adam" };
    const params = Promise.resolve({ code });
    const first = await json(
      await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "choose" }), { params })
    );
    expect(first.visibility).toBe("listed");
    expect(typeof first.chosenAt).toBe("string");
    // Choosing again must not re-date it. "Chosen in August" stops being true and
    // stays worth saying, so the stamp is the FIRST time it happened.
    const again = await json(
      await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "choose" }), { params })
    );
    expect(again.chosenAt).toBe(first.chosenAt);
  });

  it("is the one thing the daily links to, and only if it is on the shelf", async () => {
    const { chosenDungeon, getDungeon, saveDungeon } = await import("@/lib/campaign/store");
    const code = await published("Front Of House");
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "admin_1", kind: "user", username: "adam" };
    await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "choose" }), {
      params: Promise.resolve({ code }),
    });
    expect((await chosenDungeon())?.code).toBe(code);

    // Taken down afterwards: the front page must stop pointing at it, stamp or no
    // stamp. A permanent stamp is not a permanent link.
    const row = await getDungeon(code);
    await saveDungeon({ ...row!, visibility: "banned" });
    expect((await chosenDungeon())?.code).not.toBe(code);
  });

  it("shows on the Hall card", async () => {
    const code = await published("Stamped");
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "admin_1", kind: "user", username: "adam" };
    await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "choose" }), {
      params: Promise.resolve({ code }),
    });
    const body = await json(await hallRoute.GET());
    const card = (body.fresh as { code: string; chosen: boolean }[]).find((d) => d.code === code);
    expect(card?.chosen).toBe(true);
  });

  it("does not let a guest choose anything", async () => {
    const code = await published();
    vi.stubEnv("ADMIN_USERNAMES", "adam");
    who = { id: "guest_author", kind: "guest", displayName: "adam" };
    const res = await actRoute.POST(req(`/api/admin/dungeons/${code}`, { action: "choose" }), {
      params: Promise.resolve({ code }),
    });
    expect(res.status).toBe(404);
  });
});

describe("the house dungeon is content, not data", () => {
  /**
   * A link to The Stone Walk went on the front page and in the header, and both
   * answered 404 on a deployment whose database was not reachable. It ships in the
   * bundle; it had no business needing a row.
   *
   * These run with Supabase mocked as unconfigured and the memstore empty, which
   * is the same shape as "the database is there and cannot answer".
   */
  it("is playable with nothing in the store at all", async () => {
    const { getDungeon } = await import("@/lib/campaign/store");
    const { DEMO_CODE, DEMO_TITLE } = await import("@/lib/content/demo-dungeon");
    const row = await getDungeon(DEMO_CODE);
    expect(row).toBeTruthy();
    expect(row!.title).toBe(DEMO_TITLE);
    expect(row!.publishedAt).toBeTruthy();
    // With a par, because a card with no par is not a card.
    expect(row!.par).toBeGreaterThan(0);
    expect(row!.difficulty).toBeTruthy();
  });

  it("serves the door and plays, with no row anywhere", async () => {
    const { DEMO_CODE } = await import("@/lib/content/demo-dungeon");
    const puzzle = await json(
      await play.GET(req(`/api/daily/deeprun?c=${DEMO_CODE}`))
    );
    const rooms = puzzle.rooms as { options: { id: string; kind: string }[] }[];
    expect(rooms.length).toBe(6);
    const callings = puzzle.callings as { id: string }[];
    const kit = puzzle.kit as { id: string }[];
    const res = await json(
      await play.POST(
        req(`/api/daily/deeprun?c=${DEMO_CODE}`, {
          callingId: callings[0].id,
          placement: [0, 1, 2, 3, 4, 5],
          kitIds: [kit[0].id, kit[1].id],
          steps: rooms.map((r) => ({
            optionId: r.options.find((o) => o.kind === "brace")!.id,
          })),
        })
      )
    );
    expect(res.finished).toBe(true);
    expect(typeof res.par).toBe("number");
  });

  it("does NOT invent somebody else's dungeon", async () => {
    // The fallback is for content that ships here and nothing else. If a stranger's
    // dungeon cannot be read, it is genuinely unavailable and saying so is right.
    const { getDungeon } = await import("@/lib/campaign/store");
    expect(await getDungeon("ZZZZZZ")).toBeNull();
  });
});
