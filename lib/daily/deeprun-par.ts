/**
 * THE DEEP RUN: par. Server-only, and the actual answer.
 *
 * WHY THIS IS CHEAP, which is the whole reason the game could be designed this
 * way at all.
 *
 * Because every room's die is fixed before you choose, there is no probability
 * anywhere in the problem. Whether an option clears a room depends only on the
 * room, the option, whether you spent your knack on it, and your character. It
 * does NOT depend on how much Vigour you have left, on the path you took, or on
 * anything random. So the outcome of every (room, option, knack) is a constant
 * that can be worked out once per character, and the only thing carried down the
 * dungeon is a number.
 *
 * That turns the search from a tree into a table:
 *
 *   f(room, vigour, knack still in hand) -> the best score from here on
 *
 * which is a couple of hundred states per character instead of eight to the
 * power of six paths. The first version of this walked the tree and called the
 * whole run for every leaf; it did not finish. This is the same answer in
 * milliseconds, and it is exact rather than sampled.
 *
 * The character space collapses too, and for a nice reason: a placement only
 * matters through the ability MODIFIERS the rooms actually ask about. The array
 * usually has repeated numbers and there are only six abilities, so hundreds of
 * distinct placements are literally the same character. Deduping on that
 * signature is what makes enumerating builds affordable.
 */
import { abilityMod } from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";
import { outcomeOf } from "./core";
import {
  BOOST,
  BOSS_BEATEN,
  MEND,
  OUT_ALIVE,
  ROOM_CLEARED,
  VIGOUR_VALUE,
  characterFor,
  dieFor,
  secondDie,
  failCost,
  marksRead,
  openTo,
  startingVigour,
  type Build,
  type Puzzle,
  type PuzzleOption,
  type Step,
} from "./deeprun";
import type { KnackKind } from "./deeprun-data";

/**
 * What one (option, knack) does, worked out once and then just looked up.
 *
 * `sets` rides along because the search has to know what a line leaves you
 * carrying: besides Vigour it is the only thing a later floor can read.
 */
type Move = { step: Step; cleared: boolean; vigour: number; sets: readonly string[] };

/**
 * One door's whole answer, priced.
 *
 * The failure gradient costs the search NOTHING, which is worth stating plainly
 * because it is the reason grading was affordable at all: the die is thrown
 * before anybody chooses, so `total - tn` is a constant per (door, character),
 * and the band is therefore as knowable up front as `cleared` always was. No new
 * dimension, no wider memo table, and the solve stays exact rather than sampled.
 *
 * What DOES ride along is `ruinSets`: a ruin leaves marks, marks are read by
 * later doors, and the search already carries the held set for that reason.
 */
function priced(
  option: PuzzleOption,
  face: number,
  total: number,
  step: Step
): Move {
  const band = outcomeOf(face, total, option.tn ?? 99);
  const cleared = band === "cleared";
  return {
    step,
    cleared,
    vigour: cleared ? 0 : -failCost(option, band),
    sets: cleared ? option.sets : band === "ruin" ? option.ruinSets : [],
  };
}

function movesFor(
  puzzle: Puzzle,
  build: Build,
  roomIndex: number,
  knackAvailable: boolean,
  held: ReadonlySet<string>
): Move[] {
  const who = characterFor(puzzle, build);
  const room = puzzle.rooms[roomIndex];
  const die = dieFor(puzzle.seed, roomIndex);
  const moves: Move[] = [];

  const bonusFor = (ability: Ability): number => {
    let total = abilityMod(who.scores[ability]);
    if (who.affinities.includes(ability)) total += 2;
    for (const b of who.bonuses) if (b.ability === ability) total += b.value;
    return total;
  };

  const plain = (option: PuzzleOption): Move => {
    if (option.kind === "brace")
      return {
        step: { optionId: option.id },
        cleared: true,
        vigour: -option.vigour,
        sets: option.sets,
      };
    const ability = option.ability ?? "grit";
    // Failing costs more than bracing on purpose, and failing badly costs more
    // again. See `outcomeOf`: if this line and the runner ever disagree, par
    // describes a different game to the one being played.
    return priced(option, die, die + bonusFor(ability), { optionId: option.id });
  };

  for (const option of room.options) {
    // A door that is shut to them is not a move. The same predicate the runner
    // uses, or the solver prices a line nobody can play.
    if (!openTo(option, held)) continue;
    moves.push(plain(option));
    if (!knackAvailable) continue;
    const withKnack = knackMove(puzzle, who.knack, option, die, bonusFor, roomIndex);
    if (withKnack) moves.push(withKnack);
  }
  return moves;
}

