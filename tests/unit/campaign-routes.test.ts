/**
 * The whole authoring loop, through the real route handlers.
 *
 * Create a draft, fail the gate on purpose, fix it, publish, and play it to the
 * bottom. The point is the seams: the gate running again server-side at publish,
 * the play route branching on a dungeon code rather than getting a second copy
 * of itself, and a published dungeon refusing to be edited underneath the people
 * who already have its link.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomDef } from "@/lib/daily/deeprun-data";

// Guest identity, so the loop is tested the way most first authors will meet it.
vi.mock("@/lib/identity", () => ({
  getIdentity: async () => ({ id: "guest_1", kind: "guest", displayName: "ALEX" }),
  getGuestId: async () => "guest_1",
  getOrCreateGuestId: async () => "guest_1",
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

const good = {
  title: "The Weeping Stair",
  intro: "Wet from the first floor to the last, and do not count on a rope.",
  rooms: [room("g1", 12, 2), room("g2", 13, 3), room("g3", 14, 3)],
  callingIds: ["warden", "knife", "hedgewitch"],
  kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
  baseVigour: 9,
};

let index: typeof import("@/app/api/dungeons/route");
let one: typeof import("@/app/api/dungeons/[code]/route");
let report: typeof import("@/app/api/dungeons/[code]/report/route");
let publish: typeof import("@/app/api/dungeons/[code]/publish/route");
let play: typeof import("@/app/api/daily/deeprun/route");

beforeEach(async () => {
  index = await import("@/app/api/dungeons/route");
  one = await import("@/app/api/dungeons/[code]/route");
  report = await import("@/app/api/dungeons/[code]/report/route");
  publish = await import("@/app/api/dungeons/[code]/publish/route");
  play = await import("@/app/api/daily/deeprun/route");
});

async function draft(body: unknown = good): Promise<string> {
  const made = await json(await index.POST(req("/api/dungeons", {})));
  const code = made.code as string;
  const params = Promise.resolve({ code });
  await one.PUT(put(`/api/dungeons/${code}`, body), { params });
  return code;
}

describe("the loop", () => {
  it("opens a draft with a code and nothing in it", async () => {
    const made = await json(await index.POST(req("/api/dungeons", {})));
    expect(made.code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("refuses a room the wire itself will not carry", async () => {
    // A target of 40 is not a hard door, it is a door that does not open, and
    // the gate should never have to see it. Discovered by writing a fixture that
    // was illegal rather than impossible and watching the save bounce it.
    const made = await json(await index.POST(req("/api/dungeons", {})));
    const code = made.code as string;
    const res = await one.PUT(
      put(`/api/dungeons/${code}`, { ...good, rooms: [room("z1", 40, 40)] }),
      { params: Promise.resolve({ code }) }
    );
    expect(res.status).toBe(400);
  });

  it("refuses to publish one the gate is unhappy with, and says why", async () => {
    // Legal at the wire and impossible in play: eight floors at the maximum cost
    // a door may carry, against the least Vigour anybody may start with.
    const eight = Array.from({ length: 8 }, (_, i) => room(`b${i}`, 20, 8));
    const code = await draft({ ...good, rooms: eight, baseVigour: 5 });
    const params = Promise.resolve({ code });
    const res = await publish.POST(req(`/api/dungeons/${code}/publish`, {}), { params });
    expect(res.status).toBe(400);
    const body = await json(res);
    const rep = body.report as { ok: boolean; notes: { severity: string; text: string }[] };
    expect(rep.ok).toBe(false);
    expect(rep.notes.some((n) => n.severity === "block")).toBe(true);
  });

  it("publishes a good one and hands back a par", async () => {
    const code = await draft();
    const params = Promise.resolve({ code });
    const res = await publish.POST(req(`/api/dungeons/${code}/publish`, {}), { params });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);
    const rep = body.report as { par: number; difficulty: string; ok: boolean };
    expect(rep.ok).toBe(true);
    expect(rep.par).toBeGreaterThan(0);
    expect(["A walk", "Fair", "Stiff", "Brutal", "Only just"]).toContain(rep.difficulty);
  });

  it("freezes a published dungeon against edits", async () => {
    // Its par and its card went out with the link. Editing the rooms afterwards
    // means Tuesday's score was set on a different dungeon to Thursday's.
    const code = await draft();
    const params = Promise.resolve({ code });
    await publish.POST(req(`/api/dungeons/${code}/publish`, {}), { params });
    const res = await one.PUT(put(`/api/dungeons/${code}`, { ...good, title: "Renamed" }), { params });
    expect(res.status).toBe(409);
    expect((await json(res)).code).toBe("published");
  });
});

describe("playing somebody else's", () => {
  it("serves the door without any dice in it", async () => {
    const code = await draft();
    await publish.POST(req(`/api/dungeons/${code}/publish`, {}), {
      params: Promise.resolve({ code }),
    });
    const body = await json(await play.GET(req(`/api/daily/deeprun?c=${code}`)));
    expect(body.label).toBe(good.title);
    expect(body.rooms).toHaveLength(3);
    // The one thing that must never be in it before a choice.
    const text = JSON.stringify(body);
    expect(text).not.toContain("It gives.");
    expect(text).not.toContain("It does not.");
    expect(text).not.toMatch(/"(die|roll)"/);
  });

  it("plays it to the bottom through the same handler as the daily", async () => {
    const code = await draft();
    await publish.POST(req(`/api/dungeons/${code}/publish`, {}), {
      params: Promise.resolve({ code }),
    });
    const puzzle = await json(await play.GET(req(`/api/daily/deeprun?c=${code}`)));
    const rooms = puzzle.rooms as { options: { id: string }[] }[];
    const callings = puzzle.callings as { id: string }[];
    const kit = puzzle.kit as { id: string }[];

    const result = await json(
      await play.POST(
        req(`/api/daily/deeprun?c=${code}`, {
          callingId: callings[0].id,
          placement: [0, 1, 2, 3, 4, 5],
          kitIds: [kit[0].id, kit[1].id],
          steps: rooms.map((r) => ({ optionId: r.options[0].id })),
        })
      )
    );
    expect(result.finished).toBe(true);
    expect(typeof result.score).toBe("number");
    expect(typeof result.par).toBe("number");
    // And the prose only arrives once a floor has been committed to.
    expect(JSON.stringify(result.lines)).toMatch(/It gives\.|It does not\./);
  });

  it("shares a link to the dungeon, not to the daily", async () => {
    // This is the entire distribution mechanism of the feature. The first
    // version read "THE DEEP RUN The Weeping Stair" and linked to /daily/deeprun,
    // which sends everybody who clicks it to a different game than the one being
    // talked about.
    const code = await draft();
    await publish.POST(req(`/api/dungeons/${code}/publish`, {}), {
      params: Promise.resolve({ code }),
    });
    const puzzle = await json(await play.GET(req(`/api/daily/deeprun?c=${code}`)));
    const rooms = puzzle.rooms as { options: { id: string }[] }[];
    const callings = puzzle.callings as { id: string }[];
    const kit = puzzle.kit as { id: string }[];
    const result = await json(
      await play.POST(
        req(`/api/daily/deeprun?c=${code}`, {
          callingId: callings[0].id,
          placement: [0, 1, 2, 3, 4, 5],
          kitIds: [kit[0].id, kit[1].id],
          steps: rooms.map((r) => ({ optionId: r.options[0].id })),
        })
      )
    );
    const share = result.share as string;
    expect(share).toContain(`/d/${code}`);
    expect(share).not.toContain("/daily/deeprun");
    expect(share).toContain("THE WEEPING STAIR");
    expect(share).toContain("by ALEX");
    // And every URL in it carries a scheme, or nothing unfurls it.
    for (const m of share.match(/tavernparty\.co\.uk\S*/g) ?? []) {
      expect(share).toContain(`https://${m}`);
    }
  });

  it("still shares the daily as the daily", async () => {
    const puzzle = await json(await play.GET(req("/api/daily/deeprun")));
    const rooms = puzzle.rooms as { options: { id: string }[] }[];
    const callings = puzzle.callings as { id: string }[];
    const kit = puzzle.kit as { id: string }[];
    const result = await json(
      await play.POST(
        req("/api/daily/deeprun", {
          callingId: callings[0].id,
          placement: [0, 1, 2, 3, 4, 5],
          kitIds: [kit[0].id, kit[1].id],
          steps: rooms.map((r) => ({ optionId: r.options[0].id })),
        })
      )
    );
    expect(result.share as string).toContain("THE DEEP RUN");
    expect(result.share as string).toContain("/daily/deeprun");
  });

  it("refuses a dungeon that was never published", async () => {
    const code = await draft();
    const res = await play.GET(req(`/api/daily/deeprun?c=${code}`));
    expect(res.status).toBe(404);
  });

  it("leaves the daily alone", async () => {
    const body = await json(await play.GET(req("/api/daily/deeprun")));
    expect(body.dungeon).toBeNull();
    expect(body.rooms).toBeTruthy();
  });
});

describe("somebody else's draft", () => {
  it("is not editable and does not come back whole", async () => {
    const code = await draft();
    vi.doMock("@/lib/identity", () => ({
      getIdentity: async () => ({ id: "guest_2", kind: "guest", displayName: "BEV" }),
      getGuestId: async () => "guest_2",
      getOrCreateGuestId: async () => "guest_2",
    }));
    vi.resetModules();
    const asOther = await import("@/app/api/dungeons/[code]/route");
    const params = Promise.resolve({ code });
    const res = await asOther.PUT(put(`/api/dungeons/${code}`, good), { params });
    expect(res.status).toBe(403);
    vi.doUnmock("@/lib/identity");
    vi.resetModules();
  });
});
