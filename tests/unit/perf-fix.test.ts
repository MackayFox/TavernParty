/**
 * What the poll costs, and what the room page ships.
 *
 * The product polls one JSONB row every 2.5s per player on a free tier metered
 * by egress, so the size of that row and the number of times it is actually read
 * are product limits rather than micro-optimisations. Measured on a real run
 * rather than asserted from memory: a six-player night is twelve minutes, 285
 * polls per player, 1,710 reads of the table, and 15 version bumps between them.
 *
 * The bundle checks read source files. There is no way to assert on a chunk from
 * a unit test, and "nothing on this path may import the Supabase client" is
 * exactly the kind of rule that is re-broken by somebody adding one convenient
 * import.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as engine from "@/lib/game/engine";
import { LOG_MAX } from "@/lib/game/rules";
import type { Room } from "@/lib/game/types";
import { rngFor } from "./helpers";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
// The fake Postgres, so the store can be measured without one
// ---------------------------------------------------------------------------

type Row = { code: string; version: number; state: Room };

/** Every column list the store asked Postgres for, in order. */
const asked: string[] = [];
/** Every Realtime channel the store opened. */
const channels: string[] = [];
const rows = new Map<string, Row>();

function query() {
  let mode: "select" | "update" | "insert" | "delete" = "select";
  let code: string | null = null;
  let expected: number | null = null;
  let patch: Record<string, unknown> = {};
  let columns = "";

  const q = {
    select(cols: string) {
      if (mode === "select") {
        columns = cols;
        asked.push(cols);
      }
      return q;
    },
    eq(col: string, value: unknown) {
      if (col === "code") code = String(value);
      if (col === "version") expected = Number(value);
      return q;
    },
    lt() {
      return q;
    },
    update(next: Record<string, unknown>) {
      mode = "update";
      patch = next;
      return q;
    },
    insert(next: Record<string, unknown>) {
      mode = "insert";
      patch = next;
      return q;
    },
    delete() {
      mode = "delete";
      return q;
    },
    maybeSingle() {
      return Promise.resolve(run());
    },
    then<T>(ok: (v: { data: unknown; error: null }) => T) {
      return Promise.resolve(run()).then(ok);
    },
  };

  function run(): { data: unknown; error: null } {
    const row = code ? rows.get(code) : undefined;
    if (mode === "insert") {
      const inserted = patch as unknown as Row;
      rows.set(inserted.code, {
        code: inserted.code,
        version: inserted.version,
        // Postgres round-trips JSON, so nobody downstream shares this object.
        state: structuredClone(inserted.state),
      });
      return { data: null, error: null };
    }
    if (mode === "update") {
      if (!row || (expected !== null && row.version !== expected)) return { data: [], error: null };
      row.version = Number(patch.version);
      row.state = structuredClone(patch.state as Room);
      return { data: [{ code: row.code }], error: null };
    }
    if (mode === "delete") return { data: null, error: null };
    if (!row) return { data: null, error: null };
    const picked: Record<string, unknown> = {};
    for (const col of columns.split(",").map((c) => c.trim())) {
      picked[col] = col === "state" ? structuredClone(row.state) : row[col as keyof Row];
    }
    return { data: picked, error: null };
  }

  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseConfigured: () => true,
  adminClient: () => ({
    from: () => query(),
    channel: (name: string) => {
      channels.push(name);
      return { send: async () => undefined };
    },
  }),
}));

const { dbStore } = await import("@/lib/game/dbstore");

/** A two-player lobby sitting in WAITING, which no tick will change. */
function seedLobby(code: string): Room {
  const now = Date.now();
  const room = engine.createRoom({ code, name: "The Test", visibility: "public" }, now);
  engine.join(room, { id: "p0", name: "ALEX" }, now);
  engine.join(room, { id: "p1", name: "BEV" }, now);
  rows.set(code, { code, version: room.version, state: structuredClone(room) });
  return room;
}