function knackMove(
  puzzle: Puzzle,
  kind: KnackKind,
  option: PuzzleOption,
  die: number,
  bonusFor: (a: Ability) => number,
  roomIndex: number
): Move | null {
  const step: Step = { optionId: option.id, knack: true };
  const sets = option.sets;
  switch (kind) {
    case "pass":
      return { step, cleared: true, vigour: 0, sets };
    case "mend":
      return { step, cleared: true, vigour: MEND, sets };
    case "slip":
      // Not cleared. That is the trade, and it is why the Knife is a gamble
      // rather than a strictly better Warden. Nothing is picked up either,
      // because you were never in the room.
      return { step, cleared: false, vigour: 0, sets: [] };
    case "boost": {
      if (option.kind !== "check") return null;
      const ability = option.ability ?? "grit";
      return priced(option, die, die + bonusFor(ability) + BOOST, step);
    }
    case "rethrow": {
      if (option.kind !== "check") return null;
      const again = secondDie(puzzle.seed, roomIndex);
      const ability = option.ability ?? "grit";
      return priced(option, again, again + bonusFor(ability), step);
    }
  }
}

/**
 * The best line for one fixed character.
 *
 * Memoised on (room, vigour, knack, what you are carrying), which is the entire
 * state: nothing else from the path can change what happens next.
 *
 * MARKS ARE WHY THE FOURTH TERM EXISTS, and they are the only thing that has ever
 * widened this table. Three economies keep it honest:
 *
 *   * Only marks that some door READS go in the key. A mark nothing tests is
 *     flavour, and flavour does not branch a search. Most dungeons read none, and
 *     then the key is what it always was plus one empty string.
 *   * Only marks some door BELOW YOU still reads go in the key. Carrying "wet"
 *     into the last floor is not a distinct state if nothing down there asks
 *     about water, so those states collapse into one. The saving is largest
 *     exactly where the table is widest, because the deep floors are the ones you
 *     arrive at holding the most. This was added when the house pool started
 *     using marks and a cold solve went from about a third of a second to nearly
 *     two, which was enough to time two unrelated tests out.
 *   * A mark is never taken back, so the state is monotone: what is reachable at
 *     floor n is only ever a superset of what you had at floor n-1.
 *
 * The gate caps how many distinct marks a dungeon may read for exactly this
 * reason. That cap is the difference between a table and a tree.
 */
