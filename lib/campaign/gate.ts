/**
 * THE GATE. Server-only.
 *
 * The reason this product is worth building. Almost no user-generated-content
 * tool can evaluate its own content: a level editor cannot tell you your level
 * is impossible, and no amount of star rating will. This one can, exactly,
 * because every room's die is pinned before the player chooses, so there is no
 * probability anywhere in the problem and the best line for a given character is
 * a plain walk rather than an expectation.
 *
 * So an author does not guess. They are told, before they publish:
 *
 *   Par is 41. Nine of the thirty-six characters you allow get out alive.
 *   Floor three is where most of them stop. This one is Stiff.
 *
 * WHAT BLOCKS AND WHAT ONLY WARNS. A block is reserved for a dungeon that is not
 * a dungeon: nobody can finish it, only one kind of character can, or everybody
 * scores the same. Everything else warns, loudly, and publishes anyway.
 * Sometimes a brutal dungeon is the point, and a validator that refuses taste is
 * a validator people route around.
 *
 * DIFFICULTY IS DERIVED, NEVER AUTHORED. An author cannot label a walkover
 * brutal or a meat grinder gentle. It is the one thing on a browse card a player
 * can actually trust, and it is worth more than any rating.
 *
 * The whole report falls out of one pass over the enumeration `parFor` already
 * performs. The extra cost is recording what that loop computes and throws away.
 */
import { ABILITIES, type Ability } from "@/lib/game/types";
import { abilityMod } from "@/lib/game/rules";
import {
  ceilingFor,
  puzzleFrom,
  run,
  type Build,
  type Design,
  type Puzzle,
  type Step,
} from "@/lib/daily/deeprun";
import { bestFor, parFor } from "@/lib/daily/deeprun-par";
import type { RoomDef } from "@/lib/daily/deeprun-data";

/** The caps. Measured, not guessed: see the note on `enumerationBound`. */
export const MIN_FLOORS = 3;
export const MAX_FLOORS = 8;
export const MAX_CALLINGS = 4;
export const MAX_KIT = 6;
export const MIN_CALLINGS = 1;
export const MIN_KIT = 2;
/**
 * How many distinct marks a dungeon may READ.
 *
 * This one is not a taste cap, it is the wall between a table and a tree. The par
 * search memoises on what you are carrying, so every mark a door tests can double
 * the table: four is at most sixteen times a memo that holds a couple of hundred
 * entries per character, which is nothing, and eight would be 256 times, which is
 * a request that times out. Marks nothing tests are free and uncapped, because
 * flavour cannot branch a search.
 */
export const MAX_MARKS_READ = 4;
/** Per door, so one option cannot carry a shopping list. */
export const MAX_MARKS_PER_OPTION = 3;

/**
 * How many characters the solver will enumerate for a design.
 *
 * There is a performance cliff here and it is invisible in the UI, so it gets a
 * function and a test rather than a comment. Measured on the shipped machine:
 * 4 Callings / 6 Kit / 8 floors solves in about 250ms; 4/8/8 takes 747ms; and
 * all 8 Callings with all 12 Kit takes 3.6 seconds. Somebody will eventually
 * widen a cap because it looks like a small number. This is what stops them.
 */
export function enumerationBound(callings: number, kit: number): number {
  const pairs = (kit * (kit - 1)) / 2;
  return callings * pairs * ABILITIES.length;
}

export type Severity = "block" | "warn" | "good";
export type Note = { severity: Severity; text: string; floor?: number };

export type Report = {
  /** Publishable. False when anything blocks. */
  ok: boolean;
  par: number;
  /** How many distinct characters the author's settings allow. */
  builds: number;
  /** How many of those get out alive. */
  out: number;
  /** A walk / Fair / Stiff / Brutal / Only just. Derived, never authored. */
  difficulty: string;
  /** 1-based, or null when nobody stops anywhere in particular. */
  wallFloor: number | null;
  notes: Note[];
  /** The sentence the author reads first. */
  summary: string;
};

const DIFFICULTY: [number, string][] = [
  [0.7, "A walk"],
  [0.45, "Fair"],
  [0.22, "Stiff"],
  [0.08, "Brutal"],
  // "Only just" reads as the back half of a sentence when it sits alone in a pill
  // next to a title, and the difficulty word is the one thing on a browse card
  // this product claims a player can trust.
  [0, "Barely possible"],
];