beforeEach(() => {
  asked.length = 0;
  channels.length = 0;
  rows.clear();
  // The sampled reaper is the only randomness in the store, and a delete against
  // the fake would put a stray query in `asked`.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The poll
// ---------------------------------------------------------------------------

describe("polling a table that has not changed", () => {
  it("asks for the version, not the state", async () => {
    seedLobby("POLLA1");
    await dbStore.snapshot("POLLA1", "p0"); // cold instance: one full read
    expect(asked).toContain("state");

    asked.length = 0;
    for (let i = 0; i < 5; i++) await dbStore.snapshot("POLLA1", "p0");

    // Five polls, five integers. At 7.4 KB a row this is the whole egress bill.
    expect(asked).toEqual(["version", "version", "version", "version", "version"]);
  });

  it("still sees a write another instance made", async () => {
    const room = seedLobby("POLLB2");
    await dbStore.snapshot("POLLB2", "p0");
    asked.length = 0;

    // Somebody else's instance moves the table on behind this one's back.
    const moved = structuredClone(room);
    moved.dread = 4;
    moved.version = room.version + 3;
    rows.set("POLLB2", { code: "POLLB2", version: moved.version, state: moved });

    const view = await dbStore.snapshot("POLLB2", "p0");
    expect(view?.dread).toBe(4);
    expect(asked).toEqual(["version", "state"]);
  });

  it("reports a reaped table as gone rather than serving the copy it holds", async () => {
    seedLobby("POLLC3");
    await dbStore.snapshot("POLLC3", "p0");
    rows.delete("POLLC3");
    expect(await dbStore.snapshot("POLLC3", "p0")).toBeNull();
  });

  it("hands out a copy, so one caller's tick is not the next caller's state", async () => {
    seedLobby("POLLD4");
    await dbStore.getRoom("POLLD4"); // fills the cache
    const first = await dbStore.getRoom("POLLD4"); // served out of it
    // Every caller mutates what it is given: `withRoom` ticks the room before
    // it does anything else, and drops the result when nothing bumped.
    first!.dread = 99;
    const second = await dbStore.getRoom("POLLD4");
    expect(second?.dread).toBe(0);
  });
});

describe("Realtime", () => {
  it("is not broadcast to unless the deployment asked for it", async () => {
    seedLobby("CASTA1");
    await dbStore.mutate("CASTA1", (room, now) =>
      engine.join(room, { id: "p2", name: "CASS" }, now)
    );
    // The write landed; the accelerant nobody is listening to did not.
    expect(rows.get("CASTA1")!.state.players).toHaveLength(3);
    expect(channels).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------

/** A full six-player run, played out on the deadlines. */
function playedOut(): Room {
  const start = 1_000_000;
  const room = engine.createRoom(
    { code: "TAVERN", name: "The Test", visibility: "public" },
    start
  );
  for (let i = 0; i < 6; i++) engine.join(room, { id: `p${i}`, name: `PLAYER${i}` }, start);
  engine.startRun(room, "p0", start, rngFor(7));
  let now = start;
  for (let i = 0; i < 400 && room.phase !== "FINAL"; i++) {
    now += 2_500;
    for (const p of room.players) engine.heartbeat(room, p.id, now);
    engine.tick(room, now, rngFor(i + 1));
  }
  return room;
}

describe("the state row", () => {
  it("is not mostly chronicle", () => {
    const room = playedOut();
    expect(room.phase).toBe("FINAL");
    const state = JSON.stringify(room).length;
    const log = JSON.stringify(room.log).length;
    // At LOG_MAX 60 this was 5,035 B of a 9,666 B row: 52% of every poll spent
    // on forty-eight entries nothing renders.
    expect(log / state).toBeLessThan(0.3);
    expect(state).toBeLessThan(7_500);
  });

  it("still carries everything the Chronicle shows", () => {
    // `Chronicle` renders twelve. Trimming below that would be cutting the
    // screen, not the payload.
    expect(LOG_MAX).toBeGreaterThanOrEqual(12);
    expect(read("components/room/shared.tsx")).toContain("limit = 12");
  });
});

// ---------------------------------------------------------------------------
// The bundle
// ---------------------------------------------------------------------------

describe("what the room and the dailies ship", () => {
  it("keeps the Supabase client out of the shared client helpers", () => {
    // Five screens import this module for `postJson`. One unused `useLoggedIn`
    // hook put 227 KB of Supabase into all five of their bundles.
    expect(read("components/client.ts")).not.toMatch(/from "@\/lib\/supabase/);
  });

  it("reaches Realtime through a dynamic import or not at all", () => {
    const room = read("app/room/[code]/RoomClient.tsx");
    expect(room).not.toMatch(/^import .*lib\/supabase/m);
    expect(room).toMatch(/import\("@\/lib\/supabase\/browser"\)/);
  });

  it("renders the first snapshot on the server", () => {
    // The page was a spinner until the JavaScript, the hydration and one round
    // trip had all finished, in that order.
    const page = read("app/room/[code]/page.tsx");
    expect(page).not.toMatch(/"use client"/);
    expect(page).toMatch(/store\.snapshot/);
  });
});
