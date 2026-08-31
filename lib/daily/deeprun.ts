/**
 * THE DEEP RUN. Server-only.
 *
 * The one daily that is a dungeon rather than an arithmetic problem. Build a
 * character, go down, find out what is in each room when you get to it.
 *
 * THE DESIGN PROBLEM, and its answer.
 *
 * A daily has to be the identical puzzle for everybody or the score is not worth
 * posting. That is why the other three hand you every die up front: with perfect
 * information the puzzle is deterministic and comparability is free. It is also
 * why they were starting to feel like one puzzle in three costumes.
 *
 * The answer here: the dice are still pinned to the date, but each ROOM owns its
 * die rather than your choice owning it. Everybody in the world meets the same
 * seven numbers in the same order, so two scores mean the same thing, and you
 * cannot fish for a better roll by picking a different door because the room's
 * number does not move. What differs between two players is their build and
 * their nerve, and you are choosing without knowing what the room is holding.
 * That is the whole difference between assigning known dice and running a
 * dungeon.
 *
 * One honest consequence: after a run you know all seven numbers, so a second
 * attempt is easy. Exactly like knowing today's Wordle. You get one go, the
 * archive is explicitly practice, and nothing here pretends otherwise.
 *
 * NEVER IMPORT THIS FROM A CLIENT COMPONENT. `puzzleFor` is the only safe thing
 * to serialise, and it is safe because the target numbers ARE public: this is a
 * bet, not a riddle. What stays behind the wall is `parFor`, which is the answer.
 */
import { CALLINGS } from "@/lib/content/callings";
import { KIT } from "@/lib/content/kit";
// The die, and the rule that a 1 always fails and a 20 always clears, come from
// the places that own them: lib/game/rules and `clears`. This file used to keep
// its own DIE_SIDES, CRIT and FUMBLE, which is how a tuning change reaches three
// of four copies and the dungeon starts resolving a roll its own way.
import { DIE_SIDES, abilityMod } from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";
import { siteUrl } from "../site";
import {
  clears,
  dateSeed,
  failCost,
  mulberry32,
  outcomeOf,
  seededShuffle,
  startingVigourFrom,
  type Outcome,
} from "./core";

// The failure gradient belongs to `core`, which is the one daily module a client
// component may import, because the desk has to show an author what a door costs.
export { FAILED_CHECK_EXTRA, NEAR_BY, RUIN_BY, failCost, failRange, outcomeOf } from "./core";
export type { Outcome } from "./core";
import {
  DEEP_BOSSES,
  DEEP_ROOMS,
  KNACK_BY_CALLING,
  KNACKS,
  PREMISES,
  type Aside,
  type Premise,
  type KnackKind,
  type OptionDef,
  type RoomDef,
} from "./deeprun-data";

export const ROOMS = 5;
/** The rooms plus whatever is at the bottom. */
export const DEPTH = ROOMS + 1;

/** How many you choose between. Small on purpose: the build is the starter. */
export const CALLING_CHOICES = 3;
export const KIT_CHOICES = 4;
export const KIT_SLOTS = 2;
export const ARRAY_SIZE = 6;
export const BOOST = 5;
export const MEND = 3;

/**
 * Vigour. Deliberately not hit points: you are not fighting a war of attrition,
 * you are running out of the will to keep going down. Grit buys you more of it,
 * which is the only place an ability score matters before the first room.
 */
export const BASE_VIGOUR = 9;

export const OUT_ALIVE = 10;
export const ROOM_CLEARED = 4;
export const BOSS_BEATEN = 12;
/** Vigour left over is worth something: getting out on your last breath is luck. */
export const VIGOUR_VALUE = 1;
/**
 * The ceiling, worked out rather than guessed: every floor cleared, the thing at
 * the bottom, out alive, and the most Vigour anybody could still be carrying at
 * the end (base, plus up to four from Grit, plus a Hedge-witch's three). Par on
 * a real day lands well under it, which is the point of publishing par instead.
 */
export const MAX_SCORE =
  DEPTH * ROOM_CLEARED + BOSS_BEATEN + OUT_ALIVE + (BASE_VIGOUR + 4 + MEND) * VIGOUR_VALUE;

export type Build = {
  callingId: string;
  /** One array index per ability, in the order ABILITIES lists them. */
  placement: number[];
  kitIds: string[];
};

export type PuzzleOption = {
  id: string;
  label: string;
  kind: OptionDef["kind"];
  ability: Ability | null;
  tn: number | null;
  vigour: number;
  promise: string;
  /**
   * The Marks rules, and they are PUBLIC, exactly like the target number.
   *
   * This is a bet, not a riddle. You are told a door wants the lamp before you
   * decide whether to go and get one, the same way you are told a door wants a 14
   * before you decide whether to try it. What stays behind the wall is the die
   * and the prose, and neither of those is here.
   */
  needs: string[];
  forbids: string[];
  sets: string[];
  /** What a ruin on this door leaves on you. Public, like every other mark rule. */
  ruinSets: string[];
};

export type PuzzleRoom = {
  /** Carried so the server finds the room's prose without matching on title. */
  id: string;
  index: number;
  title: string;
  setup: string;
  /**
   * Lines the room only says if you arrive carrying something.
   *
   * Sent whole and filtered in the browser, which is safe because a mark is
   * already public to the player who holds it - the descent prints "you are wet
   * and seen" above the doors. These are flavour, never an answer, so there is
   * nothing here to redact.
   */
  asides: Aside[];
  boss: boolean;
  options: PuzzleOption[];
};

