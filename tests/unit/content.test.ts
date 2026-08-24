import { describe, expect, it } from "vitest";
import { BLOODS, BLOOD_DETAIL } from "@/lib/content/bloods";
import { CALLINGS, CALLING_DETAIL } from "@/lib/content/callings";
import { HOOKS, HOOK_DETAIL } from "@/lib/content/hooks";
import { KIT, KIT_DETAIL } from "@/lib/content/kit";
import { SCENES } from "@/lib/content/scenes";
import { TAGS, isTag } from "@/lib/content/tags";
import { ABILITIES } from "@/lib/game/types";
import { AFFINITY_BONUS, DIE_SIDES, HOOK_TOKEN_VALUE, MARK_BONUS, abilityMod } from "@/lib/game/rules";
import type { ApproachDef, Scene } from "@/lib/game/types";

/**
 * The content invariants.
 *
 * Written after an independent review of the first draft of the content found
 * things no author could see from inside their own file, because each of them
 * was allowed to write one file and nothing else. Every finding in that review
 * is a test in here, so the next person to add a scene finds out immediately
 * rather than after a playtest.
 */

// ---------------------------------------------------------------------------
// Tags: the coordination point between all four content files
// ---------------------------------------------------------------------------

describe("tags", () => {
  it("only ever references a tag that exists", () => {
    for (const s of SCENES) for (const t of s.tags) expect(isTag(t), `${s.id}: ${t}`).toBe(true);
    for (const h of HOOKS) {
      expect(isTag(h.insertTag), `${h.id} insert`).toBe(true);
      expect(isTag(h.callTag), `${h.id} call`).toBe(true);
    }
    for (const c of CALLINGS) {
      expect(isTag(c.failing.tag), `${c.id} failing`).toBe(true);
    }
  });

  it("leaves no tag as dead content", () => {
    const onScenes = new Set(SCENES.flatMap((s) => s.tags));
    for (const t of TAGS) expect(onScenes.has(t), `no scene carries ${t}`).toBe(true);
  });

  /**
   * A Hook's Insert is a promise that the tag turns up in the deck. With only
   * one or two scenes carrying a tag, the holder sees the same scene honour
   * their promise every single run, which reads as the game repeating itself
   * rather than as their history following them around.
   */
  it("gives every tag enough scenes that an Insert is not always the same scene", () => {
    const thin: string[] = [];
    for (const t of TAGS) {
      const count = SCENES.filter((s) => s.tags.includes(t)).length;
      if (count < 3) thin.push(`${t} (${count})`);
    }
    expect(thin, `tags with fewer than 3 scenes: ${thin.join(", ")}`).toEqual([]);
  });

  it("lets every tag refill somebody's Hook, so no tag is a dead end", () => {
    const calls = new Set(HOOKS.map((h) => h.callTag));
    const never = TAGS.filter((t) => !calls.has(t));
    expect(never, `no Hook is called by: ${never.join(", ")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shape and completeness
// ---------------------------------------------------------------------------

describe("the sets", () => {
  it("are the sizes the design calls for", () => {
    expect(CALLINGS).toHaveLength(8);
    expect(BLOODS).toHaveLength(8);
    expect(KIT).toHaveLength(12);
    expect(HOOKS).toHaveLength(20);
    expect(SCENES).toHaveLength(30);
  });

  it("have unique ids, within and across the sets", () => {
    for (const [label, set] of [
      ["callings", CALLINGS],
      ["bloods", BLOODS],
      ["kit", KIT],
      ["hooks", HOOKS],
      ["scenes", SCENES],
    ] as const) {
      const ids = set.map((x) => x.id);
      expect(new Set(ids).size, `${label} has a duplicate id`).toBe(ids.length);
    }
    const approachIds = SCENES.flatMap((s) => s.approaches.map((a) => a.id));
    expect(new Set(approachIds).size, "duplicate approach id").toBe(approachIds.length);
  });

  /**
   * The DETAIL records are Record<string, string>, so a missing entry is not a
   * compile error. It is a blank space on the character-creation screen, which
   * is the single most important screen in the game.
   */
  it("write the long description for every single choice", () => {
    const pairs = [
      ["calling", CALLINGS, CALLING_DETAIL],
      ["blood", BLOODS, BLOOD_DETAIL],
      ["kit", KIT, KIT_DETAIL],
      ["hook", HOOKS, HOOK_DETAIL],
    ] as const;
    for (const [label, set, detail] of pairs) {
      for (const item of set) {
        expect(detail[item.id], `${label} ${item.id} has no detail`).toBeTruthy();
        expect(detail[item.id].length, `${label} ${item.id} detail too short`).toBeGreaterThan(40);
      }
      const orphans = Object.keys(detail).filter((k) => !set.some((i) => i.id === k));
      expect(orphans, `${label} detail has orphan keys`).toEqual([]);
    }
  });

  it("uses each Blood power exactly once, so no two Bloods do the same thing", () => {
    const kinds = BLOODS.map((b) => b.power.kind);
    expect(new Set(kinds).size).toBe(BLOODS.length);
  });

  it("gives every Calling a distinct pair of affinities covering every ability", () => {
    const pairs = CALLINGS.map((c) => [...c.affinities].sort().join("+"));
    expect(new Set(pairs).size).toBe(CALLINGS.length);
    for (const a of ABILITIES) {
      const count = CALLINGS.filter((c) => c.affinities.includes(a)).length;
      expect(count, `${a} is the affinity of ${count} Callings`).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses each Calling Signature exactly once", () => {
    const kinds = CALLINGS.map((c) => c.signature.kind);
    expect(new Set(kinds).size).toBe(CALLINGS.length);
  });

  it("spreads Kit bonuses across every ability", () => {
    for (const a of ABILITIES) {
      const count = KIT.filter((k) => k.bonus?.ability === a).length;
      expect(count, `no Kit helps ${a}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every piece of Kit something to do", () => {
    for (const k of KIT) {
      expect(k.bonus !== null || k.charge !== null, `${k.id} does nothing`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

describe("scenes", () => {
  it("offer exactly three approaches, on three different abilities", () => {
    for (const s of SCENES) {
      expect(s.approaches, s.id).toHaveLength(3);
      const abilities = s.approaches.map((a) => a.ability);
      expect(new Set(abilities).size, `${s.id} repeats an ability`).toBe(3);
    }
  });

  it("has exactly one Reckless line, and it really is the reckless one", () => {
    for (const s of SCENES) {
      const reckless = s.approaches.filter((a) => a.reckless);
      expect(reckless, `${s.id} reckless count`).toHaveLength(1);
      const r = reckless[0];
      for (const other of s.approaches.filter((a) => !a.reckless)) {
        expect(r.deed, `${s.id} deed`).toBeGreaterThan(other.deed);
        expect(r.tn, `${s.id} tn`).toBeGreaterThan(other.tn);
      }
    }
  });

  it("keeps numbers inside the bands the design set", () => {
    for (const s of SCENES) {
      for (const a of s.approaches) {
        expect(a.tn, `${s.id}/${a.id} tn`).toBeGreaterThanOrEqual(8);
        expect(a.tn, `${s.id}/${a.id} tn`).toBeLessThanOrEqual(18);
        expect(a.deed, `${s.id}/${a.id} deed`).toBeGreaterThanOrEqual(2);
        expect(a.cost.renown, `${s.id}/${a.id} cost`).toBeGreaterThanOrEqual(1);
        expect(a.cost.dread, `${s.id}/${a.id} dread`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("never states a number inside the fiction", () => {
    // The itemised ledger prints the arithmetic. Prose that also prints it goes
    // stale the moment a balance number moves.
    for (const s of SCENES) {
      for (const a of s.approaches) {
        expect(a.win, `${s.id}/${a.id} win`).not.toMatch(/\d/);
        expect(a.lose, `${s.id}/${a.id} lose`).not.toMatch(/\d/);
      }
    }
  });

  it("uses no em-dashes in player-facing copy", () => {
    const copy = SCENES.flatMap((s) => [
      s.title,
      s.setup,
      ...s.approaches.flatMap((a) => [a.label, a.win, a.lose]),
    ]);
    for (const line of copy) expect(line).not.toContain("—");
  });

  /**
   * The failure mode to hunt for: an Act where a character has nothing to do.
   * Every Calling must have a safe door it is trained for in a decent share of
   * scenes, because the Reckless line is exclusive and can be taken from them.
   */
  it("gives every Calling safe doors it is trained for", () => {
    const report: string[] = [];
    for (const c of CALLINGS) {
      const safeDoors = SCENES.filter((s) =>
        s.approaches.some((a) => !a.reckless && c.affinities.includes(a.ability))
      ).length;
      if (safeDoors < SCENES.length * 0.5) report.push(`${c.name} ${safeDoors}/${SCENES.length}`);
    }
    expect(report, `Callings with a safe trained door in under half of scenes: ${report.join(", ")}`).toEqual([]);
  });

  it("spreads the non-reckless abilities so no ability is starved", () => {
    const counts = new Map<string, number>();
    for (const s of SCENES) {
      for (const a of s.approaches) {
        if (a.reckless) continue;
        counts.set(a.ability, (counts.get(a.ability) ?? 0) + 1);
      }
    }
    const starved: string[] = [];
    for (const a of ABILITIES) {
      const n = counts.get(a) ?? 0;
      // 30 scenes x 2 safe doors = 60 slots. An even spread is 10 each; below 7
      // and a Calling trained in it is meaningfully worse off than its peers.
      if (n < 7) starved.push(`${a} (${n})`);
    }
    expect(starved, `starved abilities: ${starved.join(", ")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Is the Reckless line worth taking?
// ---------------------------------------------------------------------------

/** Expected Renown from one attempt, for a player with `mod` on the roll. */
function expectedValue(a: ApproachDef, mod: number): number {
  const need = a.tn - mod;
  // A natural 20 always succeeds, a natural 1 always fails.
  const winFaces = Math.min(19, Math.max(1, DIE_SIDES - Math.max(2, need) + 1));
  const p = winFaces / DIE_SIDES;
  return p * a.deed - (1 - p) * a.cost.renown;
}

function bestSafe(s: Scene, mod: number): number {
  return Math.max(...s.approaches.filter((a) => !a.reckless).map((a) => expectedValue(a, mod)));
}

describe("the Reckless line", () => {
  /**
   * The centrepiece of the design: one door per Act, exclusive, contested, with
   * a hidden target number, worth nominating somebody else into.
   *
   * The first draft of the content had it strictly worse than both safe lines in
   * all thirty scenes, for a normally-equipped player. Nobody would ever take
   * it, which quietly removes exclusivity, nomination, the Mark and the hidden
   * number from the game all at once. This test is the reason it does not.
   *
   * The bar is deliberately not "always the best line". A gamble should be
   * roughly break-even for somebody with no particular claim on it, and clearly
   * worth it for the player the Act is about, which is what the Mark and a Hook
   * token represent.
   */
  const TYPICAL = abilityMod(14) + AFFINITY_BONUS; // +4: a trained character

  it("is worth taking for the player the Act is about", () => {
    const traps: string[] = [];
    for (const s of SCENES) {
      const r = s.approaches.find((a) => a.reckless)!;
      // The player who is Marked for it, or who spends one Hook token on it.
      const claimed = expectedValue(r, TYPICAL + HOOK_TOKEN_VALUE) + MARK_BONUS;
      if (claimed <= bestSafe(s, TYPICAL)) traps.push(s.id);
    }
    expect(traps, `Reckless is a trap even for its own player in: ${traps.join(", ")}`).toEqual([]);
  });

  it("is not so far behind for everybody else that nobody ever gambles", () => {
    const hopeless: string[] = [];
    for (const s of SCENES) {
      const r = s.approaches.find((a) => a.reckless)!;
      const plain = expectedValue(r, TYPICAL);
      const safe = bestSafe(s, TYPICAL);
      // Allowed to be worse. Not allowed to be worse by more than a whole safe
      // door's worth, which is the point where it stops reading as a gamble and
      // starts reading as a mistake.
      if (plain < safe - 2.5) hopeless.push(`${s.id} (${plain.toFixed(1)} vs ${safe.toFixed(1)})`);
    }
    expect(hopeless, `Reckless is hopeless in: ${hopeless.join(", ")}`).toEqual([]);
  });

  it("pays more than the safe doors when it lands, in every scene", () => {
    for (const s of SCENES) {
      const r = s.approaches.find((a) => a.reckless)!;
      for (const other of s.approaches.filter((a) => !a.reckless)) {
        expect(r.deed, s.id).toBeGreaterThan(other.deed);
      }
    }
  });
});
