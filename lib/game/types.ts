/**
 * The contract everything type-checks against.
 *
 * Read docs/GAME_DESIGN.md before changing a rule, and put the number in
 * rules.ts rather than here. This file describes shape, never balance.
 */

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

/**
 * Six, because six is the shape people expect from this genre. Renamed, because
 * the names are ours: mechanics are not copyrightable but wording is, and
 * inventing the vocabulary costs nothing and brands better.
 */
export const ABILITIES = ["brawn", "deft", "grit", "wits", "nerve", "charm"] as const;
export type Ability = (typeof ABILITIES)[number];

export type Scores = Record<Ability, number>;

/** One named contribution to a roll. The whole narration budget lives here. */
export type Modifier = { label: string; value: number };

// ---------------------------------------------------------------------------
// Content: what you are
// ---------------------------------------------------------------------------

/** A once-per-run action granted by a Calling. */
export type Signature =
  | { kind: "rerollOwn"; label: string }
  | { kind: "addFive"; label: string }
  | { kind: "revealReckless"; label: string }
  | { kind: "shieldParty"; label: string }
  | { kind: "stealDeed"; label: string }
  | { kind: "takeScarFor"; label: string }
  | { kind: "secondApproach"; label: string }
  | { kind: "clearDread"; label: string };

/**
 * The identity choice, and the loudest one. Exclusive: one of each per table,
 * because being denied your first pick is what makes a draft a game.
 */
export type Calling = {
  id: string;
  /** ALL CAPS display name. */
  name: string;
  /** One line, in character. */
  blurb: string;
  /** The two abilities this Calling is good at, +2 each on a roll. */
  affinities: [Ability, Ability];
  signature: Signature;
  /** A named weakness. A scene carrying this tag hurts more. */
  failing: { tag: string; text: string };
};

/**
 * Bends the consequence economy rather than the arithmetic. Deliberately not a
 * bag of stat bonuses and deliberately not exclusive: the Calling is the
 * identity, this is the texture.
 */
export type BloodPower =
  | { kind: "freeHide" }
  | { kind: "costToDread" }
  | { kind: "reassignOne" }
  | { kind: "rerollFumble" }
  | { kind: "extraHookToken" }
  | { kind: "seeOneReckless" }
  | { kind: "keepScarFree" }
  | { kind: "dreadShield" };

export type Blood = {
  id: string;
  name: string;
  blurb: string;
  power: BloodPower;
  /** Plain words for what the power does, shown on the sheet. */
  powerText: string;
};

/** Exclusive, drafted second, in reverse priority. */
export type KitItem = {
  id: string;
  name: string;
  blurb: string;
  bonus: { ability: Ability; value: number } | null;
  /** A limited resource this item grants at the start of the run. */
  charge: { kind: "reroll" | "reveal" | "torch"; uses: number } | null;
};

/**
 * The background, and the reason it is not flavour text. See GAME_DESIGN §4:
 * it inserts a scene into everybody's night, its tokens refresh only when it is
 * used against you, and it makes you the publicly cheapest volunteer.
 */
export type Hook = {
  id: string;
  name: string;
  blurb: string;
  /** Guaranteed into the five-Act deck. Your background edits everyone's night. */
  insertTag: string;
  /** When a scene carries this, your Hook is called against you and refills. */
  callTag: string;
};

// ---------------------------------------------------------------------------
// Content: what happens
// ---------------------------------------------------------------------------

export type ApproachDef = {
  id: string;
  /** Imperative, in the fiction: "Force the door". */
  label: string;
  ability: Ability;
  /** Target number. Hidden from the client on the reckless line. */
  tn: number;
  /** Renown on success. */
  deed: number;
  /** What failing costs. */
  cost: { renown: number; dread: number };
  /** Exactly one approach per scene. Pays most, target number hidden. */
  reckless: boolean;
  /** One line each. Never states the numbers; the ledger does that. */
  win: string;
  lose: string;
};

export type Scene = {
  id: string;
  title: string;
  /** One or two sentences. The whole setup. */
  setup: string;
  tags: string[];
  approaches: [ApproachDef, ApproachDef, ApproachDef];
};

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

export type Phase =
  | "WAITING"
  /** The house array is rolled and the priority order published. */
  | "MUSTER"
  | "DRAFT_CALLING"
  | "DRAFT_KIT"
  /** Assign the six house numbers, and pick a Hook. */
  | "ASSIGN"
  /** Commit an Approach. May nominate. */
  | "ACT"
  /** The ledger, what nobody took, and keep-or-hide. */
  | "ACT_RESULT"
  /** Laurels. */
  | "BALLAD"
  | "FINAL";

/** A wound that is also an asset. `kept` is null until the player decides. */
export type Scar = {
  id: string;
  sceneId: string;
  /** Short, in the fiction: "a hand that will not close". */
  label: string;
  kept: boolean | null;
};

/**
 * A draft resolved by ranked simultaneous commit. Nobody waits: the tick grants
 * each player their highest surviving want in priority order.
 */
export type DraftState = {
  /** Ids still available. */
  pool: string[];
  /** playerId -> up to three ranked ids. Redacted from other players. */
  wants: Record<string, string[]>;
  /** playerId -> granted id, once resolved. */
  granted: Record<string, string>;
};

