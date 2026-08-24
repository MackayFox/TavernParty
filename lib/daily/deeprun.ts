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
import { abilityMod } from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";
import { dateSeed, mulberry32, seededShuffle } from "./core";
import {
  DEEP_BOSSES,
  DEEP_ROOMS,
  KNACK_BY_CALLING,
  KNACKS,
  type KnackKind,
  type OptionDef,
  type RoomDef,
} from "./deeprun-data";

export const ROOMS = 5;
/** The rooms plus whatever is at the bottom. */
export const DEPTH = ROOMS + 1;
export const DIE_SIDES = 20;
export const CRIT = 20;
export const FUMBLE = 1;

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
};

export type PuzzleRoom = {
  /** Carried so the server finds the room's prose without matching on title. */
  id: string;
  index: number;
  title: string;
  setup: string;
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
  baseVigour: number;
  maxScore: number;
};

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
  vigourSpent: number;
  vigourAfter: number;
  /** One sentence. Never states the numbers; the mods do that. */
  text: string;
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

function roomsFor(date: string): RoomDef[] {
  // Banded rather than shuffled flat, so it gets worse as you go down. That is
  // the only shape a descent can have.
  const picked: RoomDef[] = [];
  const perBand = [2, 2, 1];
  for (const band of [1, 2, 3] as const) {
    const pool = seededShuffle(
      DEEP_ROOMS.filter((r) => r.band === band),
      mulberry32(dateSeed(`${date}:deeprun:band:${band}`))
    );
    picked.push(...pool.slice(0, perBand[band - 1]));
  }
  const boss = seededShuffle(
    DEEP_BOSSES,
    mulberry32(dateSeed(`${date}:deeprun:boss`))
  )[0];
  return [...picked.slice(0, ROOMS), boss];
}

export function puzzleFor(date: string): Puzzle {
  const rand = mulberry32(dateSeed(`${date}:deeprun:array`));
  // Four dice, drop the lowest, six times: the same curve the live game uses, so
  // a player who knows one already knows the other.
  const array = Array.from({ length: ARRAY_SIZE }, () => {
    const dice = [0, 0, 0, 0].map(() => 1 + Math.floor(rand() * 6)).sort((a, b) => b - a);
    return dice[0] + dice[1] + dice[2];
  });

  const callings = seededShuffle(CALLINGS, mulberry32(dateSeed(`${date}:deeprun:callings`)))
    .slice(0, CALLING_CHOICES)
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

  const kit = seededShuffle(KIT, mulberry32(dateSeed(`${date}:deeprun:kit`)))
    .slice(0, KIT_CHOICES)
    .map((k) => ({
      id: k.id,
      name: k.name,
      blurb: k.blurb,
      ability: k.bonus?.ability ?? null,
      value: k.bonus?.value ?? 0,
    }));

  const rooms: PuzzleRoom[] = roomsFor(date).map((room, i) => ({
    id: room.id,
    index: i,
    title: room.title,
    setup: room.setup,
    boss: !!room.boss,
    options: room.options.map((o) => ({
      id: o.id,
      label: o.label,
      kind: o.kind,
      ability: o.ability ?? null,
      tn: o.tn ?? null,
      vigour: o.vigour ?? 0,
      promise: o.promise,
    })),
  }));

  return {
    date,
    array,
    abilities: ABILITIES,
    callings,
    kit,
    rooms,
    baseVigour: BASE_VIGOUR,
    maxScore: MAX_SCORE,
  };
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

export function startingVigour(who: Character): number {
  return BASE_VIGOUR + Math.max(0, abilityMod(who.scores.grit));
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
export function run(puzzle: Puzzle, build: Build, steps: readonly Step[]): Result {
  const who = characterFor(puzzle, build);
  const lines: Line[] = [];
  let vigour = startingVigour(who);
  let knackLeft = true;
  let roomsCleared = 0;
  let bossBeaten = false;
  let depth = 0;

  for (const room of puzzle.rooms) {
    const step = steps[room.index];
    if (!step) break; // They stopped, or the tab did.
    const option = room.options.find((o) => o.id === step.optionId);
    if (!option) break;

    // A knack is once a run, and only on an option that has somewhere to put it.
    const usingKnack = !!step.knack && knackLeft && knackApplies(who.knack, option);
    if (usingKnack) knackLeft = false;

    const line = resolveOption(puzzle, who, room, option, {
      die: dieFor(puzzle.date, room.index),
      vigour,
      knack: usingKnack ? who.knack : null,
      knackLabel: who.knackLabel,
    });
    vigour = line.vigourAfter;
    lines.push(line);
    depth = room.index + 1;

    if (line.cleared) {
      roomsCleared++;
      if (room.boss) bossBeaten = true;
    }
    // Out of Vigour is where the run stops, cleared room or not.
    if (vigour <= 0) break;
  }

  const out = vigour > 0 && depth >= DEPTH;
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
  ctx: { die: number; vigour: number; knack: KnackKind | null; knackLabel: string }
): Line {
  const def = defFor(puzzle, room, option.id);
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
    vigourSpent: 0,
    vigourAfter: ctx.vigour,
    text: cleared ? def.win : def.lose,
    ...over,
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
    die = secondDie(puzzle.date, room.index);
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
  const cleared = die === CRIT ? true : die === FUMBLE ? false : total >= tn;
  const spent = cleared ? 0 : option.vigour;

  return base(cleared, {
    roll: die,
    mods,
    total,
    vigourSpent: spent,
    vigourAfter: ctx.vigour - spent,
  });
}

const ROOM_BY_ID = new Map([...DEEP_ROOMS, ...DEEP_BOSSES].map((r) => [r.id, r]));

function defFor(puzzle: Puzzle, room: PuzzleRoom, optionId: string): OptionDef {
  const source = ROOM_BY_ID.get(room.id);
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

export function shareText(date: string, result: Result, par: number): string {
  const glyphs = result.lines
    .map((l) => (l.cleared ? "▰" : l.vigourSpent > 0 ? "▱" : "▪"))
    .join("");
  const ending = result.out
    ? result.bossBeaten
      ? "out, and it is dead"
      : "out, and it is still down there"
    : `stopped on floor ${result.depth}`;
  return [
    `THE DEEP RUN ${date}`,
    ending,
    glyphs,
    `${result.score} of a possible ${par}`,
    "tavernparty.co.uk/daily/deeprun",
  ].join("\n");
}
