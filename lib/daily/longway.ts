/**
 * THE LONG WAY DOWN — today's five Acts, played solo, against the real engine.
 *
 * SERVER ONLY. This module can compute par, so it must never be imported by a
 * client component. The route hands out the puzzle and takes back choices; the
 * arithmetic all happens here.
 *
 * The whole night is pinned from the date: the character, the five scenes and
 * the five d20 faces. The faces are published up front, which is the design.
 * In the multiplayer game the die is the unknown and the Reckless target number
 * is bought with a Torch; here there is nobody to buy information from and
 * nobody to take the door away from you, so both are simply shown, and what is
 * left is a real decision with no dice in it: five known rolls, fifteen doors,
 * two Hook tokens, and a Dread meter that doubles every cost once it reaches
 * three. Somebody who reads it properly hits par. That is the game.
 *
 * Two things from the live run are deliberately left out.
 *
 * The Night does not turn (GAME_DESIGN §5.8): swapping the fifth scene for a
 * worse one depending on your own Dread would mean the published deck was a
 * lie, and a puzzle whose last question changes shape while you are answering
 * it is not a puzzle.
 *
 * There are no Scars to keep or hide, because a kept Scar only pays against the
 * table median at the Ballad and solo there is no table. Both are ceilings, not
 * oversights: `ponytail:` if the daily ever grows a Ballad, both come back.
 */
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES, SCENES_BY_ID } from "@/lib/content/scenes";
import { buildDeck } from "@/lib/game/deck";
import { d20, rollScore } from "@/lib/game/random";
import { costMultiplier, ledgerFor, sumLedger } from "@/lib/game/resolve";
import {
  ARRAY_DICE,
  ARRAY_DROP,
  ARRAY_SIZE,
  DREAD_DOUBLE_AT,
  DREAD_MAX,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKENS_MAX,
  HOOK_TOKEN_VALUE,
  MARK_BONUS,
  MARK_FLINCH_PENALTY,
} from "@/lib/game/rules";
import { ABILITIES, type Ability, type Modifier, type Player, type Scores } from "@/lib/game/types";
import { clears, parPhrase, seededRng } from "./core";
import { siteUrl } from "../site";

/** Five, as in the live run. */
export const ACTS = 5;

/** The deadline default, and a real move here as much as at a table. */
export const FLINCH = "flinch";

// ---------------------------------------------------------------------------
// The night, pinned from the date
// ---------------------------------------------------------------------------

export type Door = {
  id: string;
  label: string;
  ability: Ability;
  tn: number;
  deed: number;
  cost: { renown: number; dread: number };
  reckless: boolean;
};

export type ActCard = {
  index: number;
  sceneId: string;
  title: string;
  setup: string;
  tags: string[];
  /** This scene calls your Hook against you, so it pays to take it. */
  marked: boolean;
  /** The face you are going to roll. Known in advance. That is the point. */
  face: number;
  doors: Door[];
};

export type Puzzle = {
  date: string;
  /** Everything about the character, ready to print on the sheet. */
  who: {
    callingId: string;
    callingName: string;
    affinities: [Ability, Ability];
    failingTag: string;
    failingText: string;
    kitId: string;
    kitName: string;
    kitBlurb: string;
    /**
     * Sent because the page shows the player what a door would reach before they
     * commit to it, and that sum has to be the server's sum. A preview that
     * quietly forgets the +2 on the rope is worse than no preview.
     */
    kitBonus: { ability: Ability; value: number } | null;
    hookId: string;
    hookName: string;
    hookBlurb: string;
    callTag: string;
    scores: Scores;
  };
  acts: ActCard[];
  hookTokens: number;
};

export type Choice = { doorId: string; spend: number };