export type Outcome = {
  playerId: string;
  /** An approach id, or "flinch" for the deadline default. */
  approachId: string;
  /** The face. 0 when flinched, because no die was thrown. */
  roll: number;
  /** Every named contribution, in the order it should be read out. */
  mods: Modifier[];
  total: number;
  tn: number;
  success: boolean;
  renownDelta: number;
  dreadDelta: number;
  scar: Scar | null;
  /** Their Hook was called against them, so its tokens refilled. */
  hookRefilled: boolean;
};

export type ActState = {
  /** 1-based. */
  index: number;
  sceneId: string;
  /** Whose Hook tags this scene carries. Public, and it is a target. */
  marked: string[];
  /** nominatorId -> nomineeId. Public once the Act resolves. */
  nominations: Record<string, string>;
  /** playerId -> approach id, or "flinch". Redacted until the Act resolves. */
  choices: Record<string, string>;
  /** playerId -> Hook tokens they chose to spend on it. */
  spend: Record<string, number>;
  /**
   * Who committed, in the order they did it.
   *
   * The Reckless line is one door and only one player goes through it, so a
   * clash needs a deterministic winner. The quicker hand takes it, which is both
   * the fairest rule available and the one that narrates itself: you both
   * reached for it in the dark.
   */
  order: string[];
  /** Players who paid to see the reckless target number. */
  revealed: string[];
  outcomes: Outcome[] | null;
};

export type PlayerStats = {
  actsTaken: number;
  recklessTaken: number;
  flinches: number;
  scarsKept: number;
  scarsHidden: number;
  crits: number;
};

export type Player = {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  callingId: string | null;
  bloodId: string | null;
  kitIds: string[];
  hookId: string | null;
  scores: Scores | null;
  renown: number;
  /** Refills only when your Hook is called against you. */
  hookTokens: number;
  scars: Scar[];
  torches: number;
  usedSignature: boolean;
  usedBloodPower: boolean;
  /** Secret until the Ballad resolves. Never yourself. */
  laurelFor: string | null;
  stats: PlayerStats;
};

export type RoomSettings = {
  /** 2..6 */
  maxPlayers: number;
  /** How many Acts the run is. Five unless somebody chose otherwise. */
  acts: number;
  /** Seconds on an Act's commit window. */
  actSeconds: number;
  visibility: "public" | "private";
};

export type LogEntry = {
  at: number;
  kind: "draft" | "roll" | "scar" | "dread" | "laurel" | "system";
  /** Already-formatted, player-facing text. */
  text: string;
  playerId?: string;
};

export type Standing = {
  playerId: string;
  name: string;
  renown: number;
  keptScars: number;
  laurels: number;
  /** The final figure, after the median gate and the laurels. */
  total: number;
  /** 1-based; exact ties share a placement. */
  placement: number;
  /** Exactly one player takes it. */
  hoard: boolean;
};

export type Room = {
  code: string;
  name: string;
  visibility: "public" | "private";
  createdAt: number;
  version: number;
  phase: Phase;
  /** Epoch ms. Null means no deadline, which only happens at FINAL. */
  phaseEndsAt: number | null;
  players: Player[];
  settings: RoomSettings;
  /** Six numbers, rolled once for the whole room. Everybody assigns these. */
  houseArray: number[] | null;
  /** Draft priority. Reversed for the Kit draft. */
  priority: string[];
  callingDraft: DraftState | null;
  kitDraft: DraftState | null;
  /** The five scenes, fixed once Hooks are known so Inserts can be honoured. */
  deck: string[];
  act: ActState | null;
  /** Collective. Keeping a Scar taxes the whole party. */
  dread: number;
  log: LogEntry[];
  standings?: Standing[];
};

// ---------------------------------------------------------------------------
// The redacted view
// ---------------------------------------------------------------------------

export type PlayerView = Omit<Player, "laurelFor" | "scars"> & {
  /** Other players' hidden Scars are counted, never listed. */
  scars: Scar[];
  hiddenScarCount: number;
  /** Whether they have voted, never who for. */
  hasVoted: boolean;
};

export type DraftView = {
  pool: string[];
  /** Only your own ranked wants come back. */
  myWants: string[];
  /** Who has committed, never what to. */
  committed: string[];
  granted: Record<string, string>;
};

export type ActView = Omit<ActState, "choices"> & {
  /** Only your own choice, until the Act resolves. */
  myChoice: string | null;
  /** Who has committed, never what to. */
  committed: string[];
  /** The reckless target number, only if you paid to see it. */
  recklessTn: number | null;
};

export type RoomView = Omit<
  Room,
  "players" | "callingDraft" | "kitDraft" | "act" | "deck"
> & {
  players: PlayerView[];
  callingDraft: DraftView | null;
  kitDraft: DraftView | null;
  act: ActView | null;
  /** Never the whole deck: only what has been faced, plus the current scene. */
  seenScenes: string[];
  me: {
    /** "" for a spectator who has not joined. */
    id: string;
    scars: Scar[];
    /** Yours only. */
    laurelFor: string | null;
    canAct: boolean;
  };
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The only error the engine ever throws.
 *
 * `code` drives the HTTP status in lib/api.ts and is matched on by the client,
 * so treat the codes as part of the public API: `not_found` becomes a 404,
 * `internal` a 500, everything else a 400 with the message shown to the player.
 */
export class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}