export type Puzzle = {
  date: string;
  array: number[];
  abilities: readonly Ability[];
  callings: {
    id: string;
    name: string;
    blurb: string;
    affinities: Ability[];
    knack: { kind: KnackKind; label: string; text: string };
  }[];
  kit: { id: string; name: string; blurb: string; ability: Ability | null; value: number }[];
  rooms: PuzzleRoom[];
  /**
   * Why you came down tonight, and what it means if you get back up.
   *
   * Dealt from the date like everything else, so the whole world gets the same
   * reason on the same night. It never refers to a room, because the rooms are
   * dealt blind and no line of prose can safely assume one turned up.
   */
  premise: Premise;
  baseVigour: number;
  /**
   * What the dice are pinned to.
   *
   * The date, for the daily. A dungeon's own code, for an authored one. Every
   * die in a run comes from this and nothing else, which is what makes two
   * players' scores comparable and an author's tuning a fact rather than a
   * distribution.
   */
  seed: string;
  /** What it is called. The date, or the author's title. */
  label: string;
  maxScore: number;
};

/**
 * THE PUZZLE AS A PLAYER IS ALLOWED TO SEE IT.
 *
 * TWO fields come out now, and the second one is a reversal worth explaining
 * rather than quietly making.
 *
 * The ability a door leans on went first, because reading the room is the game
 * and a player who can rank three doors by their own modifier never reads a word.
 *
 * THE TARGET NUMBER NOW GOES TOO, and the argument that kept it was wrong in a
 * way that only showed up once somebody counted. "It is a bet, not a riddle" is
 * a good principle and it assumed the number sat on top of a real choice. It did
 * not: every room in the pool prices all of its checks identically, so the target
 * was the ONLY thing separating one door from another, and the fastest correct
 * way to play was to read three numbers and take the smallest. Adam's question,
 * verbatim: "eleven what? Do I just pick the lowest number?" Yes, he did, and so
 * would anybody.
 *
 * What replaces it is not a difficulty word. That was tried, and on a floor whose
 * doors want 11, 12 and 13 it printed the same word three times, which is noise
 * dressed as signal. What replaces it is the STAKE: what going badly wrong on
 * this particular door leaves on you, which is authored per door, is a fact about
 * the fiction rather than the arithmetic, and tells you nothing whatsoever about
 * whether YOU will make it. Risk you can picture, instead of a number you can
 * sort.
 *
 * The number is not hidden, it is deferred: the reveal still prints "it wanted
 * 14" against your total the moment the floor resolves, which is where it teaches
 * you something instead of letting you skip the reading.
 *
 * Stripped HERE rather than in the component, because hiding a field in the UI
 * while leaving it in the JSON is not hiding it, it is hiding it from people who
 * do not open devtools.
 *
 * The engine keeps the full `Puzzle`: `run` and the par search both need every
 * field to resolve anything. This is the shape that crosses the wire, and it is
 * built at the route boundary for the same reason `viewFor` exists.
 */
export type PublicPuzzle = Omit<Puzzle, "rooms"> & {
  rooms: (Omit<PuzzleRoom, "options"> & {
    options: Omit<PuzzleOption, "ability" | "tn">[];
  })[];
};

export function publicPuzzle(puzzle: Puzzle): PublicPuzzle {
  return {
    ...puzzle,
    rooms: puzzle.rooms.map((room) => ({
      ...room,
      options: room.options.map(({ ability: _ability, tn: _tn, ...rest }) => rest),
    })),
  };
}

/** One decision. `knack` is whether they spent their once-a-run move on it. */
export type Step = { optionId: string; knack?: boolean };

export type Line = {
  roomIndex: number;
  title: string;
  optionId: string;
  label: string;
  /** 0 when nothing was thrown: a knack and a brace never roll. */
  roll: number;
  mods: { label: string; value: number }[];
  total: number;
  tn: number | null;
  cleared: boolean;
  /**
   * HOW it went, not only whether. "near" and "ruin" are the two the screen
   * treats differently; "bad" is the ordinary miss and reads like the old one.
   */
  outcome: Outcome;
  vigourSpent: number;
  vigourAfter: number;
  /** One sentence. Never states the numbers; the mods do that. */
  text: string;
  /** What this floor left on you, and everything you are carrying after it. */
  gained: string[];
  marks: string[];
};

export type Result = {
  lines: Line[];
  /** How deep they got. DEPTH means they came back out. */
  depth: number;
  vigour: number;
  out: boolean;
  bossBeaten: boolean;
  roomsCleared: number;
  score: number;
};

// ---------------------------------------------------------------------------
// Today's dungeon
// ---------------------------------------------------------------------------

/**
 * The die for one room.
 *
 * Keyed on the date and the room, never on the path taken, so the number in room
 * four is the same number whatever you did in room three. That is what stops the
 * dungeon being farmed by re-choosing, and what makes two scores comparable.
 */
export function dieFor(date: string, roomIndex: number): number {
  const rand = mulberry32(dateSeed(`${date}:deeprun:die:${roomIndex}`));
  return 1 + Math.floor(rand() * DIE_SIDES);
}

/** The Houndmaster's second throw. Pinned the same way, for the same reason. */
export function secondDie(date: string, roomIndex: number): number {
  return dieFor(`${date}:again`, roomIndex);
}

