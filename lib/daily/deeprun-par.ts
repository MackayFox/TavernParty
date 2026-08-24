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
import { clears } from "./core";
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
  startingVigour,
  type Build,
  type Puzzle,
  type PuzzleOption,
  type Step,
} from "./deeprun";
import type { KnackKind } from "./deeprun-data";

/** What one (option, knack) does, worked out once and then just looked up. */
type Move = { step: Step; cleared: boolean; vigour: number };

function movesFor(
  puzzle: Puzzle,
  build: Build,
  roomIndex: number,
  knackAvailable: boolean
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
      return { step: { optionId: option.id }, cleared: true, vigour: -option.vigour };
    const ability = option.ability ?? "grit";
    const total = die + bonusFor(ability);
    const cleared = clears(die, total, option.tn ?? 99);
    return { step: { optionId: option.id }, cleared, vigour: cleared ? 0 : -option.vigour };
  };

  for (const option of room.options) {
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
  switch (kind) {
    case "pass":
      return { step, cleared: true, vigour: 0 };
    case "mend":
      return { step, cleared: true, vigour: MEND };
    case "slip":
      // Not cleared. That is the trade, and it is why the Knife is a gamble
      // rather than a strictly better Warden.
      return { step, cleared: false, vigour: 0 };
    case "boost": {
      if (option.kind !== "check") return null;
      const ability = option.ability ?? "grit";
      const total = die + bonusFor(ability) + BOOST;
      const cleared = clears(die, total, option.tn ?? 99);
      return { step, cleared, vigour: cleared ? 0 : -option.vigour };
    }
    case "rethrow": {
      if (option.kind !== "check") return null;
      const again = secondDie(puzzle.seed, roomIndex);
      const ability = option.ability ?? "grit";
      const total = again + bonusFor(ability);
      const cleared = clears(again, total, option.tn ?? 99);
      return { step, cleared, vigour: cleared ? 0 : -option.vigour };
    }
  }
}

/**
 * The best line for one fixed character.
 *
 * Memoised on (room, vigour, knack), which is the entire state: nothing else
 * from the path can change what happens next.
 */
export function bestFor(puzzle: Puzzle, build: Build): { score: number; steps: Step[] } {
  const memo = new Map<string, { score: number; steps: Step[] }>();

  const walk = (roomIndex: number, vigour: number, knack: boolean): { score: number; steps: Step[] } => {
    if (vigour <= 0) return { score: 0, steps: [] };
    if (roomIndex >= puzzle.rooms.length)
      return { score: OUT_ALIVE + vigour * VIGOUR_VALUE, steps: [] };

    const key = `${roomIndex}:${vigour}:${knack ? 1 : 0}`;
    const hit = memo.get(key);
    if (hit) return hit;

    const boss = puzzle.rooms[roomIndex].boss;
    // Walking away is always available: a submission that simply stops here.
    let best: { score: number; steps: Step[] } = { score: 0, steps: [] };

    for (const move of movesFor(puzzle, build, roomIndex, knack)) {
      const gain = move.cleared ? ROOM_CLEARED + (boss ? BOSS_BEATEN : 0) : 0;
      const after = vigour + move.vigour;
      const rest =
        after <= 0
          ? { score: 0, steps: [] }
          : walk(roomIndex + 1, after, knack && !move.step.knack);
      const total = gain + rest.score;
      if (total > best.score) best = { score: total, steps: [move.step, ...rest.steps] };
    }

    memo.set(key, best);
    return best;
  };

  return walk(0, startingVigour(characterFor(puzzle, build)), true);
}

const PAR_CACHE = new Map<string, { par: number; best: { build: Build; steps: Step[] } | null }>();

export function parFor(puzzle: Puzzle): {
  par: number;
  best: { build: Build; steps: Step[] } | null;
} {
  const cached = PAR_CACHE.get(puzzle.seed);
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
  PAR_CACHE.set(puzzle.seed, answer);
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
