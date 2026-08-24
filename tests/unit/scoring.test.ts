import { describe, expect, it } from "vitest";
import { median, standingsFor } from "@/lib/game/scoring";
import { KEPT_SCAR_VALUE, LAUREL_VALUE } from "@/lib/game/rules";
import type { Scar } from "@/lib/game/types";
import { makePlayer } from "./helpers";

function scars(kept: number, hidden: number): Scar[] {
  const out: Scar[] = [];
  for (let i = 0; i < kept; i++)
    out.push({ id: `k${i}`, sceneId: "a01", label: "kept", kept: true });
  for (let i = 0; i < hidden; i++)
    out.push({ id: `h${i}`, sceneId: "a01", label: "hidden", kept: false });
  return out;
}

describe("median", () => {
  it("takes the middle, and the UPPER middle on an even table", () => {
    expect(median([1, 5, 9])).toBe(5);
    expect(median([1, 4, 6, 9])).toBe(6);
    expect(median([])).toBe(0);
  });

  /**
   * The reason it is the upper middle. With the lower one, the bottom player of
   * a two-person table is always "at the median", so the Scar gate did nothing
   * at exactly the table size where a coward strategy is easiest to run.
   */
  it("is something the lower half of a two-player table can fail", () => {
    expect(median([1, 30])).toBe(30);
  });
});

describe("the Ballad", () => {
  it("pays Renown plus kept Scars plus Laurels", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 20, scars: scars(2, 0) });
    const b = makePlayer({ id: "b", name: "BEV", renown: 20, laurelFor: "a" });
    const rows = standingsFor([a, b]);
    const alex = rows.find((r) => r.playerId === "a");
    expect(alex?.total).toBe(20 + 2 * KEPT_SCAR_VALUE + LAUREL_VALUE);
  });

  /**
   * The anti-degenerate clamp, and the most important assertion in this file.
   * Without the median gate the winning line is to never take a risk, collect
   * cheap Scars and keep all of them.
   */
  it("refuses to pay a coward for their Scars", () => {
    const brave = makePlayer({ id: "a", name: "ALEX", renown: 30 });
    const coward = makePlayer({ id: "b", name: "BEV", renown: 1, scars: scars(5, 0) });
    const rows = standingsFor([brave, coward]);
    const bev = rows.find((r) => r.playerId === "b");
    expect(bev?.keptScars).toBe(5);
    expect(bev?.total).toBe(1);
    expect(rows[0].playerId).toBe("a");
  });

  it("pays them once they are at the median", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 10 });
    const b = makePlayer({ id: "b", name: "BEV", renown: 10, scars: scars(2, 0) });
    const rows = standingsFor([a, b]);
    expect(rows.find((r) => r.playerId === "b")?.total).toBe(10 + 2 * KEPT_SCAR_VALUE);
  });

  it("ignores a hidden Scar entirely", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 10, scars: scars(0, 4) });
    expect(standingsFor([a])[0].keptScars).toBe(0);
    expect(standingsFor([a])[0].total).toBe(10);
  });

  /**
   * Laurels exist so the player who is out of contention by Act IV still holds
   * something the leaders want, right up to the last second.
   */
  it("lets the table's votes decide a close finish", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 24 });
    const b = makePlayer({ id: "b", name: "BEV", renown: 20 });
    const c = makePlayer({ id: "c", name: "CHRIS", renown: 2, laurelFor: "b" });
    const d = makePlayer({ id: "d", name: "DALE", renown: 2, laurelFor: "b" });
    const rows = standingsFor([a, b, c, d]);
    expect(rows[0].playerId).toBe("b");
  });

  it("never counts a vote for yourself", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 5, laurelFor: "a" });
    expect(standingsFor([a])[0].laurels).toBe(0);
  });

  it("ignores a vote for somebody who is not at the table", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 5, laurelFor: "ghost" });
    expect(standingsFor([a])[0].total).toBe(5);
  });

  it("awards the Hoard to exactly one player, even on a dead tie", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 10 });
    const b = makePlayer({ id: "b", name: "BEV", renown: 10 });
    const rows = standingsFor([a, b]);
    expect(rows.filter((r) => r.hoard)).toHaveLength(1);
    // Tied on everything, so it falls to the name, and it must be stable.
    expect(standingsFor([b, a])[0].playerId).toBe(rows[0].playerId);
  });

  it("shares a placement on a tie but still ranks them in a fixed order", () => {
    const a = makePlayer({ id: "a", name: "ALEX", renown: 10 });
    const b = makePlayer({ id: "b", name: "BEV", renown: 10 });
    const c = makePlayer({ id: "c", name: "CHRIS", renown: 1 });
    const rows = standingsFor([a, b, c]);
    expect(rows[0].placement).toBe(1);
    expect(rows[1].placement).toBe(1);
    expect(rows[2].placement).toBe(3);
  });

  it("covers every player exactly once", () => {
    const players = ["a", "b", "c", "d", "e"].map((id) =>
      makePlayer({ id, name: id.toUpperCase(), renown: 5 })
    );
    const rows = standingsFor(players);
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.playerId)).size).toBe(5);
  });
});