/** Placing the array: the two best numbers go where the Calling is trained. */
function placeArray(array: readonly number[], affinities: readonly Ability[]): Scores {
  const sorted = [...array].sort((a, b) => b - a);
  const rest = ABILITIES.filter((a) => !affinities.includes(a));
  const order = [...affinities, ...rest] as Ability[];
  const scores = {} as Scores;
  order.forEach((ability, i) => {
    scores[ability] = sorted[i] ?? 10;
  });
  return scores;
}

/**
 * A player object the engine's own ledger can read. Not a room, not a store,
 * just the shape `ledgerFor` needs, so the daily narrates through exactly the
 * same code path as a live Act.
 */
function soloPlayer(scores: Scores, hookTokens: number): Player {
  return {
    id: "solo",
    name: "You",
    isHost: true,
    isBot: false,
    connected: true,
    disconnectedAt: null,
    lastSeenAt: 0,
    callingId: null,
    bloodId: null,
    kitIds: [],
    hookId: null,
    scores,
    renown: 0,
    hookTokens,
    scars: [],
    torches: 0,
    rerolls: 0,
    usedSignature: false,
    usedBloodPower: false,
    laurelFor: null,
    stats: {
      actsTaken: 0,
      recklessTaken: 0,
      flinches: 0,
      scarsKept: 0,
      scarsHidden: 0,
      crits: 0,
    },
  };
}

/**
 * Puzzles and pars are cached per date. Both are pure functions of the date, and
 * the par search is a hundred thousand leaves, which is fine once a day and
 * wasteful on every keystroke of every player.
 *
 * ponytail: a plain Map, so it is per instance and unbounded. It holds a handful
 * of small objects per date played, which on a daily puzzle is a rounding error;
 * if the archive ever gets crawled hard, cap it with an LRU.
 */
const PUZZLES = new Map<string, Puzzle>();
const PARS = new Map<string, { par: number; line: Choice[] }>();

export function puzzleFor(date: string): Puzzle {
  const cached = PUZZLES.get(date);
  if (cached) return cached;
  const built = buildPuzzle(date);
  PUZZLES.set(date, built);
  return built;
}

function buildPuzzle(date: string): Puzzle {
  const rand = seededRng("longway", date);

  const array = Array.from({ length: ARRAY_SIZE }, () => rollScore(ARRAY_DICE, ARRAY_DROP, rand));
  const calling = CALLINGS[Math.floor(rand() * CALLINGS.length)];
  const kit = KIT[Math.floor(rand() * KIT.length)];
  const hook = HOOKS[Math.floor(rand() * HOOKS.length)];
  const scores = placeArray(array, calling.affinities);

  const deck = buildDeck({ scenes: SCENES, hooks: [hook], acts: ACTS }, rand);
  const faces = Array.from({ length: ACTS }, () => d20(rand));

  const acts: ActCard[] = deck.map((sceneId, i) => {
    const scene = SCENES_BY_ID[sceneId];
    return {
      index: i + 1,
      sceneId,
      title: scene.title,
      setup: scene.setup,
      tags: scene.tags,
      marked: scene.tags.includes(hook.callTag),
      face: faces[i],
      doors: scene.approaches.map((a) => ({
        id: a.id,
        label: a.label,
        ability: a.ability,
        tn: a.tn,
        deed: a.deed,
        cost: a.cost,
        reckless: a.reckless,
      })),
    };
  });

  return {
    date,
    who: {
      callingId: calling.id,
      callingName: calling.name,
      affinities: calling.affinities,
      failingTag: calling.failing.tag,
      failingText: calling.failing.text,
      kitId: kit.id,
      kitName: kit.name,
      kitBlurb: kit.blurb,
      kitBonus: kit.bonus,
      hookId: hook.id,
      hookName: hook.name,
      hookBlurb: hook.blurb,
      callTag: hook.callTag,
      scores,
    },
    acts,
    hookTokens: HOOK_TOKENS_MAX,
  };
}

// ---------------------------------------------------------------------------
// Playing it out
// ---------------------------------------------------------------------------

