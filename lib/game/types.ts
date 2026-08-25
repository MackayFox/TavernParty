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
  /**
   * Kept with a Blood power rather than by taxing the party. A free Scar pays
   * out at the Ballad whatever your Renown, which is the whole reason anybody
   * drafts Thornborn: without it the power spends itself sparing the table one
   * point of Dread, in a game exactly one person wins.
   */
  free?: boolean;
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
  /**
   * Why the Renown moved by that much, named, in the order to read it.
   *
   * The roll side of this game never prints a bare total, and for a while the
   * consequence side always did: a Marked player who won a 3 Renown door read
   * "+5 Renown" with no line for the 2, and a Failing on a high-Dread scene read
   * "-8 Renown" where the door had said 2, with both doublings invisible. Same
   * doctrine, same shape: a list of named parts whose sum is the figure.
   */
  costMods: Modifier[];
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
  /**
   * Who has called their Signature into this Act, before it resolves.
   *
   * Public on purpose. A Chanter announcing "Everyone Joins In" is the loudest
   * thing that happens at the table all night, and knowing somebody has done it
   * should change whether you nominate them.
   */
  boosted: string[];
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
  /**
   * The last poll we heard from them.
   *
   * Separate from `disconnectedAt` on purpose, and the whole presence system was
   * dead without it. Every writer of a non-null `disconnectedAt` also set
   * `connected = false`, and every writer of `connected = true` nulled it, so the
   * old sweep's guard ("connected AND has a disconnect time") was unsatisfiable
   * and nothing in production ever marked anybody away.
   */
  lastSeenAt: number;
  callingId: string | null;
  bloodId: string | null;
  kitIds: string[];
  hookId: string | null;
  scores: Scores | null;
  renown: number;
  /** Refills only when your Hook is called against you. */
  hookTokens: number;
  scars: Scar[];
  /**
   * What buys you a look at a hidden number.
   *
   * Kit charges of kind `torch` AND kind `reveal` both land here, because a
   * torch and a cracked mirror buy exactly the same thing: the Reckless target.
   * Keeping them as separate resources would be two names for one mechanic.
   */
  torches: number;
  /** Kit charges of kind `reroll`. Spent to throw your own die again. */
  rerolls: number;
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
  /**
   * How many of those kept Scars actually paid, after the median gate.
   *
   * Carried rather than left to be derived, because subtracting Renown and
   * Laurels out of the total gets the Thornborn case wrong: a below-median
   * player with three kept Scars, one of them free, earns four and a screen
   * doing the arithmetic backwards prints "three Scars worn, paying twelve".
   */
  scarsPaid: number;
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
  /**
   * Scene ids this table has already played, across every round of the night.
   *
   * Kept so "Another round" is a new night rather than a shuffle of the same one:
   * a rematch used to repeat a scene 63% of the time because the deck was built
   * from the whole pool as though the table had never sat down.
   */
  seen?: string[];
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

/**
 * ONE APPROACH, AS A PLAYER IS ALLOWED TO SEE IT.
 *
 * The reason this type exists is a leak. `Act.tsx` and `Result.tsx` are client
 * components and they imported `SCENES_BY_ID`, so every scene in the game shipped
 * in the JavaScript bundle: all thirty of them, their win and lose prose, and
 * every hidden Reckless target number. The server redacted `recklessTn`
 * scrupulously and the UI honoured it, and the number was sitting in devtools the
 * whole time.
 *
 * That is not a cosmetic leak. Three things in this game SELL that number: the
 * Torch, Longshank's `seeOneReckless` and the Reckoner's Signature. A player who
 * opens the bundle gets all three for nothing, and CLAUDE.md's rule is "no answer
 * in a payload".
 *
 * So the scene comes down redacted, and the client has no content import to fall
 * back on. `tn` is null on the Reckless line until you have paid to see it, and
 * the win and lose prose does not come down at all: the outcome carries the line
 * that actually happened.
 */
export type ApproachView = {
  id: string;
  label: string;
  ability: Ability;
  /** Null on the Reckless line until this player has bought the number. */
  tn: number | null;
  deed: number;
  cost: { renown: number; dread: number };
  reckless: boolean;
  /**
   * What happened, sent only once the Act has resolved.
   *
   * Gated for the same reason the Deep Run gates a room's prose: it is the
   * outcome, and the outcome arrives when it happens. Before then the player has
   * the label and the promise, which is what they are choosing between.
   */
  win?: string;
  lose?: string;
};

/** The scene, with the answers taken out. */
export type SceneView = {
  id: string;
  title: string;
  setup: string;
  tags: string[];
  approaches: ApproachView[];
};

export type ActView = Omit<ActState, "choices"> & {
  /** Only your own choice, until the Act resolves. */
  myChoice: string | null;
  /** Who has committed, never what to. */
  committed: string[];
  /** The reckless target number, only if you paid to see it. */
  recklessTn: number | null;
  /**
   * The scene itself, redacted. Sent so that no client component has to import
   * `lib/content/scenes`, which is what put every hidden number in the bundle.
   */
  scene: SceneView;
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