/** Checks that need no solve at all. Instant, on every keystroke. */
export function instantProblems(design: Design): string[] {
  const bad: string[] = [];
  const n = design.rooms.length;
  if (n < MIN_FLOORS) bad.push(`A dungeon is at least ${MIN_FLOORS} floors. This one has ${n}.`);
  if (n > MAX_FLOORS) bad.push(`${MAX_FLOORS} floors is the most the solver will take. This one has ${n}.`);

  const callings = design.callingIds?.length ?? 0;
  const kit = design.kitIds?.length ?? 0;
  if (callings < MIN_CALLINGS) bad.push("Somebody has to be allowed to go down there. Tick a Calling.");
  if (callings > MAX_CALLINGS) bad.push(`${MAX_CALLINGS} Callings is the most. This one allows ${callings}.`);
  if (kit < MIN_KIT) bad.push(`They take two things off the shelf, so at least ${MIN_KIT} have to be on it.`);
  if (kit > MAX_KIT) bad.push(`${MAX_KIT} things on the shelf is the most. This one has ${kit}.`);

  bad.push(...markProblems(design.rooms));

  design.rooms.forEach((room, i) => {
    const checks = room.options.filter((o) => o.kind === "check");
    const braces = room.options.filter((o) => o.kind === "brace");
    if (!room.title.trim()) bad.push(`Floor ${i + 1} has no name.`);
    if (room.setup.trim().length < 40)
      bad.push(`Floor ${i + 1} needs a sentence or two about what they walk into.`);
    if (checks.length < 2)
      bad.push(`Floor ${i + 1} needs two ways to try it, on different abilities.`);
    // The brace is load-bearing. Without one, a bad build plus a bad die is a
    // wall, and the whole engine exists so that a floor is a price instead.
    if (braces.length < 1)
      bad.push(`Floor ${i + 1} needs one way through that always works and always costs.`);
    if (new Set(checks.map((o) => o.ability)).size !== checks.length)
      bad.push(`Floor ${i + 1} asks the same ability twice, so the choice is not a choice.`);

    /*
     * TWO DOORS ON ONE FLOOR CANNOT SHARE AN ID. The runner resolves a submitted
     * step with find(), so the first match wins: a dungeon published with four
     * doors all called "same" resolved a Brawn check when the player pressed the
     * brace. Room ids may repeat across floors, because resolution is per floor.
     */
    if (new Set(room.options.map((o) => o.id)).size !== room.options.length)
      bad.push(`Floor ${i + 1} has two doors with the same id, so the wrong one will open.`);

    /**
     * AT LEAST ONE BRACE PER FLOOR MUST BE UNGATED.
     *
     * The rule the whole Marks mechanic hangs off. A brace is the promise that
     * every floor has a price rather than a wall, and a gated brace is not a
     * promise: somebody arriving without the lamp meets a floor with two checks
     * they may fail and a door that will not open, which is precisely the dead end
     * the engine exists to prevent. Gate the checks all you like.
     */
    if (braces.length > 0 && !braces.some((o) => !o.needs?.length && !o.forbids?.length))
      bad.push(
        `Floor ${i + 1}: every way through that always works is behind a mark. Leave one open, or somebody arrives here with nothing and finds a wall.`
      );

    for (const o of room.options) {
      const listed = [...(o.needs ?? []), ...(o.forbids ?? []), ...(o.sets ?? [])];
      if (listed.length > MAX_MARKS_PER_OPTION * 3)
        bad.push(`Floor ${i + 1}: "${o.label || "a door"}" is carrying too many marks to read.`);
      for (const m of listed)
        if (!m.trim()) bad.push(`Floor ${i + 1}: "${o.label || "a door"}" has a mark with no name.`);
      // A door that both wants and refuses the same thing never opens.
      for (const m of o.needs ?? [])
        if ((o.forbids ?? []).includes(m))
          bad.push(
            `Floor ${i + 1}: "${o.label || "a door"}" wants "${m}" and refuses it. It will never open.`
          );
    }
    for (const o of room.options) {
      if (!o.label.trim()) bad.push(`Floor ${i + 1} has a door with no name on it.`);
      if (!o.win.trim() || !o.lose.trim())
        bad.push(`Floor ${i + 1}: "${o.label || "a door"}" needs both endings written.`);
    }
  });
  return bad;
}