export type ActLedger = {
  index: number;
  sceneId: string;
  doorId: string;
  doorLabel: string;
  /** Every named contribution, in the order it should be read out. */
  mods: Modifier[];
  total: number;
  tn: number;
  success: boolean;
  /** In the fiction. The engine's own win/lose line for that door. */
  line: string;
  renownDelta: number;
  dreadDelta: number;
  renownAfter: number;
  dreadAfter: number;
  tokensAfter: number;
  /** Your Hook was called against you, so the tokens came back. */
  hookRefilled: boolean;
  /** Everything doubles at three. Where the regret lives. */
  costDoubled: boolean;
};

export type Run = { ledgers: ActLedger[]; renown: number; dread: number; tokens: number };

type State = { renown: number; dread: number; tokens: number };

/** Resolved once per run rather than once per Act, because par walks it 100,000 times. */
type Kit = ReturnType<typeof kitFor>;
function kitFor(puzzle: Puzzle) {
  return {
    calling: CALLINGS.find((c) => c.id === puzzle.who.callingId),
    kit: KIT.filter((k) => k.id === puzzle.who.kitId),
  };
}

/**
 * One Act. The single place the arithmetic happens, so par and the player's own
 * night can never disagree with each other.
 *
 * Mirrors the engine exactly on the three rules that are easy to get wrong:
 * Renown floors at zero, Dread is capped, and being Marked pays you for taking
 * the Act at all rather than for winning it (GAME_DESIGN §4.3).
 */
function step(
  puzzle: Puzzle,
  who: Kit,
  act: ActCard,
  choice: Choice,
  state: State
): { ledger: ActLedger; next: State } {
  const scene = SCENES_BY_ID[act.sceneId];
  const { calling, kit } = who;
  const door = scene.approaches.find((a) => a.id === choice.doorId);
  const mult = costMultiplier({ calling, scene, dread: state.dread, approach: door });

  if (!door) {
    // Flinch. Not a skip and not a stall: a real move that scores badly and
    // taxes the night, and it scales with Dread like every other cost.
    const renownDelta =
      (FLINCH_RENOWN - (act.marked ? MARK_FLINCH_PENALTY : 0)) * mult;
    const dreadDelta = FLINCH_DREAD * mult;
    const renown = Math.max(0, state.renown + renownDelta);
    const dread = Math.min(DREAD_MAX, state.dread + dreadDelta);
    return {
      ledger: {
        index: act.index,
        sceneId: act.sceneId,
        doorId: FLINCH,
        doorLabel: "Did not move",
        mods: [{ label: "you did not move", value: 0 }],
        total: 0,
        tn: 0,
        success: false,
        line: "You stand in the doorway long enough for it to be a decision, and then you do not go in.",
        renownDelta,
        dreadDelta,
        renownAfter: renown,
        dreadAfter: dread,
        tokensAfter: state.tokens,
        hookRefilled: false,
        costDoubled: mult > 1,
      },
      next: { renown, dread, tokens: state.tokens },
    };
  }

  const spend = Math.max(0, Math.min(Math.floor(choice.spend), state.tokens));
  const player = soloPlayer(puzzle.who.scores, state.tokens);
  const mods = ledgerFor(
    {
      player,
      calling,
      kit,
      scene,
      approach: door,
      spendTokens: spend,
      dread: state.dread,
      hookCalled: act.marked,
    },
    act.face
  );
  const total = sumLedger(mods);
  // The same predicate the page labels the door with, so the preview and the
  // ledger cannot disagree about a natural 1 or a natural 20.
  const success = clears(act.face, total, door.tn);

  let renownDelta = success ? door.deed : -door.cost.renown * mult;
  if (act.marked) renownDelta += MARK_BONUS;
  const dreadDelta = success ? 0 : door.cost.dread * mult;

  const renown = Math.max(0, state.renown + renownDelta);
  const dread = Math.min(DREAD_MAX, state.dread + dreadDelta);
  const tokens = act.marked ? HOOK_TOKENS_MAX : state.tokens - spend;

  return {
    ledger: {
      index: act.index,
      sceneId: act.sceneId,
      doorId: door.id,
      doorLabel: door.label,
      mods,
      total,
      tn: door.tn,
      success,
      line: success ? door.win : door.lose,
      renownDelta,
      dreadDelta,
      renownAfter: renown,
      dreadAfter: dread,
      tokensAfter: tokens,
      hookRefilled: act.marked,
      costDoubled: mult > 1,
    },
    next: { renown, dread, tokens },
  };
}

