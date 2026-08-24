/**
 * THE LEDGER — five drinkers, five debts, four true statements.
 *
 * SERVER ONLY: it holds the solution, so no client component imports it. The
 * client is given the names, the five amounts and the four statements, and
 * nothing else. Every check and the final answer are settled in the route.
 *
 * A five by five grid solved by constraint propagation (GAME_DESIGN §7.3). The
 * generator works backwards from a solution: build every statement that happens
 * to be true of it, then take statements in a seeded order, keeping only the
 * ones that actually rule something out, until exactly one of the 120 possible
 * ledgers survives. If that took fewer than four statements the set is padded
 * with more true ones, which is what a real ledger looks like anyway: some of
 * what you are told is confirmation rather than news.
 *
 * Uniqueness is not asserted, it is measured. Every candidate set is tested
 * against all 120 permutations before it is accepted, so "exactly one solution"
 * is a checked property of every puzzle this file has ever produced.
 */
import { seededPick, seededRng, seededShuffle } from "./core";

export const PEOPLE = 5;
export const CLUES = 4;
/** Three checks, each one costing a mark. Four marks is a clean ledger. */
export const MAX_CHECKS = 3;
export const MAX_SCORE = MAX_CHECKS + 1;

/**
 * Sixteen names, short enough to head a column on a phone. Regulars rather than
 * heroes: nobody here has a title and nobody here is from anywhere in
 * particular.
 */
const NAMES = [
  "Maud",
  "Ivo",
  "Tace",
  "Dob",
  "Wen",
  "Orma",
  "Sull",
  "Rell",
  "Hask",
  "Purl",
  "Gam",
  "Sef",
  "Tolly",
  "Crib",
  "Nan",
  "Brack",
] as const;

/**
 * Debts in shillings. Mixed parities and irregular gaps, so the odd-and-even
 * statement is worth something and the difference statements are not all the
 * same number.
 */
const AMOUNTS = [
  2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 23, 24, 26, 27, 29,
] as const;

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

/**
 * A statement is a predicate over a candidate ledger plus the sentence a player
 * reads. Only the sentence ever leaves the server.
 */
type Clue = {
  /** Kept so the generator can ration the strongest kind. */
  kind: "more" | "diff" | "sum" | "exact" | "not" | "most" | "least" | "parity" | "between";
  text: string;
  holds: (perm: readonly number[]) => boolean;
};

/** Every ordering of five things. 120 of them, built once. */
const PERMS: number[][] = (() => {
  const out: number[][] = [];
  const walk = (left: number[], acc: number[]) => {
    if (left.length === 0) {
      out.push([...acc]);
      return;
    }
    for (let i = 0; i < left.length; i++) {
      acc.push(left[i]);
      walk([...left.slice(0, i), ...left.slice(i + 1)], acc);
      acc.pop();
    }
  };
  walk([0, 1, 2, 3, 4], []);
  return out;
})();

const shillings = (n: number) => `${n}s`;

/**
 * Every statement that is true of `sol`. The generator picks four of these, so
 * every statement a player is shown is true by construction: there is no
 * "which of these is lying" mechanic here and no room for one to slip in.
 */