/**
 * Which day this is, as a number, so consecutive days can be told apart.
 *
 * `dateSeed` hashes the date to a scattered integer, which is what you want for
 * dice and exactly what you do not want here: dealing a deck needs to know that
 * the 3rd came after the 2nd. Parsing a pinned UTC string is deterministic, takes
 * no clock reading, and the engine's rule is against `Math.random`, not against
 * arithmetic on a date somebody passed in.
 */
function dayNumber(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * DEAL FROM A DECK, DO NOT DRAW FROM A BAG.
 *
 * Every day used to shuffle each band independently and take the top cards, which
 * is drawing with replacement across days, and the pools are small: band one is
 * two rooms out of six, band two is two out of five. The chance that a given day
 * repeated at least one room from the day before was ninety per cent. Somebody
 * playing two nights running was therefore almost certain to walk back into a room
 * they had just solved, which is the whole of "is there enough variety".
 *
 * So the deal is global rather than per day. Slot `n` of the endless deal is card
 * `n % N` of pass `floor(n / N)`, and each pass is its own shuffle. Inside a pass
 * a room cannot come back at all: three days for band one, two or three for band
 * two, five for band three, twenty for the boss.
 *
 * WHAT THIS DOES NOT FIX, measured rather than hoped: two passes meeting at a
 * boundary are two independent shuffles, so the same card can land either side of
 * the join. Band one crosses a boundary every third day and band two every third
 * or fourth, which leaves roughly forty-five per cent of consecutive days sharing
 * something, against ninety before. A real halving, and not the zero it would be
 * nice to claim.
 *
 * Closing the join exactly would mean each pass knowing the pass before it, and
 * therefore every pass before that, which a function addressed by a date cannot do
 * without keeping state. The honest remaining fix is more rooms: band one is six
 * cards, so it is dealt out in three days no matter how well it is shuffled. See
 * docs/GAME_DESIGN.md.
 *
 * ponytail: pass-boundary repeats stay. Write more band one and band two rooms
 * before reaching for cleverness here; a pool of twelve makes the join rare on its
 * own.
 *
 * No state, no storage, no reading of any other day: slot arithmetic on the date
 * alone, so every player in the world still gets the same rooms in the same order
 * and an archive day still deals what it dealt at the time.
 */
function dealt(pool: readonly RoomDef[], take: number, slot0: number, key: string): RoomDef[] {
  const size = pool.length;
  if (size === 0) return [];
  const out: RoomDef[] = [];
  for (let i = 0; i < take; i++) {
    const slot = slot0 + i;
    const pass = Math.floor(slot / size);
    // Shuffled per pass, so the order is not the same every time round.
    const order = seededShuffle(pool, mulberry32(dateSeed(`${key}:pass:${pass}`)));
    out.push(order[slot % size]);
  }
  return out;
}

function roomsFor(date: string): RoomDef[] {
  const day = dayNumber(date);
  // Banded rather than shuffled flat, so it gets worse as you go down. That is
  // the only shape a descent can have.
  const picked: RoomDef[] = [];
  const perBand = [2, 2, 1];
  for (const band of [1, 2, 3] as const) {
    const take = perBand[band - 1];
    picked.push(
      ...dealt(
        DEEP_ROOMS.filter((r) => r.band === band),
        take,
        day * take,
        `deeprun:band:${band}`
      )
    );
  }
  const boss = dealt(DEEP_BOSSES, 1, day, "deeprun:boss")[0];
  return [...picked.slice(0, ROOMS), boss];
}

/**
 * Tonight's dungeon.
 *
 * A thin caller of `puzzleFrom` now: the daily is one dungeon among others, it
 * just happens to be assembled from the date rather than written by somebody.
 * Keeping it on the same path as an authored one is what stops the two drifting,
 * and there is a test asserting they produce byte-identical results.
 */
/**
 * CAN ANYBODY GET OUT OF THIS AT ALL?
 *
 * Exact, and it needs no search, which is the only reason it can sit in the path
 * of every request for tonight's puzzle.
 *
 * The trick is that the cheapest possible price of a floor is knowable without
 * looking at any other floor: every room's die is thrown before anybody chooses,
 * so for a FIXED character each door either clears or does not, and clearing
 * costs nothing. So the least a character can spend on a floor is zero if any
 * door clears for them, and otherwise the cheapest thing on it that always works.
 * Add those up and compare against what they start with. Knacks are ignored, and
 * ignoring them is safe in the direction that matters: they only ever help, so a
 * character this says can get out really can.
 */
function cheapestSpend(puzzle: Puzzle, build: Build): number {
  const who = characterFor(puzzle, build);
  let spend = 0;
  /**
   * The biggest toll they pay, which their knack effectively waives.
   *
   * Every Calling's knack is worth about one floor: the Warden and the Knife get
   * past one for nothing, the Hedge-witch gets three Vigour back, and the others
   * turn one roll around. Ignoring knacks entirely made this so pessimistic that
   * it rejected most days as unwinnable and kept re-drawing until the dice were
   * generous, which took the share of characters who get out from 84% to 96%: a
   * guarantee bought by deleting the game. Waiving one toll is the honest model.
   */
  let worstToll = 0;
  for (const room of puzzle.rooms) {
    let free = false;
    let toll = Infinity;
    for (const option of room.options) {
      /**
       * GATED DOORS DO NOT COUNT, and this is deliberately pessimistic.
       *
       * Whether a door gated on a mark is open depends on the path taken, and
       * this function exists precisely because it does NOT search paths: it is in
       * the hot path of every request for tonight's puzzle. So it prices the run
       * a character could make while ignoring every door that might be shut to
       * them, which can only ever understate what they can do.
       *
       * That is the safe direction. A day this passes really is winnable; a day
       * it rejects might have been winnable by somebody who picked up a lamp on
       * floor one, and gets re-drawn instead.
       *
       * The gate guarantees an ungated BRACE on every floor, which is what stops
       * this running out of doors: a floor always has at least the slow certain
       * way through. It does not guarantee an ungated check, and this does not
       * need one. The house pool has one on every floor anyway, and
       * `tests/unit/deeprun-marks.test.ts` holds it to that.
       *
       * Before marks were used by any room this loop was correct by accident.
       * The moment content started gating doors it began counting doors nobody
       * could open, which is a winnability guarantee about a different game.
       */
      if (option.needs.length > 0 || option.forbids.length > 0) continue;
      if (option.kind === "brace") {
        toll = Math.min(toll, option.vigour);
        continue;
      }
      const ability = option.ability ?? "grit";
      const die = dieFor(puzzle.seed, room.index);
      let total = die + abilityMod(who.scores[ability]);
      if (who.affinities.includes(ability)) total += 2;
      for (const b of who.bonuses) if (b.ability === ability) total += b.value;
      const band = outcomeOf(die, total, option.tn ?? 99);
      if (band === "cleared") {
        free = true;
        break;
      }
      toll = Math.min(toll, failCost(option, band));
    }
    if (free) continue;
    // Nothing opens, so they pay. A floor with no way through at all ends the run.
    if (!Number.isFinite(toll)) return Infinity;
    spend += toll;
    worstToll = Math.max(worstToll, toll);
  }
  return Math.max(0, spend - worstToll);
}

/**
 * Does at least one sensible character walk out of this dungeon?
 *
 * A handful of builds rather than all of them: one per Calling, with the array's
 * best numbers on the abilities this dungeon actually asks about, which is what a
 * person does. If none of those get out, nobody is going to.
 */
export function anybodyGetsOut(puzzle: Puzzle): boolean {
  const asked = new Set<Ability>();
  for (const room of puzzle.rooms)
    for (const o of room.options) if (o.ability) asked.add(o.ability);

  // Indices into the array, best number first.
  const byValue = [...puzzle.array.keys()].sort((a, b) => puzzle.array[b] - puzzle.array[a]);
  const placement = ABILITIES.map(() => 0);
  let next = 0;
  for (const ability of ABILITIES)
    if (asked.has(ability)) placement[ABILITIES.indexOf(ability)] = byValue[next++] ?? 0;
  for (const ability of ABILITIES)
    if (!asked.has(ability)) placement[ABILITIES.indexOf(ability)] = byValue[next++] ?? 0;

  for (const calling of puzzle.callings) {
    for (const kitIds of [
      [puzzle.kit[0]?.id, puzzle.kit[1]?.id].filter(Boolean) as string[],
      [puzzle.kit[puzzle.kit.length - 1]?.id, puzzle.kit[0]?.id].filter(Boolean) as string[],
    ]) {
      const build: Build = { callingId: calling.id, placement, kitIds };
      const who = characterFor(puzzle, build);
      if (cheapestSpend(puzzle, build) < startingVigour(who, puzzle.baseVigour)) return true;
    }
  }
  return false;
}

/**
 * WHICH DICE TONIGHT USES, and why this exists at all.
 *
 * Every room carries fixed targets: 11 to 13 on a shallow floor, 16 to 18 at the
 * bottom. Every floor throws a die pinned to the date. A character brings about
 * +4 to an ability they are built for, so a target of 17 against a die of 3 is not
 * hard, it is shut. Nothing said the six dice had to include any good ones, so
 * about one day a month dealt six poor ones, every door in the dungeon was shut,
 * everybody paid the brace on all six floors, and nineteen Vigour of tolls against
 * a starting nine meant NOBODY COULD FINISH THE DAILY. Nine days in two hundred
 * and forty. Found by playing it, not by reading it.
 *
 * Three fixes were tried and thrown away. Matching rooms to dice does nothing,
 * because every room in a band carries almost the same targets. Cutting the tolls
 * far enough to be survivable on their own turns the game into "brace everything
 * and you always live". And deriving the targets from the die, which is exactly
 * right at the desk, is a LEAK here: the target is printed before you choose, so a
 * target that came from the die would tell you the die, and not knowing what the
 * room rolled is the whole of the Deep Run.
 *
 * A rule of thumb on the dice was tried too, and it is instructive that it failed:
 * "at least one floor of twelve or better" had no dead days across a hundred and
 * twenty and four across a year. So the check is the property itself rather than a
 * proxy for it: re-draw until somebody can actually get out. Costs one cheap pass
 * per candidate, no search, and on almost every day the first draw passes.
 *
 * The player learns nothing from any of this: they still never see a die before
 * they open the room, and everybody in the world still gets the same six numbers
 * in the same order.
 */
function dieSeedFor(date: string, rooms: RoomDef[]): string {
  for (let salt = 0; salt < 32; salt++) {
    const seed = salt === 0 ? date : `${date}#${salt}`;
    const candidate = puzzleFrom(
      { seed, label: date, rooms, callingIds: null, kitIds: null, baseVigour: BASE_VIGOUR },
      date
    );
    if (anybodyGetsOut(candidate)) return seed;
  }
  // Thirty-two hopeless draws in a row is not a thing to throw over. Serve the
  // day's own dice and let the scores say what kind of night it was.
  return date;
}

export function puzzleFor(date: string): Puzzle {
  const rooms = roomsFor(date);
  return puzzleFrom(
    {
      // The dice come from this, and the rooms and the array come from the date.
      // Usually the same string; on a badly dealt day, the date plus a counter.
      seed: dieSeedFor(date, rooms),
      label: date,
      rooms,
      callingIds: null,
      kitIds: null,
      baseVigour: BASE_VIGOUR,
    },
    date
  );
}

/**
 * Build a Puzzle from a design: either the date's own pick, or somebody's.
 *
 * `pools` decides which Callings and Kit are offered. Null means "the whole set,
 * narrowed by the seed", which is what the daily does. A list means the author
 * chose, and the seed only shuffles what they allowed.
 */
export type Design = {
  seed: string;
  label: string;
  rooms: RoomDef[];
  /** Null for the daily's seeded pick. A list when an author chose. */
  callingIds: string[] | null;
  kitIds: string[] | null;
  baseVigour: number;
};

export function puzzleFrom(design: Design, arraySeed = design.seed): Puzzle {
  // Named for what it is. Calling this `date` is what let the seed reach a field
  // the client sends back as a date; everything below picks dice with it.
  const seed = design.seed;
  const rand = mulberry32(dateSeed(`${arraySeed}:deeprun:array`));
  // Four dice, drop the lowest, six times: the same curve the live game uses, so
  // a player who knows one already knows the other.
  const array = Array.from({ length: ARRAY_SIZE }, () => {
    const dice = [0, 0, 0, 0].map(() => 1 + Math.floor(rand() * 6)).sort((a, b) => b - a);
    return dice[0] + dice[1] + dice[2];
  });

  const callingPool = design.callingIds
    ? CALLINGS.filter((c) => design.callingIds!.includes(c.id))
    : CALLINGS;
  /**
   * THREE CALLINGS, THREE DIFFERENT KNACKS.
   *
   * Eight Callings share five knacks between them: the Warden and the Sapper both
   * walk through a room, the Chanter and the Reckoner both add five after the die,
   * the Hedge-witch and the Oathbound both clear a room and mend. So a straight
   * shuffle of three could and did offer two whose once-a-night move was word for
   * word the same, leaving a choice between two ability spreads dressed up as a
   * choice between three characters.
   *
   * Taking the first of each kind fixes it without narrowing anything: the pool is
   * shuffled first, so which of a pair turns up is still the day's business, and
   * all eight still appear across a week. Only the duplicate is dropped.
   *
   * An AUTHOR's list is left alone, the same as their kit: if somebody has put the
   * Warden and the Sapper in their dungeon on purpose, that is their dungeon.
   */
  const spread = design.callingIds
    ? seededShuffle(callingPool, mulberry32(dateSeed(`${seed}:deeprun:callings`)))
    : (() => {
        const shuffled = seededShuffle(
          callingPool,
          mulberry32(dateSeed(`${seed}:deeprun:callings`))
        );
        const kinds = new Set<string>();
        const picked = shuffled.filter((c) => {
          const kind = KNACK_BY_CALLING[c.id];
          if (kinds.has(kind)) return false;
          kinds.add(kind);
          return true;
        });
        // If the content ever has fewer distinct knacks than seats, fill from the
        // shuffle rather than serving a short list.
        return picked.length >= CALLING_CHOICES ? picked : shuffled;
      })();

  const callings = spread
    .slice(0, design.callingIds ? callingPool.length : CALLING_CHOICES)
    .map((c) => {
      const kind = KNACK_BY_CALLING[c.id];
      return {
        id: c.id,
        name: c.name,
        blurb: c.blurb,
        affinities: [...c.affinities],
        knack: { kind, label: c.signature.label, text: KNACKS[kind] },
      };
    });

  /**
   * The daily only offers kit that can do something down here.
   *
   * Five of the twelve items are charges rather than bonuses, and `charge` is
   * never read anywhere in the Deep Run: they are multiplayer gear. Offering them
   * made "take two of these four" a choice with one answer some nights, and on
   * the house dungeon three of the five on the shelf were inert. Muster already
   * filters its own pool this way and says why: offering a choice that cannot
   * matter is worse than offering fewer choices.
   *
   * An AUTHOR's list is left exactly as they set it. They chose those items, and
   * silently dropping a card somebody picked is worse than letting them ship a
   * thin shelf. The gate warns them about a dud and blocks a shelf where nothing
   * works at all, which it did NOT do when this comment first claimed it: the
   * check was added later, in `gate.ts`, after the comment was found to be the
   * only thing standing between an author and a shelf of four dead cards.
   */
  const kitPool = design.kitIds
    ? KIT.filter((k) => design.kitIds!.includes(k.id))
    : KIT.filter((k) => k.bonus);
  const kit = seededShuffle(kitPool, mulberry32(dateSeed(`${seed}:deeprun:kit`)))
    .slice(0, design.kitIds ? kitPool.length : KIT_CHOICES)
    .map((k) => ({
      id: k.id,
      name: k.name,
      blurb: k.blurb,
      ability: k.bonus?.ability ?? null,
      value: k.bonus?.value ?? 0,
    }));

  const rooms: PuzzleRoom[] = design.rooms.map((room, i) => ({
    id: room.id,
    index: i,
    title: room.title,
    setup: room.setup,
    asides: room.asides ?? [],
    boss: !!room.boss,
    options: room.options.map((o) => ({
      id: o.id,
      label: o.label,
      kind: o.kind,
      ability: o.ability ?? null,
      tn: o.tn ?? null,
      vigour: o.vigour ?? 0,
      promise: o.promise,
      needs: o.needs ?? [],
      forbids: o.forbids ?? [],
      sets: o.sets ?? [],
      ruinSets: o.ruinSets ?? [],
    })),
  }));

  return {
    /**
     * WHAT IT IS CALLED, never what its dice are pinned to.
     *
     * This was `design.seed`, which is the same string on almost every day and so
     * looked right for months. It is not the same string on a day whose first
     * draw was unwinnable: `dieSeedFor` salts the seed to "2026-08-25#1" and
     * re-draws, and the payload then told the client its date was that. The
     * client hands the date straight back on every POST, where the zod schema
     * requires a plain date, so a salted day would have started refusing the
     * second floor of every run with a validation error.
     *
     * It surfaced when the room pool grew and re-draws stopped being rare. Two
     * fields, two jobs: `seed` pins the dice, `date` and `label` are what a person
     * is shown and what comes back on the wire.
     */
    date: design.label,
    seed: design.seed,
    label: design.label,
    array,
    abilities: ABILITIES,
    callings,
    kit,
    rooms,
    /*
     * Off the seed rather than the date, so an authored dungeon gets one too and
     * a re-drawn day keeps the reason it was shown with.
     */
    premise: PREMISES[Math.abs(dateSeed(`${design.seed}:premise`)) % PREMISES.length],
    baseVigour: design.baseVigour,
    maxScore: ceilingFor(design.rooms.length, design.baseVigour),
  };
}

/**
 * The most anybody could score on a dungeon of this shape.
 *
 * Depth-dependent now that a dungeon may be three floors or eight, so a short
 * one cannot advertise a ceiling it could never reach.
 */
export function ceilingFor(floors: number, baseVigour: number): number {
  return (
    floors * ROOM_CLEARED + BOSS_BEATEN + OUT_ALIVE + (baseVigour + 4 + MEND) * VIGOUR_VALUE
  );
}

// ---------------------------------------------------------------------------
// Is this a legal character
// ---------------------------------------------------------------------------

export function validBuild(puzzle: Puzzle, build: Build): string | null {
  if (!puzzle.callings.some((c) => c.id === build.callingId))
    return "That is not one of tonight's three.";
  if (build.placement.length !== ARRAY_SIZE) return "Every ability needs a number.";
  const sorted = [...build.placement].sort((a, b) => a - b);
  // A permutation of the array's indices: you may rearrange the numbers the house
  // rolled, never rewrite them.
  if (sorted.some((v, i) => v !== i)) return "Those are not the numbers on the table.";
  if (build.kitIds.length !== KIT_SLOTS) return `Take exactly ${KIT_SLOTS} things with you.`;
  if (new Set(build.kitIds).size !== build.kitIds.length) return "One of each.";
  if (build.kitIds.some((id) => !puzzle.kit.some((k) => k.id === id)))
    return "That is not on tonight's shelf.";
  return null;
}

export type Character = {
  scores: Record<Ability, number>;
  affinities: Ability[];
  bonuses: { ability: Ability; value: number; name: string }[];
  knack: KnackKind;
  knackLabel: string;
};

export function characterFor(puzzle: Puzzle, build: Build): Character {
  const scores = {} as Record<Ability, number>;
  ABILITIES.forEach((ability, i) => {
    scores[ability] = puzzle.array[build.placement[i]] ?? 10;
  });
  const calling = puzzle.callings.find((c) => c.id === build.callingId)!;
  const bonuses = build.kitIds
    .map((id) => puzzle.kit.find((k) => k.id === id))
    .filter((k): k is NonNullable<typeof k> => !!k && !!k.ability)
    .map((k) => ({ ability: k.ability as Ability, value: k.value, name: k.name }));
  return {
    scores,
    affinities: calling.affinities,
    bonuses,
    knack: calling.knack.kind,
    knackLabel: calling.knack.label,
  };
}

/**
 * Is this door open to somebody carrying these marks?
 *
 * One predicate, three readers: the runner, the par search and the play screen.
 * If they ever disagree, a player is offered a door the solver never priced, or
 * priced against a par they could not have scored.
 *
 * Ungated is the default and the common case, so it costs two length checks.
 */
export function openTo(
  option: { needs?: string[]; forbids?: string[] },
  held: ReadonlySet<string>
): boolean {
  const needs = option.needs;
  if (needs && needs.length > 0 && !needs.every((m) => held.has(m))) return false;
  const forbids = option.forbids;
  if (forbids && forbids.length > 0 && forbids.some((m) => held.has(m))) return false;
  return true;
}

/** Every mark any door in this dungeon reads. Nothing else can change a decision. */
export function marksRead(rooms: readonly { options: readonly { needs?: string[]; forbids?: string[] }[] }[]): Set<string> {
  const read = new Set<string>();
  for (const room of rooms)
    for (const o of room.options) {
      for (const m of o.needs ?? []) read.add(m);
      for (const m of o.forbids ?? []) read.add(m);
    }
  return read;
}

/**
 * How much Vigour a character walks in with.
 *
 * The base belongs to the DUNGEON, not to this module. It used to read the
 * constant, which meant an author could set the dial to 5, the desk would call
 * it "thin", the door would say "which is thin", and every run would quietly
 * start on 9: a setting displayed in three places and applied in none.
 *
 * Found by asking why an eight-floor fixture that should be unsurvivable
 * published three times in a hundred. It did, because the dial that was supposed
 * to starve it was decorative.
 *
 * Both readers pass it, the runner and the par search. If they ever disagree,
 * par stops describing the game anybody is playing.
 */
export function startingVigour(who: Character, base = BASE_VIGOUR): number {
  // The arithmetic lives in `core` so the sheet on screen can ask the same
  // question. It used to be here alone, and the screen guessed.
  return startingVigourFrom(base, who.scores.grit);
}

// ---------------------------------------------------------------------------
// Going down
// ---------------------------------------------------------------------------

/**
 * Play a whole run and score it.
 *
 * Pure and total: it never throws on a bad path, it stops. A submission that
 * runs out of steps just ends there, which is also what happens when the player
 * closes the tab, so there is one code path for both.
 */
export function run(
  puzzle: Puzzle,
  build: Build,
  steps: readonly Step[],
  /**
   * Where the win and lose prose lives.
   *
   * The house pool by default. An authored dungeon passes its own, which is the
   * whole of what a campaign is: the same runner, different rooms. This is a
   * parameter rather than a field on Puzzle because `win` and `lose` are the one
   * part of a room a player must not see until they have committed, and Puzzle
   * is the thing that gets serialised to them.
   */
  defs: readonly RoomDef[] = HOUSE_DEFS
): Result {
  const who = characterFor(puzzle, build);
  const lines: Line[] = [];
  let vigour = startingVigour(who, puzzle.baseVigour);
  let knackLeft = true;
  let roomsCleared = 0;
  let bossBeaten = false;
  let depth = 0;
  /** What they are carrying. Only ever grows; see OptionDef for why. */
  const held = new Set<string>();

  for (const room of puzzle.rooms) {
    const step = steps[room.index];
    if (!step) break; // They stopped, or the tab did.
    const option = room.options.find((o) => o.id === step.optionId);
    if (!option) break;
    /**
     * A door that is not open to them ends the run where it stands.
     *
     * Not an error, and deliberately the same behaviour as running out of steps:
     * `run` is total, it never throws, and a submission that names a shut door is
     * indistinguishable from one that walked away. Somebody hand-posting a locked
     * option id gets a short run and no score, which is the whole of the
     * punishment it deserves.
     */
    if (!openTo(option, held)) break;

    // A knack is once a run, and only on an option that has somewhere to put it.
    const usingKnack = !!step.knack && knackLeft && knackApplies(who.knack, option);
    if (usingKnack) knackLeft = false;

    const line = resolveOption(puzzle, who, room, option, defs, {
      die: dieFor(puzzle.seed, room.index),
      vigour,
      knack: usingKnack ? who.knack : null,
      knackLabel: who.knackLabel,
    });
    vigour = line.vigourAfter;
    depth = room.index + 1;

    if (line.cleared) {
      roomsCleared++;
      if (room.boss) bossBeaten = true;
      // Only a door that worked leaves anything good on you.
      for (const m of option.sets) held.add(m);
    } else if (line.outcome === "ruin") {
      // ...and a door that went very badly leaves something else. This is the
      // only way a mark arrives without being asked for, and it is the whole of
      // "floor two comes back on floor five".
      for (const m of option.ruinSets) held.add(m);
    }
    line.gained =
      line.cleared ? [...option.sets] : line.outcome === "ruin" ? [...option.ruinSets] : [];
    line.marks = [...held];
    lines.push(line);
    // Out of Vigour is where the run stops, cleared room or not.
    if (vigour <= 0) break;
  }

  const out = vigour > 0 && depth >= puzzle.rooms.length;
  const score =
    roomsCleared * ROOM_CLEARED +
    (bossBeaten ? BOSS_BEATEN : 0) +
    (out ? OUT_ALIVE : 0) +
    (out ? Math.max(0, vigour) * VIGOUR_VALUE : 0);

  return { lines, depth, vigour: Math.max(0, vigour), out, bossBeaten, roomsCleared, score };
}

function knackApplies(kind: KnackKind, option: PuzzleOption): boolean {
  switch (kind) {
    // These clear a room outright, so they need a room with something to clear.
    case "pass":
    case "slip":
    case "mend":
      return true;
    // These edit a roll, so they need a roll.
    case "boost":
    case "rethrow":
      return option.kind === "check";
  }
}

function resolveOption(
  puzzle: Puzzle,
  who: Character,
  room: PuzzleRoom,
  option: PuzzleOption,
  defs: readonly RoomDef[],
  ctx: { die: number; vigour: number; knack: KnackKind | null; knackLabel: string }
): Line {
  const def = defFor(defs, room, option.id);
  const base = (cleared: boolean, over: Partial<Line> = {}): Line => ({
    roomIndex: room.index,
    title: room.title,
    optionId: option.id,
    label: option.label,
    roll: 0,
    mods: [],
    total: 0,
    tn: option.tn,
    cleared,
    outcome: cleared ? "cleared" : "bad",
    vigourSpent: 0,
    text: cleared ? def.win : def.lose,

    // Filled in by `run`, which is the only thing that knows what is being
    // carried. `resolveOption` resolves one door and has no memory.
    gained: [],
    marks: [],
    ...over,
    /**
     * Nobody has minus three Vigour.
     *
     * A floor whose price is more than you have left ends the run, and the run
     * ending is what the number means, so it reads zero. It used to arrive
     * negative and print "5 Vigour, -3 left" on the last line of a bad night.
     * Floored here rather than in the screen because the share text, the play log
     * and the screen all read this field and all three were wrong.
     *
     * `vigourSpent` is left alone: what the floor cost you is true whether or not
     * you could afford it.
     */
    vigourAfter: Math.max(0, over?.vigourAfter ?? ctx.vigour),
  });

  // ---- a knack that does not need a roll ---------------------------------
  if (ctx.knack === "pass" || ctx.knack === "mend" || ctx.knack === "slip") {
    if (ctx.knack === "slip") {
      // The Knife does not clear the room, it is simply not in it. No credit,
      // no cost, and the difference between that and clearing it is the point.
      return base(false, {
        mods: [{ label: ctx.knackLabel.toLowerCase(), value: 0 }],
        text: "You are not in the room. Nobody sees you go past, and nothing down here is any better for it.",
      });
    }
    const back = ctx.knack === "mend" ? MEND : 0;
    return base(true, {
      mods: [
        { label: ctx.knackLabel.toLowerCase(), value: 0 },
        ...(back > 0 ? [{ label: "and you get your breath back", value: back }] : []),
      ],
      vigourAfter: ctx.vigour + back,
      text: def.win,
    });
  }

  // ---- brace: always works, and it costs -------------------------------
  if (option.kind === "brace") {
    return base(true, {
      mods: [{ label: "straight through it", value: 0 }],
      vigourSpent: option.vigour,
      vigourAfter: ctx.vigour - option.vigour,
      text: def.win,
    });
  }

  // ---- check: a real roll ------------------------------------------------
  const ability = option.ability ?? "grit";
  const mods: { label: string; value: number }[] = [];
  let die = ctx.die;
  if (ctx.knack === "rethrow") {
    // Throw again and keep the second. Pinned to the date and the room like the
    // first one, so everybody's reroll is the same reroll. One helper, shared
    // with the par search, so the two cannot drift apart.
    die = secondDie(puzzle.seed, room.index);
    mods.push({ label: ctx.knackLabel.toLowerCase(), value: 0 });
  }
  mods.push({ label: "d20", value: die });

  const mod = abilityMod(who.scores[ability]);
  if (mod !== 0) mods.push({ label: ability, value: mod });
  if (who.affinities.includes(ability))
    mods.push({ label: "trained for this", value: 2 });
  for (const bonus of who.bonuses) {
    if (bonus.ability === ability) mods.push({ label: bonus.name.toLowerCase(), value: bonus.value });
  }
  if (ctx.knack === "boost") mods.push({ label: ctx.knackLabel.toLowerCase(), value: BOOST });

  const total = mods.reduce((t, m) => t + m.value, 0);
  const tn = option.tn ?? 99;
  /**
   * One predicate, three readers: here, the par search, and the winnability
   * check. `outcomeOf` wraps `clears` rather than replacing it, so the die rule
   * still lives in exactly one place.
   */
  const band = outcomeOf(die, total, tn);
  const cleared = band === "cleared";
  const spent = cleared ? 0 : failCost(option, band);

  return base(cleared, {
    roll: die,
    mods,
    total,
    outcome: band,
    // A ruin gets its own sentence when the door wrote one. Falling back to
    // `lose` is what lets an authored dungeon never write one at all.
    text: cleared ? def.win : band === "ruin" ? (def.ruin ?? def.lose) : def.lose,
    vigourSpent: spent,
    vigourAfter: ctx.vigour - spent,
  });
}

/** Every room the house wrote. The default for a run that supplies none. */
export const HOUSE_DEFS: RoomDef[] = [...DEEP_ROOMS, ...DEEP_BOSSES];

function defFor(
  defs: readonly RoomDef[],
  room: PuzzleRoom,
  optionId: string
): OptionDef {
  const source = defs.find((r) => r.id === room.id);
  return (
    source?.options.find((o) => o.id === optionId) ?? {
      id: optionId,
      label: "",
      kind: "brace",
      promise: "",
      win: "It works.",
      lose: "It does not.",
    }
  );
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/**
 * What somebody pastes into a group chat.
 *
 * For a DUNGEON this is the entire distribution mechanism of the campaign
 * builder, so the link has to point at that dungeon and the heading has to name
 * it and its author. The first version read "THE DEEP RUN The Weeping Stair" and
 * linked to the daily, which is a share that sends everybody who clicks it to a
 * different game than the one being talked about.
 */
export function shareText(
  label: string,
  result: Result,
  par: number,
  dungeon?: { code: string; author: string } | null
): string {
  const glyphs = result.lines
    .map((l) => (l.cleared ? "▰" : l.vigourSpent > 0 ? "▱" : "▪"))
    .join("");
  const ending = result.out
    ? result.bossBeaten
      ? "out, and it is dead"
      : "out, and it is still down there"
    : `stopped on floor ${result.depth}`;
  return [
    dungeon ? `${label.toUpperCase()}, by ${dungeon.author}` : `THE DEEP RUN ${label}`,
    ending,
    glyphs,
    `${result.score} of a possible ${par}`,
    dungeon
      ? siteUrl(`/d/${dungeon.code}`)
      : siteUrl("/daily/deeprun"),
  ].join("\n");
}