export function bestFor(puzzle: Puzzle, build: Build): { score: number; steps: Step[] } {
  const memo = new Map<string, { score: number; steps: Step[] }>();

  /**
   * What still matters, floor by floor: the marks read by this room or any room
   * under it, built once from the bottom up.
   *
   * Sound because a mark can only ever change what happens through `openTo`, and
   * `openTo` is only ever asked about doors on this floor or below. Two runs
   * holding different marks that nothing below tests will play the rest of the
   * dungeon identically, so they are the same state and must share a memo entry.
   */
  const readBelow: Set<string>[] = new Array(puzzle.rooms.length + 1);
  readBelow[puzzle.rooms.length] = new Set();
  for (let i = puzzle.rooms.length - 1; i >= 0; i--) {
    const here = marksRead([puzzle.rooms[i]]);
    readBelow[i] = here.size === 0 ? readBelow[i + 1] : new Set([...readBelow[i + 1], ...here]);
  }

  /** Only the part of what you are carrying that a door from here down can test. */
  const stateOf = (held: ReadonlySet<string>, roomIndex: number): string => {
    const read = readBelow[Math.min(roomIndex, puzzle.rooms.length)];
    if (read.size === 0 || held.size === 0) return "";
    const relevant: string[] = [];
    for (const m of read) if (held.has(m)) relevant.push(m);
    return relevant.sort().join(",");
  };

  const walk = (
    roomIndex: number,
    vigour: number,
    knack: boolean,
    held: ReadonlySet<string>
  ): { score: number; steps: Step[] } => {
    if (vigour <= 0) return { score: 0, steps: [] };
    if (roomIndex >= puzzle.rooms.length)
      return { score: OUT_ALIVE + vigour * VIGOUR_VALUE, steps: [] };

    const key = `${roomIndex}:${vigour}:${knack ? 1 : 0}:${stateOf(held, roomIndex)}`;
    const hit = memo.get(key);
    if (hit) return hit;

    const boss = puzzle.rooms[roomIndex].boss;
    // Walking away is always available: a submission that simply stops here.
    let best: { score: number; steps: Step[] } = { score: 0, steps: [] };

    for (const move of movesFor(puzzle, build, roomIndex, knack, held)) {
      const gain = move.cleared ? ROOM_CLEARED + (boss ? BOSS_BEATEN : 0) : 0;
      const after = vigour + move.vigour;
      /**
       * What the line leaves on you. `priced` has already decided WHICH marks
       * apply: a win leaves `sets`, a ruin leaves `ruinSets`, and everything in
       * between leaves nothing. Gating this on `move.cleared` again, as it used
       * to, would silently drop every ruin mark and let par plan a line the
       * runner would not let anybody play.
       */
      const carrying = move.sets.length > 0 ? new Set([...held, ...move.sets]) : held;
      const rest =
        after <= 0
          ? { score: 0, steps: [] }
          : walk(roomIndex + 1, after, knack && !move.step.knack, carrying);
      const total = gain + rest.score;
      if (total > best.score) best = { score: total, steps: [move.step, ...rest.steps] };
    }

    memo.set(key, best);
    return best;
  };

  return walk(0, startingVigour(characterFor(puzzle, build), puzzle.baseVigour), true, new Set());
}

const PAR_CACHE = new Map<string, { par: number; best: { build: Build; steps: Step[] } | null }>();

/**
 * Everything about a dungeon that can change its par, and nothing else.
 *
 * The cache used to be keyed on the seed alone, which was correct for exactly as
 * long as the only dungeon was the daily: there the seed is the date and the date
 * decides every room. An authored dungeon's seed is its CODE, which stays put
 * while the author moves the numbers around, so the desk solved a draft once and
 * then showed that same par for the rest of the process's life. Tune a floor,
 * watch nothing happen.
 *
 * Prose is deliberately absent. Rewriting what a door SAYS must not throw away a
 * solve, because that is what an author does most of.
 */
function mechanicalKey(puzzle: Puzzle): string {
  return [
    puzzle.seed,
    puzzle.baseVigour,
    puzzle.array.join(","),
    puzzle.callings.map((c) => c.id).join(","),
    puzzle.kit.map((k) => k.id).join(","),
    puzzle.rooms
      .map(
        (r) =>
          `${r.id}${r.boss ? "!" : ""}:` +
          r.options
            .map(
              (o) =>
                `${o.id}/${o.kind}/${o.ability ?? "-"}/${o.tn ?? "-"}/${o.vigour}` +
                `/${o.needs.join("&")}/${o.forbids.join("&")}/${o.sets.join("&")}/${o.ruinSets.join("&")}`
            )
            .join("+")
      )
      .join(";"),
  ].join("|");
}