function candidatesFor(
  names: readonly string[],
  amounts: readonly number[],
  sol: readonly number[]
): Clue[] {
  const owed = (perm: readonly number[], i: number) => amounts[perm[i]];
  const value = (i: number) => amounts[sol[i]];
  const out: Clue[] = [];

  for (let i = 0; i < PEOPLE; i++) {
    for (let j = 0; j < PEOPLE; j++) {
      if (i === j) continue;
      if (value(i) > value(j)) {
        out.push({
          kind: "more",
          text: `${names[i]} owes more than ${names[j]}.`,
          holds: (p) => owed(p, i) > owed(p, j),
        });
        const gap = value(i) - value(j);
        out.push({
          kind: "diff",
          text: `${names[i]} owes ${shillings(gap)} more than ${names[j]}.`,
          holds: (p) => owed(p, i) - owed(p, j) === gap,
        });
      }
      if (i < j) {
        const total = value(i) + value(j);
        out.push({
          kind: "sum",
          text: `${names[i]} and ${names[j]} owe ${shillings(total)} between them.`,
          holds: (p) => owed(p, i) + owed(p, j) === total,
        });
      }
    }

    const mine = value(i);
    out.push({
      kind: "exact",
      text: `${names[i]} owes ${shillings(mine)} exactly.`,
      holds: (p) => owed(p, i) === mine,
    });
    for (const amount of amounts) {
      if (amount === mine) continue;
      out.push({
        kind: "not",
        text: `${names[i]} does not owe ${shillings(amount)}.`,
        holds: (p) => owed(p, i) !== amount,
      });
    }
    out.push({
      kind: "parity",
      text: `${names[i]} owes an ${mine % 2 === 0 ? "even" : "odd"} number of shillings.`,
      holds: (p) => owed(p, i) % 2 === mine % 2,
    });

    const highest = Math.max(...amounts);
    const lowest = Math.min(...amounts);
    if (mine === highest) {
      out.push({
        kind: "most",
        text: `Nobody at the table owes more than ${names[i]}.`,
        holds: (p) => owed(p, i) === highest,
      });
    }
    if (mine === lowest) {
      out.push({
        kind: "least",
        text: `${names[i]} owes the least of the five.`,
        holds: (p) => owed(p, i) === lowest,
      });
    }

    // "More than one, less than another": the workhorse of a grid puzzle.
    for (let low = 0; low < PEOPLE; low++) {
      for (let high = 0; high < PEOPLE; high++) {
        if (low === high || low === i || high === i) continue;
        if (value(low) < mine && mine < value(high)) {
          out.push({
            kind: "between",
            text: `${names[i]} owes more than ${names[low]} and less than ${names[high]}.`,
            holds: (p) => owed(p, low) < owed(p, i) && owed(p, i) < owed(p, high),
          });
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// The puzzle
// ---------------------------------------------------------------------------

export type Puzzle = {
  date: string;
  /** Column heads, in the order they are shown. */
  names: string[];
  /** The five debts, ascending. Every one is owed by exactly one person. */
  amounts: number[];
  /** Four sentences, all of them true. */
  clues: string[];
};

/**
 * Never leaves the server. `solution[i]` is the amount index person `i` owes,
 * and `clueSet` keeps the predicates so uniqueness stays a measurable property
 * after the fact rather than a claim in a comment.
 */
type Solved = Puzzle & { solution: number[]; clueSet: Clue[] };

const CACHE = new Map<string, Solved>();

function build(date: string): Solved {
  const rand = seededRng("ledger", date);
  const names = seededPick(NAMES, PEOPLE, rand);
  const amounts = seededPick(AMOUNTS, PEOPLE, rand).sort((a, b) => a - b);
  const solution = seededShuffle([0, 1, 2, 3, 4], rand);
  const pool = candidatesFor(names, amounts, solution);

  /**
   * At most one "owes exactly" per puzzle. Two of them and the grid falls over
   * without anybody having to think, which is a puzzle that was never set.
   */
  const EXACT_LIMIT = 1;

  /**
   * Two passes, and the first one is about how it reads rather than whether it
   * works.
   *
   * The greedy loop only ever keeps a statement that rules something out, so a
   * set that reaches one answer in exactly four statements has four statements
   * that all earn their place. Padding a shorter set up to four also produces a
   * correct puzzle, but the padding is by definition redundant, and a review of
   * the output found it reading like being told the same thing twice with two
   * different names in it. So exactly-four is tried four hundred ways first, and
   * padding is the fallback rather than the plan.
   */
  const attempt = (padding: boolean): Solved | null => {
    const order = seededShuffle(pool, rand);
    let survivors = PERMS;
    const chosen: Clue[] = [];
    let exacts = 0;

    for (const clue of order) {
      if (chosen.length >= CLUES || survivors.length === 1) break;
      if (clue.kind === "exact" && exacts >= EXACT_LIMIT) continue;
      const next = survivors.filter(clue.holds);
      if (next.length === survivors.length) continue; // tells you nothing new
      chosen.push(clue);
      survivors = next;
      if (clue.kind === "exact") exacts++;
    }

    if (survivors.length !== 1) return null;
    if (!padding && chosen.length !== CLUES) return null;

    for (const clue of order) {
      if (chosen.length >= CLUES) break;
      if (chosen.includes(clue)) continue;
      if (clue.kind === "exact" && exacts >= EXACT_LIMIT) continue;
      chosen.push(clue);
      if (clue.kind === "exact") exacts++;
    }
    if (chosen.length !== CLUES) return null;

    return { date, names, amounts, clues: chosen.map((c) => c.text), solution, clueSet: chosen };
  };

  for (let i = 0; i < 400; i++) {
    const found = attempt(false);
    if (found) return found;
  }
  for (let i = 0; i < 100; i++) {
    const found = attempt(true);
    if (found) return found;
  }

  /**
   * Unreachable in practice, and deterministic when it is not: four exact
   * statements pin four debts and the fifth is whatever is left. A dull puzzle
   * is a better failure than a puzzle with two answers.
   */
  const fallback = candidatesFor(names, amounts, solution)
    .filter((c) => c.kind === "exact")
    .slice(0, CLUES);
  return {
    date,
    names,
    amounts,
    clues: fallback.map((c) => c.text),
    solution,
    clueSet: fallback,
  };
}

function solved(date: string): Solved {
  const cached = CACHE.get(date);
  if (cached) return cached;
  const built = build(date);
  CACHE.set(date, built);
  return built;
}

/** What the client is allowed to see. Nothing that resolves the answer. */
export function puzzleFor(date: string): Puzzle {
  const { date: d, names, amounts, clues } = solved(date);
  return { date: d, names, amounts, clues };
}

/**
 * How many of the 120 possible ledgers satisfy today's four statements. One, or
 * the puzzle should never have been published. Exported so a test can hold the
 * generator to it rather than taking its word.
 */
export function solutionCount(date: string): number {
  const { clueSet } = solved(date);
  return PERMS.filter((perm) => clueSet.every((clue) => clue.holds(perm))).length;
}

/** Exactly five distinct amount indexes. */
export function validAssignment(assignment: readonly number[]): boolean {
  return (
    assignment.length === PEOPLE &&
    assignment.every((a) => Number.isInteger(a) && a >= 0 && a < PEOPLE) &&
    new Set(assignment).size === PEOPLE
  );
}

/** How many rows are right. Told on a check, and never which ones. */
export function rowsCorrect(date: string, assignment: readonly number[]): number {
  const { solution } = solved(date);
  return assignment.reduce((n, a, i) => n + (a === solution[i] ? 1 : 0), 0);
}

export function isSolved(date: string, assignment: readonly number[]): boolean {
  return rowsCorrect(date, assignment) === PEOPLE;
}

/** The truth, for the result screen only. */
export function solutionFor(date: string): number[] {
  return [...solved(date).solution];
}

/**
 * Four marks for a ledger closed without a single check, one for a ledger that
 * needed all three, and nothing for a ledger that was wrong. Higher is better,
 * like every other score in the network.
 */
export function scoreFor(correct: boolean, checksUsed: number): number {
  if (!correct) return 0;
  return MAX_SCORE - Math.max(0, Math.min(MAX_CHECKS, Math.floor(checksUsed)));
}

export function shareText(date: string, correct: boolean, checksUsed: number): string {
  const used = Math.max(0, Math.min(MAX_CHECKS, checksUsed));
  const marks = "▪".repeat(MAX_SCORE - used) + "▫".repeat(used);
  const verdict = !correct
    ? "did not balance"
    : used === 0
      ? "balanced first time, no checks"
      : `balanced on ${used === 1 ? "one check" : `${used} checks`}`;
  return [
    `THE LEDGER ${date}`,
    verdict,
    correct ? marks : "▫▫▫▫",
    "tavernparty.co.uk/daily/ledger",
  ].join("\n");
}
