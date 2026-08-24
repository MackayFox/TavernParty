import { describe, expect, it } from "vitest";
import { freshDraft, normaliseWants, resolveDraft, reversePriority } from "@/lib/game/draft";
import { DRAFT_RANKS } from "@/lib/game/rules";

const POOL = ["warden", "knife", "hedgewitch", "chanter"];

describe("submitting wants", () => {
  it("keeps only real ids, in order, without duplicates", () => {
    expect(normaliseWants(["knife", "nonsense", "knife", "warden"], POOL)).toEqual([
      "knife",
      "warden",
    ]);
  });

  it("never accepts more than the allowed number of ranks", () => {
    const all = normaliseWants([...POOL], POOL);
    expect(all).toHaveLength(DRAFT_RANKS);
  });
});

describe("resolving a draft", () => {
  it("gives everybody their first choice when nobody clashes", () => {
    const draft = freshDraft(POOL);
    draft.wants = { a: ["knife"], b: ["warden"], c: ["chanter"] };
    expect(resolveDraft(draft, ["a", "b", "c"])).toEqual({
      a: "knife",
      b: "warden",
      c: "chanter",
    });
  });

  it("settles a clash by priority, and drops the loser to their second", () => {
    const draft = freshDraft(POOL);
    draft.wants = { a: ["knife", "warden"], b: ["knife", "chanter"] };
    const granted = resolveDraft(draft, ["a", "b"]);
    expect(granted.a).toBe("knife");
    expect(granted.b).toBe("chanter");
  });

  it("walks all the way down a ranked list before falling back", () => {
    const draft = freshDraft(POOL);
    draft.wants = {
      a: ["knife"],
      b: ["warden"],
      c: ["knife", "warden", "hedgewitch"],
    };
    expect(resolveDraft(draft, ["a", "b", "c"]).c).toBe("hedgewitch");
  });

  /**
   * A dropped connection must not produce an unplayable character. This is the
   * difference between a game that survives somebody's train going into a tunnel
   * and one that does not.
   */
  it("still arms a player who submitted nothing at all", () => {
    const draft = freshDraft(POOL);
    draft.wants = { a: ["knife"] };
    const granted = resolveDraft(draft, ["a", "b"]);
    expect(granted.a).toBe("knife");
    expect(granted.b).toBeDefined();
    expect(granted.b).not.toBe("knife");
  });

  it("arms a player whose every want was taken", () => {
    const draft = freshDraft(POOL);
    draft.wants = { a: ["knife"], b: ["knife"] };
    const granted = resolveDraft(draft, ["a", "b"]);
    expect(granted.b).toBeDefined();
    expect(granted.b).not.toBe("knife");
  });

  it("never hands the same thing to two people", () => {
    const draft = freshDraft(POOL);
    draft.wants = { a: ["knife"], b: ["knife"], c: ["knife"], d: ["knife"] };
    const granted = resolveDraft(draft, ["a", "b", "c", "d"]);
    const taken = Object.values(granted);
    expect(new Set(taken).size).toBe(taken.length);
  });

  it("runs out gracefully when there are more players than things", () => {
    const draft = freshDraft(["only"]);
    const granted = resolveDraft(draft, ["a", "b", "c"]);
    expect(Object.keys(granted)).toEqual(["a"]);
  });

  it("is reproducible: the same inputs always give the same grant", () => {
    const build = () => {
      const d = freshDraft(POOL);
      d.wants = { a: ["chanter", "knife"], b: ["chanter"], c: [] };
      return d;
    };
    expect(resolveDraft(build(), ["a", "b", "c"])).toEqual(
      resolveDraft(build(), ["a", "b", "c"])
    );
  });
});

describe("the reverse-snake fork", () => {
  /**
   * The one line that stops any seat being strictly the best: first crack at the
   * Callings buys you last crack at the Kit.
   */
  it("hands the Kit draft back in the opposite order", () => {
    expect(reversePriority(["a", "b", "c"])).toEqual(["c", "b", "a"]);
  });

  it("means the player who won the Calling loses the Kit", () => {
    const calling = freshDraft(POOL);
    calling.wants = { a: ["knife"], b: ["knife"] };
    const gotCalling = resolveDraft(calling, ["a", "b"]);
    expect(gotCalling.a).toBe("knife");

    const kit = freshDraft(["rope", "lantern"]);
    kit.wants = { a: ["lantern"], b: ["lantern"] };
    const gotKit = resolveDraft(kit, reversePriority(["a", "b"]));
    expect(gotKit.b).toBe("lantern");
    expect(gotKit.a).toBe("rope");
  });
});