/** Play a list of choices, however short, and get the ledger for each. */
export function play(puzzle: Puzzle, choices: readonly Choice[]): Run {
  const who = kitFor(puzzle);
  let state: State = { renown: 0, dread: 0, tokens: puzzle.hookTokens };
  const ledgers: ActLedger[] = [];
  for (let i = 0; i < Math.min(choices.length, puzzle.acts.length); i++) {
    const { ledger, next } = step(puzzle, who, puzzle.acts[i], choices[i], state);
    ledgers.push(ledger);
    state = next;
  }
  return { ledgers, renown: state.renown, dread: state.dread, tokens: state.tokens };
}

/**
 * Par: the highest Renown the night can be made to pay, by exhaustive search.
 *
 * Ten options an Act at the very most (three doors times nought, one or two
 * tokens, plus standing still), so a hundred thousand leaves at the outside.
 * A search rather than a formula because the Acts are not independent: Dread
 * carries forward, doubles every cost at three, and a token spent in Act I is a
 * token you have not got in Act IV. That coupling is exactly what makes this
 * worth publishing a par for.
 */
export function parFor(puzzle: Puzzle): { par: number; line: Choice[] } {
  const cached = PARS.get(puzzle.date);
  if (cached) return cached;

  const who = kitFor(puzzle);
  let best = -Infinity;
  let bestLine: Choice[] = [];

  const walk = (i: number, state: State, line: Choice[]) => {
    if (i === puzzle.acts.length) {
      if (state.renown > best) {
        best = state.renown;
        bestLine = [...line];
      }
      return;
    }
    const act = puzzle.acts[i];
    const options: Choice[] = [{ doorId: FLINCH, spend: 0 }];
    for (const door of act.doors) {
      for (let spend = 0; spend <= state.tokens; spend++) {
        options.push({ doorId: door.id, spend });
      }
    }
    for (const option of options) {
      const { next } = step(puzzle, who, act, option, state);
      line.push(option);
      walk(i + 1, next, line);
      line.pop();
    }
  };

  walk(0, { renown: 0, dread: 0, tokens: puzzle.hookTokens }, []);
  const result = { par: Math.max(0, best), line: bestLine };
  PARS.set(puzzle.date, result);
  return result;
}

// ---------------------------------------------------------------------------
// The share line
// ---------------------------------------------------------------------------

/**
 * Doors taken, with the outcome, and the score against par. No target numbers
 * and no scene names, so nothing here spoils tonight for the next person.
 */
export function shareText(date: string, run: Run, par: number): string {
  /*
   * SHAPES, NOT HUES. This was a green square against a red one, which is the
   * same glyph twice for a deuteranope, on the one artefact of this product that
   * travels and gets read by strangers. The Deep Run and the Ledger were already
   * using filled and hollow blocks; this now matches them, and a flinch keeps its
   * own mark rather than being a differently coloured failure.
   */
  const grid = run.ledgers
    .map((l) => (l.doorId === FLINCH ? "▪" : l.success ? "▰" : "▱"))
    .join("");
  return [
    `THE LONG WAY DOWN ${date}`,
    `${run.renown} Renown, ${parPhrase(run.renown, par)}`,
    grid,
    siteUrl("/daily/longway"),
  ].join("\n");
}

export { DREAD_DOUBLE_AT, DREAD_MAX, HOOK_TOKEN_VALUE };