/**
 * MARKS, checked across the whole dungeon rather than one floor at a time.
 *
 * Everything here needs to see the ORDER of the floors, which is what makes it
 * separate from the per-room loop above. A mark is only ever picked up by clearing
 * a door, so a door on floor two that wants the lamp is a door that never opens
 * unless some door on floor one hands the lamp out. That is not a balance opinion,
 * it is dead content, and the author cannot see it by looking at either floor.
 */
export function markProblems(rooms: readonly RoomDef[]): string[] {
  const bad: string[] = [];

  const read = new Set<string>();
  for (const room of rooms)
    for (const o of room.options) {
      for (const m of o.needs ?? []) read.add(m);
      for (const m of o.forbids ?? []) read.add(m);
    }
  if (read.size > MAX_MARKS_READ)
    bad.push(
      `${read.size} different marks are being tested. ${MAX_MARKS_READ} is the most the solver will take, because every one of them doubles the work of finding par.`
    );

  // What can possibly be in hand by the time you reach each floor.
  const availableBy: Set<string>[] = [];
  const carried = new Set<string>();
  for (const room of rooms) {
    availableBy.push(new Set(carried));
    for (const o of room.options) for (const m of o.sets ?? []) carried.add(m);
  }

  rooms.forEach((room, i) => {
    for (const o of room.options) {
      for (const m of o.needs ?? []) {
        if (!availableBy[i].has(m)) {
          bad.push(
            `Floor ${i + 1}: "${o.label || "a door"}" wants "${m}", and nothing above this floor hands that out. Nobody will ever open it.`
          );
        }
      }
    }
  });

  return bad;
}

/**
 * The full report. Runs the solver, so it is debounced and rate limited by the
 * caller, and skipped entirely when the mechanical hash is unchanged.
 */
