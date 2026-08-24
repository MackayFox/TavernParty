import { describe, expect, it } from "vitest";
import { rankPlayers, summariseRuns, type RunRow } from "@/lib/stats";

function run(over: Partial<RunRow> = {}): RunRow {
  return {
    runId: 1,
    code: "AAAA",
    finishedAt: "2026-08-24T20:00:00.000Z",
    acts: 5,
    players: 4,
    callingId: "warden",
    bloodId: "hillfolk",
    hookId: "signed-for-a-friend",
    renown: 20,
    keptScars: 1,
    laurels: 0,
    total: 24,
    placement: 2,
    hoard: false,
    ...over,
  };
}

describe("summariseRuns", () => {
  it("gives a player with no runs an empty record rather than NaN", () => {
    const r = summariseRuns([]);
    expect(r).toMatchObject({ runs: 0, hoards: 0, bestTotal: 0, favouriteCalling: null });
    // Math.max of nothing is -Infinity. That must never reach a page.
    expect(Number.isFinite(r.bestTotal)).toBe(true);
  });

  it("totals what accumulates and takes the best of what does not", () => {
    const r = summariseRuns([
      run({ runId: 1, renown: 10, keptScars: 0, laurels: 1, total: 18, hoard: true }),
      run({ runId: 2, renown: 30, keptScars: 2, laurels: 0, total: 41 }),
    ]);
    expect(r.runs).toBe(2);
    expect(r.hoards).toBe(1);
    expect(r.totalRenown).toBe(40);
    expect(r.scarsKept).toBe(2);
    expect(r.laurels).toBe(1);
    expect(r.bestTotal).toBe(41);
  });

  it("names the most-played Calling and breaks a tie the same way every time", () => {
    const rows = [
      run({ runId: 1, callingId: "warden" }),
      run({ runId: 2, callingId: "knife" }),
    ];
    expect(summariseRuns(rows).favouriteCalling).toBe("knife");
    expect(summariseRuns([...rows].reverse()).favouriteCalling).toBe("knife");
  });

  it("ignores runs where the Calling was never recorded", () => {
    const r = summariseRuns([
      run({ runId: 1, callingId: null }),
      run({ runId: 2, callingId: null }),
      run({ runId: 3, callingId: "warden" }),
    ]);
    expect(r.runs).toBe(3);
    expect(r.favouriteCalling).toBe("warden");
    expect(r.favouriteCallingRuns).toBe(1);
  });
});

describe("rankPlayers", () => {
  it("ranks by Hoards first, so grinding runs does not climb the board", () => {
    const board = rankPlayers([
      // Twenty runs, never won.
      ...Array.from({ length: 20 }, () => ({ username: "grinder", total: 30, hoard: false })),
      { username: "sharp", total: 22, hoard: true },
    ]);
    expect(board[0].username).toBe("sharp");
    expect(board[1]).toMatchObject({ username: "grinder", runs: 20, hoards: 0, bestTotal: 30 });
  });

  it("breaks a Hoard tie on the best single night", () => {
    const board = rankPlayers([
      { username: "a", total: 30, hoard: true },
      { username: "b", total: 55, hoard: true },
    ]);
    expect(board.map((r) => r.username)).toEqual(["b", "a"]);
  });

  it("drops rows whose profile could not be joined", () => {
    const board = rankPlayers([
      { username: "", total: 99, hoard: true },
      { username: "real", total: 10, hoard: false },
    ]);
    expect(board).toHaveLength(1);
    expect(board[0].username).toBe("real");
  });

  it("respects the limit", () => {
    const board = rankPlayers(
      Array.from({ length: 60 }, (_, i) => ({ username: `p${i}`, total: i, hoard: true })),
      10
    );
    expect(board).toHaveLength(10);
    expect(board[0].username).toBe("p59");
  });
});