export function parFor(puzzle: Puzzle): {
  par: number;
  best: { build: Build; steps: Step[] } | null;
} {
  const key = mechanicalKey(puzzle);
  const cached = PAR_CACHE.get(key);
  if (cached) return cached;

  // Which abilities does tonight actually ask about? Grit always counts, because
  // it buys starting Vigour. Everything else is padding, and two placements that
  // agree on the ones that matter are the same character.
  const asked = new Set<Ability>(["grit"]);
  for (const room of puzzle.rooms) {
    for (const o of room.options) if (o.ability) asked.add(o.ability);
  }
  const relevant = ABILITIES.filter((a) => asked.has(a));

  const kitPairs: string[][] = [];
  for (let i = 0; i < puzzle.kit.length; i++) {
    for (let j = i + 1; j < puzzle.kit.length; j++) {
      kitPairs.push([puzzle.kit[i].id, puzzle.kit[j].id]);
    }
  }

  let par = 0;
  let best: { build: Build; steps: Step[] } | null = null;
  const seen = new Set<string>();

  for (const calling of puzzle.callings) {
    for (const kitIds of kitPairs) {
      for (const assignment of arrangements(puzzle.array.length, relevant.length)) {
        const placement = placementFrom(relevant, assignment, puzzle.array.length);
        const build: Build = { callingId: calling.id, placement, kitIds };
        // Dedupe on the only thing that can differ: the modifiers the dungeon
        // asks about. Hundreds of placements collapse to one character here.
        const signature = [
          calling.id,
          ...kitIds,
          ...relevant.map((a) => abilityMod(puzzle.array[placement[ABILITIES.indexOf(a)]])),
        ].join("|");
        if (seen.has(signature)) continue;
        seen.add(signature);

        const attempt = bestFor(puzzle, build);
        if (attempt.score > par) {
          par = attempt.score;
          best = { build, steps: attempt.steps };
        }
      }
    }
  }

  const answer = { par, best };
  /*
   * ponytail: a cold solve is 0.4s to 1.7s per day, up from roughly a third of
   * that before any room used marks, because the memo key gained a subset of the
   * four marks doors test. It is paid once per dungeon and only on the finish
   * path, never on the way in, so it is a one-off on the first person to come
   * back up that day. If a fifth mark is ever wanted, prune the key to marks that
   * some door BELOW the current floor still tests, which collapses most of the
   * subsets on the deep floors where the table is widest.
   */
  // ponytail: a draft solves once per edit, so the key space is now unbounded
  // rather than one entry per day. Drop the lot when it gets silly; a real LRU
  // when a cold solve on a busy instance shows up in a trace.
  if (PAR_CACHE.size > 500) PAR_CACHE.clear();
  PAR_CACHE.set(key, answer);
  return answer;
}

/** Every ordered selection of `take` distinct indices out of `size`. */
function* arrangements(size: number, take: number): Generator<number[]> {
  const out: number[] = [];
  const used = new Array(size).fill(false);
  function* walk(): Generator<number[]> {
    if (out.length === take) {
      yield [...out];
      return;
    }
    for (let i = 0; i < size; i++) {
      if (used[i]) continue;
      used[i] = true;
      out.push(i);
      yield* walk();
      out.pop();
      used[i] = false;
    }
  }
  yield* walk();
}

function placementFrom(relevant: Ability[], assignment: number[], size: number): number[] {
  const placement = new Array<number>(size).fill(-1);
  const taken = new Set(assignment);
  relevant.forEach((ability, i) => {
    placement[ABILITIES.indexOf(ability)] = assignment[i];
  });
  let spare = 0;
  for (let i = 0; i < placement.length; i++) {
    if (placement[i] !== -1) continue;
    while (taken.has(spare)) spare++;
    placement[i] = spare;
    taken.add(spare);
  }
  return placement;
}