export function reportFor(design: Design): Report {
  const instant = instantProblems(design);
  const puzzle = puzzleFrom(design);
  const notes: Note[] = instant.map((text) => ({ severity: "block" as const, text }));

  if (instant.length > 0) {
    return {
      ok: false,
      par: 0,
      builds: 0,
      out: 0,
      // A word, not a dash. This value goes on the wire and onto a browse card,
      // and the project forbids em-dashes in anything a player reads.
      difficulty: "Unrated",
      wallFloor: null,
      notes,
      summary: "Not yet. Fix the blocks above and it will tell you where it stands.",
    };
  }

  const chars = enumerate(puzzle);
  const runs = chars.map((build) => ({ build, result: run(puzzle, build, bestSteps(puzzle, build), design.rooms) }));
  const { par } = parFor(puzzle);
  const finished = runs.filter((r) => r.result.out);
  const share = chars.length > 0 ? finished.length / chars.length : 0;

  /**
   * Where the unfinished runs stop. The author's single most useful sentence, and
   * it used to name the wrong floor.
   *
   * `Result.depth` is ALREADY 1-based: the runner sets `depth = room.index + 1`
   * after resolving a room and before checking whether the Vigour ran out, so it
   * is the floor they were standing in when it did. Adding one to it named the
   * floor after the one that killed them, which is the floor an author would then
   * go and fix. On a run that died at the bottom it named a floor that does not
   * exist: "runs out of Vigour on floor 7" of a six-floor dungeon, which is how
   * this was spotted.
   */
  const stops = new Map<number, number>();
  for (const r of runs) {
    if (r.result.out) continue;
    stops.set(r.result.depth, (stops.get(r.result.depth) ?? 0) + 1);
  }
  const worst = [...stops.entries()].sort((a, b) => b[1] - a[1])[0];
  const wallFloor = worst ? worst[0] : null;

  if (chars.length === 0) {
    notes.push({
      severity: "block",
      text: "Nobody can build a character for this. Allow a Calling and two things off the shelf.",
    });
  } else if (finished.length === 0) {
    notes.push({
      severity: "block",
      text: `Nobody gets out of this one. The best character you allow, playing perfectly, runs out of Vigour on floor ${wallFloor}. Give them more wind to start with, or make one door on floor ${wallFloor} cheaper.`,
      floor: wallFloor ?? undefined,
    });
  } else if (finished.length < 3) {
    notes.push({
      severity: "block",
      text: `Only ${finished.length === 1 ? "one kind of person survives" : `${finished.length} kinds of person survive`} this. That is a lock, not a dungeon.`,
    });
  } else if (share > 0.9) {
    /**
     * A walkover WARNS, it does not block, and there is deliberately no
     * "everybody posts the same number" block above it.
     *
     * The spec called for one, and I wrote it, and it turned out to be
     * unreachable: starting Vigour is BASE plus the Grit modifier, leftover
     * Vigour counts toward the score, and every enumerated character places the
     * array differently, so two builds essentially never finish on the same
     * number. Score diversity is structural rather than something an author can
     * fail at.
     *
     * A check that cannot fire is worse than no check, because it advertises a
     * protection nobody has. So the honest version is this warning: the dungeon
     * publishes, and the card calls it what it is.
     */
    notes.push({
      severity: "warn",
      text: "Nearly everybody gets out of this one. Allowed, and the card will call it a walk.",
    });
  }

  // A mark handed out that nothing ever tests. Legal and free, and nearly always
  // a word spelled two ways.
  const setSomewhere = new Set<string>();
  for (const room of design.rooms)
    for (const o of room.options) for (const m of o.sets ?? []) setSomewhere.add(m);
  const readSomewhere = new Set<string>();
  for (const room of design.rooms)
    for (const o of room.options) {
      for (const m of o.needs ?? []) readSomewhere.add(m);
      for (const m of o.forbids ?? []) readSomewhere.add(m);
    }
  for (const m of setSomewhere) {
    if (!readSomewhere.has(m))
      notes.push({
        severity: "warn",
        text: `"${m}" is handed out and never asked for. No door anywhere reads it, so it changes nothing. Usually that means it is spelled two ways.`,
      });
  }

  // Per-floor shape: is the choice on this floor a real one?
  puzzle.rooms.forEach((room, i) => {
    const taken = new Map<string, number>();
    for (const r of runs) {
      const step = bestSteps(puzzle, r.build)[i];
      if (step) taken.set(step.optionId, (taken.get(step.optionId) ?? 0) + 1);
    }
    const total = [...taken.values()].reduce((a, b) => a + b, 0);
    if (total === 0 || room.options.length < 2) return;

    const [topId, topN] = [...taken.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topN / total > 0.9) {
      const label = room.options.find((o) => o.id === topId)?.label ?? "one door";
      notes.push({
        severity: "warn",
        floor: i + 1,
        text: `Floor ${i + 1}: everybody takes "${label}". The others are furniture.`,
      });
    }
    const dead = room.options.filter((o) => !taken.has(o.id));
    if (dead.length >= 2) {
      notes.push({
        severity: "warn",
        floor: i + 1,
        text: `Floor ${i + 1}: ${dead.length} doors nobody would ever take. That floor is one choice wearing a hat.`,
      });
    }
  });

  if (chars.length > 0 && finished.length > 0 && share < 0.1) {
    notes.push({
      severity: "warn",
      text: "Under a tenth of them get out. Allowed, and the card will say so honestly.",
    });
  }

  // A Calling that everybody who does well shares is a requirement, not a choice,
  // and a player deserves to know that before they build rather than after.
  if (finished.length >= 3) {
    const byCalling = new Map<string, number>();
    for (const r of finished) {
      byCalling.set(r.build.callingId, (byCalling.get(r.build.callingId) ?? 0) + 1);
    }
    const [id, n] = [...byCalling.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / finished.length > 0.8 && puzzle.callings.length > 1) {
      const name = puzzle.callings.find((c) => c.id === id)?.name ?? id;
      notes.push({
        severity: "warn",
        text: `Everybody who does well here is a ${name}. That is not a choice, it is a requirement.`,
      });
    }
  }

  const ok = !notes.some((n) => n.severity === "block");
  if (ok && !notes.some((n) => n.severity === "warn")) {
    notes.push({ severity: "good", text: "Nothing wrong with this one. It is ready when you are." });
  }

  // "Unrated" rather than a dash: this value goes on a browse card, and the
  // project forbids em-dashes in anything a player reads.
  const difficulty = ok
    ? (DIFFICULTY.find(([t]) => share >= t)?.[1] ?? "Barely possible")
    : "Unrated";
  const summary = ok
    ? `Par is ${par}. ${finished.length} of the ${chars.length} characters you allow get out alive.` +
      (wallFloor ? ` Floor ${wallFloor} is where most of the rest stop.` : "") +
      ` This one is ${difficulty}.`
    : "Not yet. Fix the blocks above and it will tell you where it stands.";

  return {
    ok,
    par,
    builds: chars.length,
    out: finished.length,
    difficulty,
    wallFloor,
    notes,
    summary,
  };
}

