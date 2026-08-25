/**
 * THE RUNNER'S LEDGER.
 *
 * A D&D player said the character building was underwhelming: a few choices from a
 * short list and then you throw the character away within minutes. He is right
 * about the throwing away, and wrong about the fix he asked for, which was a
 * character who grows stronger. That cannot be built here and the reason is
 * arithmetic rather than taste: par is computed by enumerating every character the
 * settings allow, so each new axis multiplies the solve, and a character stronger
 * than mine is not playing my puzzle at all.
 *
 * So the runner accumulates history and never strength, and these are the
 * properties that keep that promise honest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A localStorage that exists, for a test environment with no window. */
function fakeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeStore() });
});

const load = () => import("@/lib/daily/hero");

const night = (over: Partial<import("@/lib/daily/hero").Night> = {}) => ({
  on: "2026-08-25",
  label: "2026-08-25",
  callingId: "warden",
  score: 31,
  par: 51,
  out: true,
  floors: 6,
  reached: 6,
  ...over,
});

describe("making somebody", () => {
  it("deals the ancestry from the name, so it cannot be rerolled by pressing again", async () => {
    const { createHero } = await load();
    const a = createHero("MAERD", "signed-for-a-friend", 1234);
    vi.stubGlobal("window", { localStorage: fakeStore() });
    const b = createHero("MAERD", "signed-for-a-friend", 1234);
    expect(a.bloodId).toBe(b.bloodId);
  });

  it("keeps the name short and never empty", async () => {
    const { createHero } = await load();
    expect(createHero("   ", "signed-for-a-friend", 1).name).toBe("NOBODY");
    expect(
      createHero("a".repeat(80), "signed-for-a-friend", 1).name.length
    ).toBeLessThanOrEqual(24);
  });
});

describe("the ledger", () => {
  it("counts nights and never levels anything", async () => {
    const { createHero, recordNight, tally } = await load();
    createHero("MAERD", "signed-for-a-friend", 7);
    recordNight(night(), []);
    recordNight(night({ out: false, score: 8, reached: 4 }), []);
    const hero = recordNight(night({ score: 44 }), [])!;
    const counts = tally(hero);
    expect(counts.nights).toBe(3);
    expect(counts.out).toBe(2);
    expect(counts.best).toBe(44);
    // The whole point: nothing here is a stat a later run could benefit from.
    expect(Object.keys(hero)).toEqual(
      expect.arrayContaining(["name", "bloodId", "hookId", "born", "nights", "scars"])
    );
    expect(Object.keys(hero)).not.toContain("level");
    expect(Object.keys(hero)).not.toContain("xp");
  });

  it("keeps a scar as the door's own sentence, not a generated label", async () => {
    const { createHero, readHero, recordNight } = await load();
    createHero("MAERD", "signed-for-a-friend", 7);
    recordNight(night({ out: false }), [
      {
        where: "The Screech",
        line: "You move a beat early, it corrects, and you take the corner of the wall with your shoulder.",
        on: "2026-08-25",
      },
    ]);
    const scar = readHero()!.scars[0];
    // Verbatim authored prose. Every `lose` line in the game is written as a
    // wound and the gate refuses to publish an authored door without one, so a
    // scar costs no new words and works for somebody else's dungeon for free.
    expect(scar.line).toMatch(/corner of the wall with your shoulder/);
    expect(scar.where).toBe("The Screech");
  });

  it("does nothing at all when there is no runner", async () => {
    const { recordNight, readHero } = await load();
    expect(recordNight(night(), [])).toBeNull();
    expect(readHero()).toBeNull();
  });

  it("stays a bounded string however long somebody plays", async () => {
    const { createHero, recordNight, readHero } = await load();
    createHero("MAERD", "signed-for-a-friend", 7);
    for (let i = 0; i < 200; i++) {
      recordNight(night({ on: `d${i}` }), [{ where: "x", line: "y", on: `d${i}` }]);
    }
    const hero = readHero()!;
    expect(hero.nights.length).toBeLessThanOrEqual(60);
    expect(hero.scars.length).toBeLessThanOrEqual(40);
    // And it keeps the RECENT end, which is the half somebody cares about.
    expect(hero.nights[hero.nights.length - 1].on).toBe("d199");
  });

  it("survives a corrupted store rather than throwing", async () => {
    const { readHero } = await load();
    window.localStorage.setItem("tp_hero", "{not json");
    expect(readHero()).toBeNull();
    window.localStorage.setItem("tp_hero", JSON.stringify({ nights: [] }));
    expect(readHero()).toBeNull();
  });
});

describe("the one line", () => {
  it("says how long somebody has been at this, not how strong they are", async () => {
    const { createHero, recordNight, oneLine } = await load();
    createHero("MAERD", "signed-for-a-friend", 7);
    expect(oneLine(await readBack())).toMatch(/First night/);
    recordNight(night(), []);
    recordNight(night({ out: false }), []);
    const line = oneLine(await readBack());
    expect(line).toMatch(/MAERD/);
    expect(line).toMatch(/2 nights down/);
    expect(line).toMatch(/1 out alive/);
    expect(line).toMatch(/Best 31/);
    expect(line).not.toMatch(/level|Level|XP/);
  });

  async function readBack() {
    const { readHero } = await load();
    return readHero()!;
  }
});