/**
 * Every distinct character the author's settings allow.
 *
 * Deduped on the only thing that can differ: the ability modifiers this dungeon
 * actually asks about. Two placements that agree on those are the same character,
 * which is why the denominator in the report is an honest count rather than
 * combinatorial theatre.
 */
function enumerate(puzzle: Puzzle): Build[] {
  const asked = new Set<Ability>(["grit"]);
  for (const room of puzzle.rooms) for (const o of room.options) if (o.ability) asked.add(o.ability);
  const relevant = ABILITIES.filter((a) => asked.has(a));

  const kitIds = puzzle.kit.map((k) => k.id);
  const pairs: string[][] = [];
  for (let i = 0; i < kitIds.length; i++) {
    for (let j = i + 1; j < kitIds.length; j++) pairs.push([kitIds[i], kitIds[j]]);
  }

  const out: Build[] = [];
  const seen = new Set<string>();
  for (const calling of puzzle.callings) {
    for (const kit of pairs) {
      for (let rot = 0; rot < puzzle.array.length; rot++) {
        const placement = puzzle.array.map((_, i) => i);
        // Rotate the array over the abilities that matter.
        relevant.forEach((ability, k) => {
          placement[ABILITIES.indexOf(ability)] = (k + rot) % puzzle.array.length;
        });
        const used = new Set(relevant.map((a) => placement[ABILITIES.indexOf(a)]));
        let spare = 0;
        ABILITIES.forEach((a, i) => {
          if (relevant.includes(a)) return;
          while (used.has(spare)) spare++;
          placement[i] = spare;
          used.add(spare);
        });

        const sig = [
          calling.id,
          ...kit,
          ...relevant.map((a) => abilityMod(puzzle.array[placement[ABILITIES.indexOf(a)]])),
        ].join("|");
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push({ callingId: calling.id, placement, kitIds: kit });
      }
    }
  }
  return out;
}

/**
 * The optimal line for one character, memoised across the report.
 *
 * Straight to the solver's own per-build walk. The first version of this called
 * `parFor` with a doctored seed to dodge its cache, which was quietly wrong in
 * the worst way: the seed IS the dice, so it would have returned the best line
 * for a different dungeon and every per-floor warning below would have been
 * about rooms nobody was playing.
 */
const STEP_CACHE = new WeakMap<Puzzle, Map<string, Step[]>>();
function bestSteps(puzzle: Puzzle, build: Build): Step[] {
  let byPuzzle = STEP_CACHE.get(puzzle);
  if (!byPuzzle) {
    byPuzzle = new Map();
    STEP_CACHE.set(puzzle, byPuzzle);
  }
  const key = `${build.callingId}|${build.kitIds.join(",")}|${build.placement.join(",")}`;
  const hit = byPuzzle.get(key);
  if (hit) return hit;
  const steps = bestFor(puzzle, build).steps;
  byPuzzle.set(key, steps);
  return steps;
}

/**
 * What the author has changed that could move par.
 *
 * Prose cannot, so typing prose must never trigger a solve. This is the four
 * lines that remove about ninety percent of the load, because prose is what an
 * author is doing most of the afternoon.
 */
export function mechanicalHash(design: Design): string {
  return JSON.stringify([
    design.baseVigour,
    design.callingIds,
    design.kitIds,
    design.rooms.map((r) => [
      r.id,
      r.band,
      r.boss ?? false,
      r.options.map((o) => [o.kind, o.ability ?? "", o.tn ?? 0, o.vigour ?? 0]),
    ]),
  ]);
}

export type { Design, RoomDef };
export { ceilingFor };
