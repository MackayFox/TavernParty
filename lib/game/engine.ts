/**
 * TAVERN PARTY — game engine.
 *
 * Pure TypeScript. No React, no I/O, no imports from `app/` or `next/*`. The
 * server owns every outcome and clients render the redacted view this module
 * produces and nothing else. Every mutation goes through an exported action that
 * validates membership, phase and deadline, and throws `GameError`.
 *
 * All randomness is injected (`rng`) so tests can pin every die and every deal.
 *
 * The phase machine, in the order a run actually happens:
 *
 *   WAITING -> MUSTER -> DRAFT_CALLING -> DRAFT_KIT -> ASSIGN
 *     -> per Act:  ACT -> ACT_RESULT
 *   -> BALLAD -> FINAL
 *
 * Nothing ever waits on a specific human. Every phase resolves on its deadline
 * whether or not everybody acted, and the default is always a real move rather
 * than a skip, so a closed tab is a problem the table can see rather than a
 * phase that hangs. It also resolves the moment nobody is left to wait for: see
 * `everybodyIn`, which is the other half of the same promise.
 */
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES, SCENES_BY_ID } from "@/lib/content/scenes";
import { buildDeck, markedBy, worstUnseen } from "./deck";
import { freshDraft, normaliseWants, resolveDraft, reversePriority } from "./draft";
import { d20, pick, rollScore, shuffle, type Rng, defaultRng } from "./random";
import { costMultiplier, flinch, rollApproach } from "./resolve";
import {
  ARRAY_DICE,
  ARRAY_DROP,
  ARRAY_SIZE,
  AFFINITY_BONUS,
  ASHKIN_DREAD,
  DEFAULT_SETTINGS,
  DREAD_RELIEF,
  EMBERKIN_RENOWN,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  FUMBLE,
  HEARTBEAT_PERSIST_MS,
  HIDE_SCAR_RENOWN,
  HOOK_TOKENS_MAX,
  HOST_MIGRATION_GRACE_MS,
  KEEP_SCAR_DREAD,
  LOG_MAX,
  MARK_BONUS,
  MARK_FLINCH_PENALTY,
  MAX_ACTS,
  MAX_PLAYERS,
  MIN_ACTS,
  MIN_PLAYERS,
  NOMINATION_PENALTY,
  NOMINATION_SHARE,
  PRESENCE_TIMEOUT_MS,
  REVEAL_COST_TORCHES,
  SCARCITY_FLOOR_PLAYERS,
  SIGNATURE_BOOST,
  SIGNATURE_CLEAR_DREAD,
  SIGNATURE_OATH_RENOWN,
  SIGNATURE_STEAL_SHARE,
  TIMINGS,
  abilityMod,
  dreadThresholds,
} from "./rules";
import { median, standingsFor } from "./scoring";
import {
  ABILITIES,
  GameError,
  type Ability,
  type ActState,
  type Blood,
  type Calling,
  type DraftState,
  type Hook,
  type KitItem,
  type LogEntry,
  type Outcome,
  type Phase,
  type Player,
  type PlayerView,
  type Room,
  type RoomSettings,
  type RoomView,
  type Scene,
  type Scores,
} from "./types";

export { TIMINGS, MIN_PLAYERS, MAX_PLAYERS };

// ---------------------------------------------------------------------------
// Small internals
// ---------------------------------------------------------------------------

const CALLING_BY_ID = new Map(CALLINGS.map((c) => [c.id, c]));
const BLOOD_BY_ID = new Map(BLOODS.map((b) => [b.id, b]));
const KIT_BY_ID = new Map(KIT.map((k) => [k.id, k]));
const HOOK_BY_ID = new Map(HOOKS.map((h) => [h.id, h]));

function touch(room: Room): void {
  room.version++;
}

function note(room: Room, kind: LogEntry["kind"], text: string, playerId?: string): void {
  room.log.unshift({ at: Date.now(), kind, text, playerId });
  if (room.log.length > LOG_MAX) room.log.length = LOG_MAX;
}

export function findPlayer(room: Room, id: string): Player | undefined {
  return room.players.find((p) => p.id === id);
}

function requirePlayer(room: Room, playerId: string): Player {
  const p = findPlayer(room, playerId);
  if (!p) throw new GameError("not_in_room", "You are not at this table.");
  return p;
}

/**
 * What the table would call the beat it is on, mid-sentence.
 *
 * Deliberately not imported from `components/room/shared.tsx`, which keeps the
 * same list for its headings: the engine imports nothing from `components/` or
 * `app/`, and that rule is worth more than nine deduplicated words. Typed
 * `Record<Phase, string>`, so a tenth phase cannot be added without one.
 */
const PHASE_NOW: Record<Phase, string> = {
  WAITING: "waiting to start",
  MUSTER: "reading the array",
  DRAFT_CALLING: "picking Callings",
  DRAFT_KIT: "picking kit",
  ASSIGN: "making characters",
  ACT: "in the Act",
  ACT_RESULT: "reading the ledger",
  BALLAD: "on the ballad",
  FINAL: "finished for the night",
};

/**
 * The commonest error a real player sees, and it used to say nothing at all.
 *
 * Every beat has a deadline and every client polls at 2.5s, so a press that lands
 * in the last second of one arrives after somebody else's poll has already
 * resolved it. Six players times seven beats a night means somebody meets this on
 * most runs, and "That is not what is happening right now" left them unable to
 * tell whether their move had landed, whether they had just flinched, or whether
 * the table was broken. It has to say both halves: that the press did not land,
 * and where the table actually is.
 *
 * The opening clause is kept close to the old wording on purpose: two suites match
 * this message on /happening/i and /right now/i, and neither owns anything that
 * would change if the sentence were reflowed, so there is nothing to be gained by
 * making them fail.
 */
function requirePhase(room: Room, ...phases: Phase[]): void {
  if (!phases.includes(room.phase))
    throw new GameError(
      "wrong_phase",
      `That is not happening right now. The table is ${PHASE_NOW[room.phase]}, so your move did not land.`
    );
}

function callingOf(p: Player): Calling | undefined {
  return p.callingId ? CALLING_BY_ID.get(p.callingId) : undefined;
}
function bloodOf(p: Player): Blood | undefined {
  return p.bloodId ? BLOOD_BY_ID.get(p.bloodId) : undefined;
}
function hookOf(p: Player): Hook | undefined {
  return p.hookId ? HOOK_BY_ID.get(p.hookId) : undefined;
}
function kitOf(p: Player): KitItem[] {
  return p.kitIds.map((id) => KIT_BY_ID.get(id)).filter((k): k is KitItem => !!k);
}

/**
 * What a player actually brings to one ability: the score, what their Calling is
 * trained for, and what they are carrying.
 *
 * Exists because three places were sorting on the bare ability modifier and
 * therefore disagreeing with the Act screen, which has always shown the full
 * figure: the bot's door choice, the fallback for a player bumped off the
 * Reckless line, and nothing else. A "best door" that ignores training and Kit is
 * not the best door.
 */
/** The Dread thresholds for THIS table. Scale with head count; see rules.ts. */
function dreadOf(room: Room): { double: number; turn: number; max: number } {
  return dreadThresholds(room.players.length);
}

function reachOn(p: Player, ability: Ability): number {
  let total = abilityMod(p.scores?.[ability] ?? 10);
  const calling = callingOf(p);
  if (calling?.affinities.includes(ability)) total += AFFINITY_BONUS;
  for (const item of kitOf(p)) {
    if (item.bonus?.ability === ability) total += item.bonus.value;
  }
  return total;
}

/** Players who count as present for auto-play and "everybody is done" checks. */
function isPresent(p: Player, now: number): boolean {
  return p.isBot || p.connected || now - (p.disconnectedAt ?? now) < HOST_MIGRATION_GRACE_MS;
}

/**
 * Chairs somebody is actually in. What the lobby and the matchmaker count.
 *
 * `sweepPresence` has maintained `connected` for a while and NOTHING read it, so
 * every count in the product was seats instead. Nothing removes a player from a
 * WAITING table when their tab closes (`leave` is a press somebody has to make,
 * and the sweep only marks them away), so a seat is held by a closed tab until the
 * thirty-minute reaper takes the whole table. Live, that meant /tables advertising
 * twenty tables with nobody at any of them, and Quick Match sorting fullest-first
 * walked every arrival into the most thoroughly abandoned one.
 *
 * A bot counts. It is not company, but it is in the chair, so a table showing four
 * of six has two chairs and the number under it has to be the one you cannot sit
 * in. A human we have not heard from does not count, and `join` will take their
 * chair for somebody who is here.
 */
export function occupiedSeats(room: Room): number {
  return room.players.filter((p) => p.isBot || p.connected).length;
}

function freshPlayer(
  id: string,
  name: string,
  isHost: boolean,
  isBot = false,
  now = 0
): Player {
  return {
    id,
    name,
    isHost,
    isBot,
    connected: true,
    disconnectedAt: null,
    lastSeenAt: now,
    callingId: null,
    bloodId: null,
    kitIds: [],
    hookId: null,
    scores: null,
    renown: 0,
    hookTokens: HOOK_TOKENS_MAX,
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
 * How big a scarce pool has to be.
 *
 * Floored at the four-player size whatever the table size, so a duo still gets
 * denied things. See GAME_DESIGN §8: a mitigation, not a fix.
 */
function poolSize(playerCount: number): number {
  return Math.max(playerCount, SCARCITY_FLOOR_PLAYERS);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function createRoom(
  opts: {
    code: string;
    name: string;
    visibility: "public" | "private";
    settings?: Partial<RoomSettings>;
  },
  now: number
): Room {
  const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...opts.settings };
  if (settings.maxPlayers < MIN_PLAYERS || settings.maxPlayers > MAX_PLAYERS)
    throw new GameError(
      "bad_settings",
      `A table seats between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`
    );
  if (settings.acts < MIN_ACTS || settings.acts > MAX_ACTS)
    throw new GameError("bad_settings", `A run is between ${MIN_ACTS} and ${MAX_ACTS} Acts.`);

  return {
    code: opts.code.toUpperCase(),
    name: opts.name,
    visibility: opts.visibility,
    createdAt: now,
    version: 0,
    phase: "WAITING",
    phaseEndsAt: null,
    players: [],
    settings,
    houseArray: null,
    priority: [],
    callingDraft: null,
    kitDraft: null,
    deck: [],
    act: null,
    dread: 0,
    log: [],
  };
}

export function join(room: Room, who: { id: string; name: string }, now: number): void {
  const existing = findPlayer(room, who.id);
  if (existing) {
    // A rejoin, not a duplicate.
    existing.connected = true;
    existing.disconnectedAt = null;
    touch(room);
    return;
  }
  if (room.phase !== "WAITING")
    throw new GameError("in_progress", "This run has already started.");
  const name = who.name.trim().toUpperCase();
  if (!name) throw new GameError("bad_name", "Put a name to your character first.");

  /**
   * A full table gives up a chair nobody is sitting in, rather than refusing
   * everybody. Checked after the name, so an invalid join never costs a chair.
   *
   * This is the other half of counting live humans: the lobby stopped counting
   * ghost seats, so it now advertises a table as open that a seat count would
   * call full, and the door has to agree with the sign. Six closed tabs used to
   * make a table that was advertised, refused everybody, and could never be
   * started, and it stayed that way for half an hour.
   *
   * The chair taken is the one belonging to whoever we have heard from least
   * recently, and only once they are past even the host-migration grace, so a
   * player mid-refresh keeps their seat. Nothing is lost with it: WAITING is
   * before the array is rolled, so there is no sheet, no Renown and no Scars.
   */
  if (room.players.length >= room.settings.maxPlayers) {
    const ghost = room.players
      .filter((p) => !p.isBot && !isPresent(p, now))
      .sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];
    if (!ghost) throw new GameError("full", "That table is full.");
    room.players = room.players.filter((p) => p.id !== ghost.id);
    note(room, "system", `${ghost.name} is not coming back, and the chair is wanted`);
  }

  room.players.push(
    freshPlayer(
      who.id,
      name.slice(0, 20),
      // Host if nobody human is already, not merely if the table is empty: a
      // table of nothing but bots has no valid host and needs one.
      !room.players.some((p) => !p.isBot),
      false,
      now
    )
  );
  ensureHumanHost(room);
  note(room, "system", `${name} pulls up a chair`, who.id);
  touch(room);
}

/**
 * THE INVARIANT: a table with a human at it has a human host.
 *
 * Breaking it killed tables dead. `leave` handed the chair to `players[0]` with
 * no check that it was a person, so the common sequence (sit down, add a
 * stranger, decide not to play) left a BOT holding the host role. `startRun`,
 * `rematch` and `removeBot` are all host-only, so the next person to arrive could
 * not start it, could not restart it, and could not even evict the bot squatting
 * in the chair. The room stayed public and WAITING, and Quick Match sorts by
 * fullest first, so it was the table the next player got sent to.
 *
 * Repairs in place rather than migrating, so rows already in that state fix
 * themselves on the next tick.
 */
function ensureHumanHost(room: Room): void {
  // A bot never holds the flag, even alongside a valid human host: a stale
  // isHost on a stranger is a second host, and "the host" is a find() away from
  // being whichever of them happens to sit earlier in the array.
  for (const p of room.players) if (p.isBot) p.isHost = false;

  const hosts = room.players.filter((p) => p.isHost);
  if (hosts.length === 1) return;
  // Zero (or somehow several): the earliest human seated takes it, so the result
  // does not depend on iteration order.
  const heir = hosts[0] ?? room.players.find((p) => !p.isBot);
  if (!heir) return;
  for (const p of room.players) p.isHost = false;
  heir.isHost = true;
}

export function leave(room: Room, playerId: string, now = Date.now()): void {
  const p = findPlayer(room, playerId);
  if (!p) return;
  if (room.phase === "WAITING") {
    room.players = room.players.filter((x) => x.id !== playerId);
    // Nobody human left means nobody is coming back: clear the bots out rather
    // than leaving a public table of strangers for Quick Match to send people to.
    if (!room.players.some((x) => !x.isBot)) room.players = [];
    else ensureHumanHost(room);
    note(room, "system", `${p.name} thinks better of it`);
  } else {
    // Mid-run the record stays: their Scars and Renown are part of the night.
    p.connected = false;
    // The injected clock, not the wall clock. This was the one mutation in the
    // engine reading Date.now() directly, which made it untestable against a
    // pinned `now` and inconsistent with every presence check around it.
    p.disconnectedAt = now;
    note(room, "system", `${p.name} steps outside`, p.id);
  }
  touch(room);
}

export function addBot(room: Room, hostId: string, now: number, rng: Rng = defaultRng): void {
  requirePhase(room, "WAITING");
  const host = requirePlayer(room, hostId);
  if (!host.isHost) throw new GameError("not_host", "Only the host can do that.");
  if (room.players.length >= room.settings.maxPlayers)
    throw new GameError("full", "That table is full.");
  const taken = new Set(room.players.map((p) => p.name));
  const names = ["OLD MARGET", "TALL FEN", "SIX-FINGER", "WET HARRY", "THE COUSIN", "BRAY"];
  const free = names.filter((n) => !taken.has(n));
  const name = pick(free, rng) ?? `STRANGER ${room.players.length}`;
  room.players.push(
    freshPlayer(`bot_${room.players.length}_${name.replace(/\W/g, "")}`, name, false, true, now)
  );
  note(room, "system", `${name} is already sitting there`);
  touch(room);
}

export function removeBot(room: Room, hostId: string, botId: string): void {
  requirePhase(room, "WAITING");
  const host = requirePlayer(room, hostId);
  if (!host.isHost) throw new GameError("not_host", "Only the host can do that.");
  room.players = room.players.filter((p) => !(p.id === botId && p.isBot));
  touch(room);
}

export function setConnected(room: Room, playerId: string, connected: boolean, now: number): void {
  const p = findPlayer(room, playerId);
  if (!p || p.connected === connected) return;
  p.connected = connected;
  p.disconnectedAt = connected ? null : now;
  touch(room);
}

/** A poll. Bumps the version only rarely, so a heartbeat is not a write storm. */
export function heartbeat(room: Room, playerId: string, now: number): void {
  const p = findPlayer(room, playerId);
  if (!p) return;
  const wasAway = !p.connected;
  const since = now - p.lastSeenAt;
  p.connected = true;
  p.disconnectedAt = null;
  p.lastSeenAt = now;
  /**
   * The persist condition was measured against the ROOM's age, so twenty seconds
   * after a table was created a heartbeat stopped bumping the version forever.
   * Two consequences, both bad: `lastSeenAt` would never have reached the
   * database, and `updated_at` froze, so the thirty-minute reaper deleted lobbies
   * out from under people who were sitting in them.
   *
   * Now it is measured against the PLAYER's own clock, at a third of the timeout,
   * so it is at most one write per player per few seconds and it is bounded by the
   * thing it is actually for.
   */
  if (wasAway || since > PRESENCE_TIMEOUT_MS / 3 || since > HEARTBEAT_PERSIST_MS) touch(room);
}

/**
 * Mark anybody we have not heard from as away.
 *
 * This used to be unreachable. It required `connected === true` AND a non-null
 * `disconnectedAt`, and no code path in the repo could produce that pair: every
 * writer of a disconnect time also cleared `connected`, and every writer of
 * `connected` cleared the time. So the Away pill never lit, host migration never
 * fired, and PRESENCE_TIMEOUT_MS and HOST_MIGRATION_GRACE_MS were dead constants.
 * A closed tab kept the host chair forever, and `startRun` and `rematch` are both
 * host-only, so a table could be permanently unstartable.
 *
 * It reads `lastSeenAt` now, which is the thing a poll actually updates.
 */
export function sweepPresence(room: Room, now: number): void {
  for (const p of room.players) {
    if (p.isBot || !p.connected) continue;
    if (now - p.lastSeenAt > PRESENCE_TIMEOUT_MS) {
      p.connected = false;
      p.disconnectedAt = p.lastSeenAt;
      note(room, "system", `${p.name} has stopped answering`, p.id);
      touch(room);
    }
  }
}

export function maybeMigrateHost(room: Room, now: number): boolean {
  // Heals a table whose host is a bot before anything else looks at it. A bot is
  // always `isPresent`, so a bot host could never be migrated away from.
  const humanHosted = room.players.some((p) => p.isHost && !p.isBot);
  if (!humanHosted && room.players.some((p) => !p.isBot)) {
    ensureHumanHost(room);
    touch(room);
    return true;
  }
  const host = room.players.find((p) => p.isHost);
  if (!host || isPresent(host, now)) return false;
  const heir = room.players.find((p) => !p.isBot && isPresent(p, now));
  if (!heir) return false;
  host.isHost = false;
  heir.isHost = true;
  note(room, "system", `${heir.name} is buying the next round`, heir.id);
  touch(room);
  return true;
}

// ---------------------------------------------------------------------------
// Starting the run
// ---------------------------------------------------------------------------

export function startRun(room: Room, playerId: string, now: number, rng: Rng = defaultRng): void {
  requirePhase(room, "WAITING");
  const p = requirePlayer(room, playerId);
  if (!p.isHost) throw new GameError("not_host", "Only the host can start it.");
  if (room.players.length < MIN_PLAYERS)
    throw new GameError("too_few", `You need at least ${MIN_PLAYERS} at the table.`);

  // One array, rolled once, assigned by everybody. See GAME_DESIGN §3.1.
  room.houseArray = Array.from({ length: ARRAY_SIZE }, () =>
    rollScore(ARRAY_DICE, ARRAY_DROP, rng)
  ).sort((a, b) => b - a);

  room.priority = shuffle(
    room.players.map((x) => x.id),
    rng
  );

  // Bloods are not scarce, so they are dealt rather than drafted: it keeps the
  // Calling the loudest choice and saves a whole phase.
  const bloods = shuffle(BLOODS, rng);
  room.players.forEach((player, i) => {
    player.bloodId = bloods[i % bloods.length].id;
  });

  room.phase = "MUSTER";
  room.phaseEndsAt = now + TIMINGS.musterMs;
  note(room, "system", `The array is rolled: ${room.houseArray.join(", ")}`);
  touch(room);
}

function beginCallingDraft(room: Room, now: number, rng: Rng): void {
  const size = poolSize(room.players.length);
  room.callingDraft = freshDraft(shuffle(CALLINGS, rng).slice(0, Math.max(size, 4)).map((c) => c.id));
  room.phase = "DRAFT_CALLING";
  room.phaseEndsAt = now + TIMINGS.draftCallingMs;
  touch(room);
}

function beginKitDraft(room: Room, now: number, rng: Rng): void {
  const size = poolSize(room.players.length);
  room.kitDraft = freshDraft(shuffle(KIT, rng).slice(0, Math.max(size + 2, 6)).map((k) => k.id));
  room.phase = "DRAFT_KIT";
  room.phaseEndsAt = now + TIMINGS.draftKitMs;
  touch(room);
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

function activeDraft(room: Room): DraftState {
  const draft = room.phase === "DRAFT_CALLING" ? room.callingDraft : room.kitDraft;
  if (!draft) throw new GameError("wrong_phase", "There is nothing to choose right now.");
  return draft;
}

export function submitWants(
  room: Room,
  playerId: string,
  wants: readonly string[],
  now: number
): void {
  requirePhase(room, "DRAFT_CALLING", "DRAFT_KIT");
  if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
    throw new GameError("too_late", "That window has closed.");
  requirePlayer(room, playerId);
  const draft = activeDraft(room);
  draft.wants[playerId] = normaliseWants(wants, draft.pool);
  touch(room);
}

function applyCallingDraft(room: Room, now: number, rng: Rng): void {
  const draft = room.callingDraft;
  if (!draft) return;
  for (const p of room.players) {
    if (p.isBot && !draft.wants[p.id]) {
      draft.wants[p.id] = shuffle(draft.pool, rng).slice(0, 2);
    }
  }
  draft.granted = resolveDraft(draft, room.priority);
  for (const [pid, id] of Object.entries(draft.granted)) {
    const p = findPlayer(room, pid);
    if (!p) continue;
    p.callingId = id;
    note(room, "draft", `${p.name} is the ${CALLING_BY_ID.get(id)?.name ?? id}`, pid);
  }
  beginKitDraft(room, now, rng);
}

function applyKitDraft(room: Room, now: number, rng: Rng): void {
  const draft = room.kitDraft;
  if (!draft) return;
  for (const p of room.players) {
    if (p.isBot && !draft.wants[p.id]) {
      draft.wants[p.id] = shuffle(draft.pool, rng).slice(0, 2);
    }
  }
  // Reverse: first crack at the Calling buys last crack at the gear.
  draft.granted = resolveDraft(draft, reversePriority(room.priority));
  for (const [pid, id] of Object.entries(draft.granted)) {
    const p = findPlayer(room, pid);
    if (!p) continue;
    p.kitIds = [id];
    const item = KIT_BY_ID.get(id);
    // Both `torch` and `reveal` charges buy the same thing (a look at the
    // Reckless number), so they land in the same pocket rather than being two
    // names for one mechanic. `reroll` charges are their own resource because
    // they buy something genuinely different.
    if (item?.charge?.kind === "torch" || item?.charge?.kind === "reveal")
      p.torches += item.charge.uses;
    if (item?.charge?.kind === "reroll") p.rerolls += item.charge.uses;
    note(room, "draft", `${p.name} takes the ${item?.name.toLowerCase() ?? id}`, pid);
  }
  room.phase = "ASSIGN";
  room.phaseEndsAt = now + TIMINGS.assignMs;
  touch(room);
}

// ---------------------------------------------------------------------------
// Assigning the array, and choosing a Hook
// ---------------------------------------------------------------------------

function defaultScores(room: Room, p: Player): Scores {
  const array = [...(room.houseArray ?? [])].sort((a, b) => b - a);
  const calling = callingOf(p);
  // Best numbers to what you are trained for, then down the standard order.
  const order: Ability[] = calling
    ? [...calling.affinities, ...ABILITIES.filter((a) => !calling.affinities.includes(a))]
    : [...ABILITIES];
  const scores = {} as Scores;
  order.forEach((ability, i) => {
    scores[ability] = array[i] ?? 10;
  });
  return scores;
}

export function assign(
  room: Room,
  playerId: string,
  scores: Scores,
  hookId: string,
  now: number
): void {
  requirePhase(room, "ASSIGN");
  if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
    throw new GameError("too_late", "That window has closed.");
  const p = requirePlayer(room, playerId);
  if (!HOOK_BY_ID.has(hookId)) throw new GameError("bad_hook", "No such history.");

  // The array is the array: you may rearrange it, never rewrite it.
  const wanted = ABILITIES.map((a) => scores[a]).sort((x, y) => x - y);
  const allowed = [...(room.houseArray ?? [])].sort((x, y) => x - y);
  if (wanted.length !== allowed.length || wanted.some((v, i) => v !== allowed[i]))
    throw new GameError("bad_scores", "Those are not the numbers the house rolled.");

  p.scores = { ...scores };
  p.hookId = hookId;
  touch(room);
}

function beginRun(room: Room, now: number, rng: Rng): void {
  for (const p of room.players) {
    if (!p.scores) p.scores = defaultScores(room, p);
    if (!p.hookId) p.hookId = (pick(HOOKS, rng) ?? HOOKS[0]).id;
    // Tideborn. A starting bonus and not a raised ceiling: a Hook that gets
    // called still refills to HOOK_TOKENS_MAX, so the extra token is genuinely
    // one extra token and the only decision is when to spend it.
    if (bloodOf(p)?.power.kind === "extraHookToken") p.hookTokens += 1;
  }
  const hooks = room.players.map((p) => hookOf(p)).filter((h): h is Hook => !!h);
  room.deck = buildDeck(
    { scenes: SCENES, hooks, acts: room.settings.acts, seen: room.seen },
    rng
  );
  note(room, "system", "The night starts properly");
  beginAct(room, 1, now, rng);
}

// ---------------------------------------------------------------------------
// An Act
// ---------------------------------------------------------------------------

function sceneFor(room: Room, index: number): Scene {
  const id = room.deck[index - 1];
  return SCENES_BY_ID[id] ?? SCENES[0];
}

function beginAct(room: Room, index: number, now: number, rng: Rng): void {
  let scene = sceneFor(room, index);

  /**
   * The Night turns. At the threshold the last Act comes from a worse deck,
   * which means the hardest scene nobody has faced. Decided here rather than at
   * deal time because Dread is not knowable when the deck is built.
   */
  if (index === room.settings.acts && room.dread >= dreadOf(room).turn) {
    // Everything this TABLE has faced, not just this round's deck, so three
    // rounds in a row do not all end on the same scene.
    const faced = [...(room.seen ?? []), ...room.deck.slice(0, index - 1)];
    const worse = worstUnseen(SCENES, faced, rng);
    if (worse) {
      scene = worse;
      room.deck[index - 1] = worse.id;
      note(room, "dread", "The night turns. Whatever is next is worse.");
    }
  }

  room.act = {
    index,
    sceneId: scene.id,
    marked: markedBy(scene, room.players, HOOKS),
    nominations: {},
    choices: {},
    spend: {},
    order: [],
    revealed: [],
    boosted: [],
    outcomes: null,
  };
  room.phase = "ACT";
  room.phaseEndsAt = now + TIMINGS.actMs;
  note(room, "system", `Act ${index}: ${scene.title}`);
  touch(room);
}

export function commitApproach(
  room: Room,
  playerId: string,
  approachId: string,
  spendTokens: number,
  now: number
): void {
  requirePhase(room, "ACT");
  if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
    throw new GameError("too_late", "You left it too long.");
  const p = requirePlayer(room, playerId);
  const act = room.act;
  if (!act) throw new GameError("wrong_phase", "Nothing is happening.");
  if (act.choices[playerId]) throw new GameError("already", "You have already moved.");

  const scene = SCENES_BY_ID[act.sceneId];
  if (!scene.approaches.some((a) => a.id === approachId))
    throw new GameError("bad_choice", "That is not one of the ways through.");

  act.choices[playerId] = approachId;
  act.spend[playerId] = Math.max(0, Math.min(Math.floor(spendTokens), p.hookTokens));
  act.order.push(playerId);
  touch(room);
}

export function nominate(room: Room, playerId: string, nomineeId: string, now: number): void {
  requirePhase(room, "ACT");
  // The module docblock promises every action validates the deadline, and these
  // two were the exceptions: they took a `now` and never read it.
  if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
    throw new GameError("too_late", "You left it too long.");
  requirePlayer(room, playerId);
  requirePlayer(room, nomineeId);
  if (playerId === nomineeId)
    throw new GameError("bad_target", "Volunteering is not nominating.");
  const act = room.act;
  if (!act) throw new GameError("wrong_phase", "Nothing is happening.");
  act.nominations[playerId] = nomineeId;
  touch(room);
}

export function revealReckless(room: Room, playerId: string, now: number): void {
  requirePhase(room, "ACT");
  if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
    throw new GameError("too_late", "You left it too long.");
  const p = requirePlayer(room, playerId);
  const act = room.act;
  if (!act) throw new GameError("wrong_phase", "Nothing is happening.");
  if (act.revealed.includes(playerId)) return;

  // Longshank reads the ground ahead once for nothing. Spent automatically the
  // first time they look, because the alternative is a confirmation dialog
  // asking whether they would like the free thing.
  const free = bloodOf(p)?.power.kind === "seeOneReckless" && !p.usedBloodPower;
  if (free) {
    p.usedBloodPower = true;
  } else {
    if (p.torches < REVEAL_COST_TORCHES)
      throw new GameError("no_torch", "You have nothing left to burn.");
    p.torches -= REVEAL_COST_TORCHES;
  }
  act.revealed.push(playerId);
  touch(room);
}

/**
 * Put one outcome into the world.
 *
 * The deltas are rewritten to what actually landed after the clamps at zero
 * Renown and at DREAD_MAX. Two reasons: the ledger should show what happened
 * rather than what was intended, and anything that refunds a cost later has to
 * refund the amount that was really taken.
 *
 * Nominations are settled before this runs, against the intended deed, which is
 * right: your cut is of the job, not of somebody else's empty purse.
 */
function applyOutcome(room: Room, out: Outcome, scene: Scene): void {
  const p = findPlayer(room, out.playerId);
  if (!p) return;
  const renownBefore = p.renown;
  const dreadBefore = room.dread;
  p.renown = Math.max(0, p.renown + out.renownDelta);
  room.dread = Math.min(dreadOf(room).max, room.dread + out.dreadDelta);
  const applied = p.renown - renownBefore;
  // A player with nothing cannot lose anything, and the itemised list has to say
  // so rather than quietly disagreeing with the figure underneath it.
  if (applied !== out.renownDelta) {
    out.costMods.push({
      label: applied > out.renownDelta ? "there was nothing left to take" : "the books would not carry it",
      value: applied - out.renownDelta,
    });
  }
  out.renownDelta = applied;
  out.dreadDelta = room.dread - dreadBefore;
  if (out.scar) p.scars.push(out.scar);
  if (out.hookRefilled) p.hookTokens = HOOK_TOKENS_MAX;
  const approach = scene.approaches.find((a) => a.id === out.approachId);
  note(
    room,
    out.success ? "roll" : "scar",
    `${p.name}: ${approach ? (out.success ? approach.win : approach.lose) : "did not move"}`,
    p.id
  );
}

/**
 * Take one outcome back out of the world, so it can be rolled again.
 *
 * Exact, because `applyOutcome` stored the clamped figures rather than the
 * intended ones. The caller must refuse if the Scar has already been decided:
 * un-deciding somebody's keep-or-hide would silently reverse a Dread charge the
 * whole table has already seen.
 */
function unapplyOutcome(room: Room, out: Outcome): void {
  const p = findPlayer(room, out.playerId);
  if (!p) return;
  p.renown = Math.max(0, p.renown - out.renownDelta);
  room.dread = Math.max(0, room.dread - out.dreadDelta);
  if (out.scar) p.scars = p.scars.filter((s) => s.id !== out.scar!.id);
}

/** Labels this function owns. Anything matching is stripped before re-settling. */
const NOMINATION_LABEL = /^you (put|sent) /;

/**
 * Pay out every nomination against the CURRENT outcomes, from scratch.
 *
 * Idempotent on purpose, and that is the whole point of it existing. It used to
 * run once inside `resolveAct`, which was fine until a Signature or a Kit charge
 * could re-roll an outcome afterwards: `rethrow` replaces a row wholesale, so it
 * silently deleted whatever settlement had been written onto it. Measured both
 * directions: a +3 cut vanished and its owner went from 8 Renown to 0, and in the
 * other direction spending a reroll REFUNDED a nomination penalty, which is an
 * exploit rather than a display bug.
 *
 * So: strip every line this function owns, recompute, and adjust the live Renown
 * by the difference. Safe to call as often as anything changes an outcome.
 *
 * The share is split, not paid in full to each nominator. `NOMINATION_SHARE` is
 * half of the prize, and paying every nominator half of it minted Renown at a big
 * table: five nominators on one success used to pay out two and a half times the
 * deed itself.
 */
function settleNominations(
  room: Room,
  act: ActState,
  outcomes: Outcome[],
  opts: { announce?: boolean } = {}
): void {
  // Strip first, so a re-settle never stacks on the last one.
  for (const out of outcomes) {
    const keep = out.costMods.filter((m) => !NOMINATION_LABEL.test(m.label));
    if (keep.length === out.costMods.length) continue;
    const removed = out.costMods.reduce((t, m) => t + m.value, 0) -
      keep.reduce((t, m) => t + m.value, 0);
    out.costMods = keep;
    out.renownDelta -= removed;
    // The outcome may already be applied, so the live figure has to move too.
    const owner = findPlayer(room, out.playerId);
    if (owner) owner.renown = Math.max(0, owner.renown - removed);
  }

  // Group by nominee, so one success is divided among everybody who pointed at it.
  const byNominee = new Map<string, string[]>();
  for (const [nominatorId, nomineeId] of Object.entries(act.nominations)) {
    byNominee.set(nomineeId, [...(byNominee.get(nomineeId) ?? []), nominatorId]);
  }

  for (const [nomineeId, nominators] of byNominee) {
    const result = outcomes.find((o) => o.playerId === nomineeId);
    if (!result) continue;
    const who = findPlayer(room, nomineeId)?.name ?? "them";

    for (const nominatorId of nominators) {
      const nominator = findPlayer(room, nominatorId);
      if (!nominator) continue;
      const ledger = outcomes.find((o) => o.playerId === nominatorId);
      const line = result.success
        ? {
            label: `you put ${who} forward`,
            // Floor, not round: rounding turns a half into a whole and mints the
            // difference back at exactly two nominators.
            value: Math.max(
              1,
              Math.floor((result.renownDelta * NOMINATION_SHARE) / nominators.length)
            ),
          }
        : { label: `you sent ${who} and it did not work`, value: -NOMINATION_PENALTY };

      if (ledger) {
        ledger.costMods.push(line);
        ledger.renownDelta += line.value;
        // Only the already-applied rows need their live Renown moved; a row that
        // has not been applied yet gets it in applyOutcome.
        if (act.outcomes) nominator.renown = Math.max(0, nominator.renown + line.value);
      } else {
        nominator.renown = Math.max(0, nominator.renown + line.value);
      }
      if (opts.announce) {
        note(
          room,
          "roll",
          result.success
            ? `${nominator.name} takes a cut for the suggestion`
            : `${nominator.name} sent them and it did not work`,
          nominatorId
        );
      }
    }
  }
}

/**
 * Resolve the Act.
 *
 * Order of business matters here. The Reckless line is settled first, because it
 * is one door and the loser has to be moved to another one before anybody rolls.
 */
function resolveAct(room: Room, now: number, rng: Rng): void {
  const act = room.act;
  if (!act) return;
  const scene = SCENES_BY_ID[act.sceneId];
  const reckless = scene.approaches.find((a) => a.reckless);

  // Bots move on the deadline like anybody else, with a simple honest policy:
  // take the Reckless line if it is theirs to take, otherwise the door they are
  // best at.
  for (const p of room.players) {
    if (!p.isBot || act.choices[p.id]) continue;
    const best = [...scene.approaches]
      .filter((a) => !a.reckless)
      .sort((x, y) => reachOn(p, y.ability) - reachOn(p, x.ability))[0];
    const wantsReckless = act.marked.includes(p.id) && reckless;
    act.choices[p.id] = (wantsReckless ? reckless : best).id;
    act.spend[p.id] = wantsReckless ? Math.min(1, p.hookTokens) : 0;
    act.order.push(p.id);
  }

  // One door. The quicker hand takes it; everybody else is bumped to the door
  // they are best at, and takes a point of Dread for the scramble.
  const scrambled = new Set<string>();
  if (reckless) {
    const grabbers = act.order.filter((id) => act.choices[id] === reckless.id);
    for (const loser of grabbers.slice(1)) {
      const p = findPlayer(room, loser);
      if (!p) continue;
      // The door they are best at, counting what they are TRAINED for and what
      // they are carrying, not the raw ability alone. Sorting on the bare
      // modifier sent a Warden bumped off the Reckless line to a door their
      // Calling is not trained for and their Kit does not help with.
      const fallback = [...scene.approaches]
        .filter((a) => !a.reckless)
        .sort((x, y) => reachOn(p, y.ability) - reachOn(p, x.ability))[0];
      act.choices[loser] = fallback.id;
      scrambled.add(loser);
      /**
       * Charged here, BEFORE anybody rolls, and deliberately left here.
       *
       * It is inside `dread: room.dread` in every player's roll context below, so
       * it can already tip the whole Act into doubled costs. Moving the charge
       * later to make the bookkeeping tidy would quietly change that rule. What
       * gets fixed instead is the invisibility: the point is handed back below and
       * re-applied through the outcome, so the Warden's Signature and Emberkin can
       * both see it and the sum of the outcomes matches the room.
       */
      room.dread = Math.min(dreadOf(room).max, room.dread + 1);
      note(
        room,
        "dread",
        `${p.name} and somebody else reached for the same door in the dark`,
        p.id
      );
    }
  }

  const outcomes: Outcome[] = [];
  room.players.forEach((p, i) => {
    const chosen = act.choices[p.id];
    const marked = act.marked.includes(p.id);
    const hook = hookOf(p);
    const hookCalled = !!hook && scene.tags.includes(hook.callTag);

    if (!chosen) {
      const mult = costMultiplier({
        calling: callingOf(p),
        scene,
        dread: room.dread,
        players: room.players.length,
      });
      outcomes.push(
        flinch(
          p,
          scene,
          marked,
          { renown: FLINCH_RENOWN, dread: FLINCH_DREAD, markPenalty: MARK_FLINCH_PENALTY },
          mult
        )
      );
      p.stats.flinches++;
      return;
    }

    const approach = scene.approaches.find((a) => a.id === chosen)!;
    const spend = act.spend[p.id] ?? 0;
    const calling = callingOf(p);
    const ctx = {
      player: p,
      calling,
      kit: kitOf(p),
      scene,
      approach,
      spendTokens: spend,
      dread: room.dread,
      players: room.players.length,
      hookCalled,
      // Chanter. Declared during the Act, so it went on the table before the
      // die did. The label is the Signature's own name, so the ledger reads
      // "Everyone Joins In +5" rather than a nameless bonus.
      boost: act.boosted.includes(p.id)
        ? { label: (calling?.signature.label ?? "your Signature").toLowerCase(), value: SIGNATURE_BOOST }
        : undefined,
    };
    let out = rollApproach(ctx, i, rng);

    // Hillfolk. A one always fails whatever the ledger says, so there is never
    // a reason to decline the reroll and no decision worth a prompt: it fires
    // on the first fumble of the run. Rolling again is literally a second
    // rollApproach, which is why nothing in resolve.ts had to learn about this.
    if (out.roll === FUMBLE && bloodOf(p)?.power.kind === "rerollFumble" && !p.usedBloodPower) {
      p.usedBloodPower = true;
      out = rollApproach(ctx, i, rng);
      out.mods.splice(1, 0, {
        label: "you have been wrong about your footing before",
        value: 0,
      });
      note(room, "roll", `${p.name} picks the die up and throws it again`, p.id);
    }

    // Being Marked pays you for taking the Act at all, and it gets its own line
    // rather than quietly inflating the figure: a Marked player winning a 3
    // Renown door used to read "+5 Renown" with nothing to explain the 2.
    if (marked) {
      out.renownDelta += MARK_BONUS;
      out.costMods.push({ label: "this one was about you", value: MARK_BONUS });
    }
    outcomes.push(out);

    p.hookTokens -= Math.min(spend, p.hookTokens);
    p.stats.actsTaken++;
    if (approach.reckless) p.stats.recklessTaken++;
    if (out.roll === 20) p.stats.crits++;
  });

  // Move the scramble's Dread onto the outcome that caused it. Handed back off
  // room.dread first so applyOutcome re-applies exactly the same point, with the
  // same clamp, and nothing is charged twice.
  for (const out of outcomes) {
    if (!scrambled.has(out.playerId)) continue;
    room.dread = Math.max(0, room.dread - 1);
    out.dreadDelta += 1;
  }

  settleNominations(room, act, outcomes, { announce: true });

  for (const out of outcomes) applyOutcome(room, out, scene);

  /**
   * A night going well lets the party breathe. Dread had no downward direction
   * at all before this: every source added and nothing subtracted, so it could
   * only ratchet toward the ceiling.
   */
  const committed = outcomes.filter((o) => o.approachId !== "flinch");
  const cleared = committed.filter((o) => o.success).length;
  if (committed.length > 0 && cleared * 2 > committed.length && room.dread > 0) {
    room.dread = Math.max(0, room.dread - DREAD_RELIEF);
    note(room, "dread", "Most of that went well. The room feels bigger");
  }

  act.outcomes = outcomes;
  room.phase = "ACT_RESULT";
  room.phaseEndsAt = now + TIMINGS.actResultMs;
  if (room.dread >= dreadOf(room).double) note(room, "dread", "Everything costs more now");
  touch(room);
}

/** Keep it and the party pays. Hide it and you do. */
export function decideScar(
  room: Room,
  playerId: string,
  scarId: string,
  keep: boolean,
  now: number
): void {
  requirePhase(room, "ACT_RESULT");
  const p = requirePlayer(room, playerId);
  const scar = p.scars.find((s) => s.id === scarId);
  if (!scar) throw new GameError("not_found", "That is not one of yours.");
  if (scar.kept !== null) throw new GameError("already", "You have decided that one.");

  const blood = bloodOf(p);
  scar.kept = keep;
  if (keep) {
    p.stats.scarsKept++;
    const free = blood?.power.kind === "keepScarFree" && !p.usedBloodPower;
    if (free) {
      p.usedBloodPower = true;
      // Flagged, not just untaxed: this one also pays at the Ballad whatever
      // their Renown. See the note on Scar.free.
      scar.free = true;
      note(room, "scar", `${p.name} wears it, and the table pays nothing`, p.id);
    } else {
      room.dread = Math.min(dreadOf(room).max, room.dread + KEEP_SCAR_DREAD);
      note(room, "scar", `${p.name} keeps it where everybody can see`, p.id);
    }
  } else {
    p.stats.scarsHidden++;
    const free = blood?.power.kind === "freeHide" && !p.usedBloodPower;
    if (free) {
      p.usedBloodPower = true;
      note(room, "scar", `${p.name} hides it, and it costs them nothing`, p.id);
    } else {
      p.renown = Math.max(0, p.renown - HIDE_SCAR_RENOWN);
      note(room, "scar", `${p.name} says nothing about it`, p.id);
    }
  }
  touch(room);
}

/**
 * Throw your own die again for the line you already took.
 *
 * Shared by the Houndmaster's Signature and by a Kit reroll charge, because they
 * are the same act with a different receipt. The second throw replaces the first
 * entirely: `unapplyOutcome` takes the Renown, the Dread and the wound back out
 * before `applyOutcome` puts the new ones in, which is only exact because
 * `applyOutcome` records the clamped figures rather than the intended ones.
 *
 * Refuses once the wound has been decided. Un-deciding somebody's keep-or-hide
 * would silently reverse a Dread charge the whole table has already read.
 */
function rethrow(
  room: Room,
  p: Player,
  act: ActState,
  scene: Scene,
  label: string,
  rng: Rng
): void {
  const outcomes = act.outcomes;
  if (!outcomes) throw new GameError("wrong_phase", "Nothing has played out yet.");
  const mine = outcomes.find((o) => o.playerId === p.id);
  if (!mine || mine.approachId === "flinch")
    throw new GameError("bad_choice", "You have nothing to throw again.");
  if (mine.scar && p.scars.find((s) => s.id === mine.scar!.id)?.kept !== null)
    throw new GameError(
      "already",
      "You have already decided what to do with the wound. Too late to undo it."
    );
  const approach = scene.approaches.find((a) => a.id === mine.approachId);
  if (!approach) throw new GameError("bad_choice", "That door has gone.");

  const at = outcomes.indexOf(mine);
  unapplyOutcome(room, mine);
  const calling = callingOf(p);
  const again = rollApproach(
    {
      player: p,
      calling,
      kit: kitOf(p),
      scene,
      approach,
      spendTokens: 0, // Spent on the first throw, and gone with it.
      dread: room.dread,
      // The table size, or costMultiplier falls back to the SOLO thresholds and
      // doubles this roll's cost at Dread 3 while the rest of the Act is using
      // the party's own number. A reroll has to be the same bet as the throw it
      // replaces.
      players: room.players.length,
      hookCalled: mine.hookRefilled,
      /**
       * A Chanter who declared before the roll keeps the declaration.
       *
       * This is why a rethrow cannot be "just roll again": the second throw has
       * to be rebuilt with everything that was true of the first one, and a
       * Signature announced to the whole table is very much true of it.
       */
      boost: act.boosted.includes(p.id)
        ? {
            label: (calling?.signature.label ?? "your Signature").toLowerCase(),
            value: SIGNATURE_BOOST,
          }
        : undefined,
    },
    at,
    rng
  );
  // Itemised, not folded in. `resolveAct` prints this line and the rethrow did
  // not, so a rerolled Marked ledger was off by exactly the bonus.
  if (act.marked.includes(p.id)) {
    again.renownDelta += MARK_BONUS;
    again.costMods.push({ label: "this one was about you", value: MARK_BONUS });
  }
  again.mods.splice(1, 0, { label, value: 0 });
  outcomes[at] = again;
  // Replacing the row wholesale threw away the nomination settlement written on
  // it, in both directions: a cut vanished, and a penalty was refunded by
  // spending a reroll. Re-settle from scratch over the whole list.
  settleNominations(room, act, outcomes);
  applyOutcome(room, again, scene);
}

/**
 * Spend a Kit reroll charge.
 *
 * The whetstone and the spare bowstring advertise "2 rerolls" on the card you
 * rank them on, and for a while that is all they did: only `torch` charges were
 * honoured, so a player who drafted the whetstone for its rerolls went looking
 * for a button that did not exist.
 */
export function useKitReroll(room: Room, playerId: string, now: number): void {
  requirePhase(room, "ACT_RESULT");
  const p = requirePlayer(room, playerId);
  if (p.rerolls <= 0) throw new GameError("no_charge", "You have no rerolls left.");
  const act = room.act;
  if (!act) throw new GameError("wrong_phase", "Nothing is happening.");
  rethrow(room, p, act, SCENES_BY_ID[act.sceneId], "your gear earns its place", defaultRng);
  p.rerolls--;
  note(room, "roll", `${p.name} throws again off their own kit`, p.id);
  touch(room);
}

/**
 * Your Signature. One per Calling, once in the whole run.
 *
 * Eight kinds, one action, because they share every precondition: your Calling,
 * once ever, against the Act in front of you. Two are declared during the Act,
 * before anybody knows the die, and six react to the result.
 *
 * The split matters. A Signature you can hold until you have seen the roll is a
 * safety net; one you have to call while the outcome is unknown is a bet. The
 * Chanter and the Reckoner bet. Everybody else reacts, and pays for it by having
 * their Signature be smaller.
 */
export function useSignature(
  room: Room,
  playerId: string,
  arg: { targetId?: string; approachId?: string },
  now: number
): void {
  const p = requirePlayer(room, playerId);
  const calling = callingOf(p);
  if (!calling) throw new GameError("no_signature", "You have no Calling to call on.");
  if (p.usedSignature) throw new GameError("already", "You only get that once a night.");
  const act = room.act;
  if (!act) throw new GameError("wrong_phase", "Nothing is happening.");
  const scene = SCENES_BY_ID[act.sceneId];
  const kind = calling.signature.kind;

  // The two bets happen while the Act is live.
  if (kind === "addFive" || kind === "revealReckless") {
    requirePhase(room, "ACT");
    if (room.phaseEndsAt !== null && now > room.phaseEndsAt)
      throw new GameError("too_late", "You left it too long.");
    if (kind === "addFive") {
      // Before you commit, not after: the point is that you back a door before
      // you know whether it needed backing.
      if (act.choices[playerId])
        throw new GameError("already", "You have already moved. Call it before you go.");
      act.boosted.push(playerId);
      note(room, "system", `${p.name}: ${calling.signature.label}`, p.id);
    } else {
      if (!act.revealed.includes(playerId)) act.revealed.push(playerId);
      note(room, "system", `${p.name} prices the door without burning anything`, p.id);
    }
    p.usedSignature = true;
    touch(room);
    return;
  }

  // Everything else answers a result.
  requirePhase(room, "ACT_RESULT");
  if (!act.outcomes) throw new GameError("wrong_phase", "Nothing has played out yet.");
  const outcomes = act.outcomes;
  const mine = outcomes.find((o) => o.playerId === playerId);

  switch (kind) {
    case "rerollOwn":
      // Houndmaster. The same machinery a Kit reroll uses: throw again, live
      // with the second one.
      rethrow(room, p, act, scene, calling.signature.label.toLowerCase(), defaultRng);
      break;

    case "shieldParty": {
      // Warden. Every point of Dread this Act put on the party, not just yours.
      const total = outcomes.reduce((t, o) => t + Math.max(0, o.dreadDelta), 0);
      if (total <= 0) throw new GameError("bad_choice", "This Act put nothing on the party.");
      room.dread = Math.max(0, room.dread - total);
      for (const o of outcomes) if (o.dreadDelta > 0) o.dreadDelta = 0;
      note(room, "system", `${p.name}: ${calling.signature.label}. The party takes none of it`, p.id);
      break;
    }

    case "clearDread": {
      // Hedge-witch. Not a reset: enough to pull the table back under a
      // threshold it has just crossed, which is when it is worth having.
      if (room.dread <= 0) throw new GameError("bad_choice", "There is nothing on the party.");
      const before = room.dread;
      room.dread = Math.max(0, room.dread - SIGNATURE_CLEAR_DREAD);
      note(
        room,
        "dread",
        `${p.name}: ${calling.signature.label}. Dread ${before} down to ${room.dread}`,
        p.id
      );
      break;
    }

    case "stealDeed": {
      // Knife. A cut of somebody else's win, and it costs them nothing: the
      // story grows in the telling and you are in it now.
      const targetId = arg.targetId;
      if (!targetId || targetId === playerId)
        throw new GameError("bad_target", "Name somebody else's success.");
      const theirs = outcomes.find((o) => o.playerId === targetId);
      if (!theirs?.success || theirs.renownDelta <= 0)
        throw new GameError("bad_target", "They did not pull anything off worth taking.");
      const cut = Math.max(1, Math.round(theirs.renownDelta * SIGNATURE_STEAL_SHARE));
      p.renown += cut;
      note(
        room,
        "roll",
        `${p.name}: ${calling.signature.label}. ${cut} Renown, and ${nameOfIn(room, targetId)} keeps theirs`,
        p.id
      );
      break;
    }

    case "takeScarFor": {
      // Oathbound. Carry somebody else's wound. It becomes yours, undecided,
      // and you are paid for the saying rather than for the wearing.
      const targetId = arg.targetId;
      if (!targetId || targetId === playerId)
        throw new GameError("bad_target", "Name whose wound you are taking.");
      const them = findPlayer(room, targetId);
      const theirs = them?.scars.find((s) => s.kept === null);
      if (!them || !theirs)
        throw new GameError("bad_target", "They have nothing undecided to give you.");
      them.scars = them.scars.filter((s) => s.id !== theirs.id);
      p.scars.push({ ...theirs, id: `${theirs.id}-oath` });
      p.renown += SIGNATURE_OATH_RENOWN;
      note(
        room,
        "scar",
        `${p.name}: ${calling.signature.label}. ${them.name}'s wound is theirs now`,
        p.id
      );
      break;
    }

    case "secondApproach": {
      // Sapper. One way in did not work, so try another. Only after a failure,
      // because "the other way in" needs a first way that shut.
      if (!mine || mine.success)
        throw new GameError("bad_choice", "Nothing shut in your face this Act.");
      const other = scene.approaches.find(
        (a) => a.id === arg.approachId && a.id !== mine.approachId
      );
      if (!other) throw new GameError("bad_choice", "That is not another way through.");
      // Not the Reckless line. One player takes that door and the quicker hand
      // already settled who, at engine's scramble step; letting a second roll in
      // through the back would break the exclusivity that nomination, the hidden
      // target number and the whole contested-door design hang off.
      if (other.reckless)
        throw new GameError(
          "bad_choice",
          "Somebody already took that door tonight. It only opens once."
        );
      const extra = rollApproach(
        {
          player: p,
          calling,
          kit: kitOf(p),
          scene,
          approach: other,
          spendTokens: 0,
          dread: room.dread,
          players: room.players.length,
          hookCalled: false,
        },
        outcomes.length,
        defaultRng
      );
      extra.mods.splice(1, 0, { label: calling.signature.label.toLowerCase(), value: 0 });
      // A second roll is a second chance at the Deed and a second chance at the
      // wound. That symmetry is the whole cost of the Signature.
      outcomes.push(extra);
      // A new row for a nominated player changes what their nominators are owed.
      settleNominations(room, act, outcomes);
      applyOutcome(room, extra, scene);
      break;
    }

    default: {
      // Exhaustive: adding a ninth Signature kind fails to compile here.
      const never: never = kind;
      throw new GameError("no_signature", `Unhandled Signature: ${String(never)}`);
    }
  }

  p.usedSignature = true;
  touch(room);
}

function nameOfIn(room: Room, id: string): string {
  return findPlayer(room, id)?.name ?? "SOMEBODY";
}

/**
 * The three Blood powers that are a decision rather than a reflex.
 *
 * One action for all of them, because they share every precondition: your Blood,
 * once a run, at ACT_RESULT, against the Act you just played. Three routes and
 * three buttons would be three copies of the same six guards.
 *
 * The other five fire where they belong: Hillfolk on a fumble in `resolveAct`,
 * Longshank in `revealReckless`, Tideborn in `beginRun`, and Thornborn and
 * Gravewise in `decideScar`.
 */
export function useBloodPower(
  room: Room,
  playerId: string,
  arg: { swap?: [Ability, Ability] },
  now: number
): void {
  requirePhase(room, "ACT_RESULT");
  const p = requirePlayer(room, playerId);
  const blood = bloodOf(p);
  if (!blood) throw new GameError("no_power", "You have no Blood to call on.");
  if (p.usedBloodPower) throw new GameError("already", "You have spent that already.");
  const act = room.act;
  if (!act?.outcomes) throw new GameError("wrong_phase", "Nothing has played out yet.");
  const out = act.outcomes.find((o) => o.playerId === playerId);

  switch (blood.power.kind) {
    case "reassignOne": {
      // Fenborn. Two of your own numbers change places, which is why it can
      // only ever be a swap: the house array must survive it intact.
      const swap = arg.swap;
      if (!swap || swap.length !== 2)
        throw new GameError("bad_choice", "Name the two numbers to move.");
      const [a, b] = swap;
      if (!ABILITIES.includes(a) || !ABILITIES.includes(b))
        throw new GameError("bad_choice", "Those are not abilities.");
      if (a === b) throw new GameError("bad_choice", "That is the same number twice.");
      if (!p.scores) throw new GameError("bad_choice", "You have no sheet to change.");
      const before = p.scores[a];
      p.scores[a] = p.scores[b];
      p.scores[b] = before;
      p.usedBloodPower = true;
      note(room, "system", `${p.name} moves, the way fen people do`, p.id);
      break;
    }

    case "costToDread": {
      // Ashkin. The cost never went away, it moved.
      if (!out || out.renownDelta >= 0)
        throw new GameError("bad_choice", "Nothing cost you anything this Act.");
      const refund = -out.renownDelta;
      p.renown += refund;
      out.renownDelta = 0;
      // On the list, or the parts stop summing to the figure.
      out.costMods.push({ label: "somebody else's pocket", value: refund });
      room.dread = Math.min(dreadOf(room).max, room.dread + ASHKIN_DREAD);
      p.usedBloodPower = true;
      note(room, "dread", `${p.name} finds somebody else's pocket for it`, p.id);
      break;
    }

    case "dreadShield": {
      // Emberkin. Give back exactly the Dread this result added, which after the
      // clamp at DREAD_MAX may be less than the result said it would be.
      if (!out || out.dreadDelta <= 0)
        throw new GameError("bad_choice", "This Act put nothing on the party.");
      room.dread = Math.max(0, room.dread - out.dreadDelta);
      out.dreadDelta = 0;
      p.renown += EMBERKIN_RENOWN;
      p.usedBloodPower = true;
      note(room, "system", `${p.name} had a hand out to it already`, p.id);
      break;
    }

    default:
      throw new GameError("no_power", "Yours is not something you choose to spend.");
  }
  touch(room);
}

function endAct(room: Room, now: number, rng: Rng): void {
  // A bot decides its own wounds rather than falling through to the default
  // below. Without this every bot Scar was silently hidden and quietly cost them
  // Renown, which is not a policy, it is a bot losing to the deadline.
  //
  // The policy is the same read a human should make: keep it if you are at or
  // above the middle of the table, because that is the only case where a kept
  // Scar pays at the Ballad. It taxes the party a point of Dread, which is
  // exactly the trade the mechanic is for.
  const middle = median(room.players.map((p) => p.renown));
  for (const bot of room.players) {
    if (!bot.isBot) continue;
    for (const scar of bot.scars) {
      if (scar.kept !== null) continue;
      decideScar(room, bot.id, scar.id, bot.renown >= middle, now);
    }
  }

  // An undecided Scar is hidden, not kept: it costs the absent player rather
  // than taxing the table for somebody else's closed tab.
  for (const p of room.players) {
    for (const scar of p.scars) {
      if (scar.kept !== null) continue;
      scar.kept = false;
      p.stats.scarsHidden++;
      p.renown = Math.max(0, p.renown - HIDE_SCAR_RENOWN);
    }
  }

  const index = room.act?.index ?? room.settings.acts;
  if (index >= room.settings.acts) {
    room.act = null;
    room.phase = "BALLAD";
    room.phaseEndsAt = now + TIMINGS.balladMs;
    note(room, "system", "Somebody calls for the song");
    touch(room);
    return;
  }
  beginAct(room, index + 1, now, rng);
}

// ---------------------------------------------------------------------------
// The Ballad
// ---------------------------------------------------------------------------

export function castLaurel(room: Room, playerId: string, targetId: string, now: number): void {
  requirePhase(room, "BALLAD");
  const p = requirePlayer(room, playerId);
  if (playerId === targetId)
    throw new GameError("bad_target", "You cannot toast yourself. Everyone would see.");
  requirePlayer(room, targetId);
  p.laurelFor = targetId;
  touch(room);
}

function finish(room: Room, now: number): void {
  /**
   * A bot casts a Laurel like everybody else, and it cannot be steered.
   *
   * A Laurel is worth LAUREL_VALUE, the single largest swing in the standings, so
   * bots not voting rigged the one-human table the front page sells: the human
   * gave one away and could never receive any.
   *
   * The first version had them vote for whoever wore the most public Scars, which
   * read well and was a catastrophe. Kept Scars are public, so the rule was a
   * lever with a handle on it: measured over 1,200 runs per policy, a human who
   * kept EVERY Scar took a mean 4.00 of 5 available Laurels and won 78.1% of
   * games, against 43.1% playing the sensible median rule and 5.2% hiding
   * everything. It held at every table size (74% against one bot, 82% against
   * three), so it was not a small-sample artefact: it was the dominant strategy
   * in the game and it was trivial to find.
   *
   * So the vote is a deterministic SCATTER instead: seeded on the bot's own id
   * and the table's code, which means it spreads across the party, it is
   * identical on a replay, and there is no behaviour a player can adopt to
   * attract it. A vote nobody can earn cannot be farmed.
   */
  for (const bot of room.players) {
    if (!bot.isBot || bot.laurelFor) continue;
    const others = room.players.filter((p) => p.id !== bot.id);
    if (others.length === 0) continue;
    const seed = `${bot.id}:${room.code}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const best = others[hash % others.length];
    bot.laurelFor = best.id;
    note(room, "system", `${bot.name} raises a glass to ${best.name}`, bot.id);
  }

  room.standings = standingsFor(room.players);
  room.phase = "FINAL";
  room.phaseEndsAt = null;
  const winner = room.standings.find((s) => s.hoard);
  if (winner) note(room, "system", `${winner.name} walks out with the lot`, winner.playerId);
  touch(room);
}

export function rematch(room: Room, playerId: string, now: number): void {
  requirePhase(room, "FINAL");
  const p = requirePlayer(room, playerId);
  if (!p.isHost) throw new GameError("not_host", "Only the host can call for another.");
  for (const player of room.players) {
    // Presence carries over, because the people at the table have not moved.
    // Everything else about them is last night and last night is over.
    Object.assign(
      player,
      freshPlayer(player.id, player.name, player.isHost, player.isBot, now),
      {
        connected: player.connected,
        disconnectedAt: player.disconnectedAt,
        lastSeenAt: player.lastSeenAt,
      }
    );
  }
  Object.assign(room, {
    phase: "WAITING",
    phaseEndsAt: null,
    houseArray: null,
    priority: [],
    callingDraft: null,
    kitDraft: null,
    /**
     * `seen` remembers which scenes this table has already faced, ACROSS rounds.
     *
     * Without it a group that hits "Another round" met a repeat scene 63% of the
     * time, and 96% of the time by the third round, because the deck was built
     * from the full pool every night as though the table had never played.
     */
    seen: [...(room.seen ?? []), ...room.deck],
    deck: [],
    act: null,
    dread: 0,
    // Round two used to open with round one's night still in the sidebar.
    log: [],
    standings: undefined,
  } satisfies Partial<Room>);
  ensureHumanHost(room);
  note(room, "system", "Another round, then");
  touch(room);
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

/**
 * Has everybody the table is actually waiting for already answered?
 *
 * A beat whose whole table has committed is a countdown nobody is reading. At six
 * players the last person to pick a door left five others watching forty seconds
 * of nothing, every Act, and the fix is not a shorter deadline: it is not waiting
 * once there is nobody left to wait for.
 *
 * Read from state, not from a counter, and answered by `tick` rather than by the
 * action that completed the set. That is what keeps the promise in the module
 * docblock: the engine stays pure, the resolution still happens on a poll with an
 * injected rng, and a table that half-empties mid-beat re-answers this correctly on
 * the next poll instead of holding a tally that is now wrong.
 *
 * Who is NOT waited on:
 *   - bots, which choose at resolution time in `resolveAct`, `applyCallingDraft`,
 *     `applyKitDraft`, `beginRun` and `finish`, so waiting for them is waiting for
 *     ourselves;
 *   - humans we have not heard from, or one closed tab holds every beat of the
 *     night for its full deadline, which is the thing the deadlines exist to stop.
 * An empty table returns false and is left to its deadlines, so nothing
 * fast-forwards a whole run because a passer-by opened the page.
 *
 * MUSTER is absent because it asks for nothing, and ACT_RESULT because it is the
 * beat you READ: everything you can do in it is optional, so "everybody has acted"
 * is never true there, and cutting the ledger short is the opposite of the fix.
 */
function everybodyIn(room: Room, now: number): boolean {
  const waitingOn = room.players.filter((p) => !p.isBot && isPresent(p, now));
  if (waitingOn.length === 0) return false;
  switch (room.phase) {
    case "DRAFT_CALLING": {
      const draft = room.callingDraft;
      return !!draft && waitingOn.every((p) => draft.wants[p.id]);
    }
    case "DRAFT_KIT": {
      const draft = room.kitDraft;
      return !!draft && waitingOn.every((p) => draft.wants[p.id]);
    }
    case "ASSIGN":
      return waitingOn.every((p) => p.scores && p.hookId);
    case "ACT": {
      const act = room.act;
      return !!act && waitingOn.every((p) => act.choices[p.id]);
    }
    case "BALLAD":
      return waitingOn.every((p) => p.laurelFor);
    default:
      return false;
  }
}

/**
 * Advance anything whose deadline has passed, or that nobody is still answering.
 * Called before every read and every write, because a serverless deployment has
 * no timers.
 */
export function tick(room: Room, now: number, rng: Rng = defaultRng): boolean {
  const before = room.version;
  sweepPresence(room, now);
  maybeMigrateHost(room, now);
  const due = room.phaseEndsAt !== null && now >= room.phaseEndsAt;
  if (!due && !everybodyIn(room, now)) return room.version !== before;
  // Said out loud, because a timer that vanishes with thirty seconds on it looks
  // like a fault rather than a courtesy.
  if (!due) note(room, "system", "Everybody has answered, so nobody waits");

  switch (room.phase) {
    case "MUSTER":
      beginCallingDraft(room, now, rng);
      break;
    case "DRAFT_CALLING":
      applyCallingDraft(room, now, rng);
      break;
    case "DRAFT_KIT":
      applyKitDraft(room, now, rng);
      break;
    case "ASSIGN":
      beginRun(room, now, rng);
      break;
    case "ACT":
      resolveAct(room, now, rng);
      break;
    case "ACT_RESULT":
      endAct(room, now, rng);
      break;
    case "BALLAD":
      finish(room, now);
      break;
    default:
      break;
  }
  return room.version !== before;
}

// ---------------------------------------------------------------------------
// The redacted view
// ---------------------------------------------------------------------------

function playerView(p: Player, viewerId: string | null): PlayerView {
  const mine = p.id === viewerId;
  const shown = mine ? p.scars : p.scars.filter((s) => s.kept === true);
  return {
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    isBot: p.isBot,
    connected: p.connected,
    disconnectedAt: p.disconnectedAt,
    lastSeenAt: p.lastSeenAt,
    callingId: p.callingId,
    bloodId: p.bloodId,
    kitIds: p.kitIds,
    hookId: p.hookId,
    scores: p.scores,
    renown: p.renown,
    hookTokens: p.hookTokens,
    scars: shown,
    hiddenScarCount: p.scars.filter((s) => s.kept === false).length,
    torches: p.torches,
    rerolls: p.rerolls,
    usedSignature: p.usedSignature,
    usedBloodPower: p.usedBloodPower,
    hasVoted: p.laurelFor !== null,
    stats: p.stats,
  };
}

export function viewFor(room: Room, playerId: string | null): RoomView {
  const me = playerId ? findPlayer(room, playerId) : undefined;
  const draftView = (draft: DraftState | null) =>
    draft
      ? {
          pool: draft.pool,
          myWants: playerId ? (draft.wants[playerId] ?? []) : [],
          committed: Object.keys(draft.wants),
          granted: draft.granted,
        }
      : null;

  const act = room.act;
  const scene = act ? SCENES_BY_ID[act.sceneId] : undefined;
  const reckless = scene?.approaches.find((a) => a.reckless);
  const canSeeReckless =
    !!act && !!playerId && (act.revealed.includes(playerId) || act.outcomes !== null);

  return {
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    createdAt: room.createdAt,
    version: room.version,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    settings: room.settings,
    houseArray: room.houseArray,
    priority: room.priority,
    dread: room.dread,
    log: room.log,
    standings: room.standings,
    players: room.players.map((p) => playerView(p, playerId)),
    callingDraft: draftView(room.callingDraft),
    kitDraft: draftView(room.kitDraft),
    act: act
      ? {
          index: act.index,
          sceneId: act.sceneId,
          marked: act.marked,
          nominations: act.outcomes ? act.nominations : {},
          spend: act.outcomes ? act.spend : {},
          order: act.outcomes ? act.order : [],
          revealed: act.revealed,
          // Public before the roll, unlike a choice. Somebody announcing their
          // Signature is the loudest thing that happens all night, and the table
          // knowing it should change whether they nominate them.
          boosted: act.boosted,
          outcomes: act.outcomes,
          myChoice: playerId ? (act.choices[playerId] ?? null) : null,
          committed: Object.keys(act.choices),
          recklessTn: canSeeReckless ? (reckless?.tn ?? null) : null,
          /**
           * The scene, with the answers taken out, so that no client component
           * needs `lib/content/scenes`. Two of them used to import it, which put
           * all thirty scenes and every hidden Reckless number in the bundle.
           *
           * Built here rather than in a helper because the redaction rule is one
           * line and it belongs next to the flag that decides it: a Reckless
           * target is null until this player has bought it or the Act is over.
           */
          scene: {
            id: scene?.id ?? act.sceneId,
            title: scene?.title ?? "",
            setup: scene?.setup ?? "",
            tags: scene?.tags ? [...scene.tags] : [],
            approaches: (scene?.approaches ?? []).map((a) => ({
              id: a.id,
              label: a.label,
              ability: a.ability,
              tn: a.reckless && !canSeeReckless ? null : a.tn,
              deed: a.deed,
              cost: { ...a.cost },
              reckless: a.reckless,
              // The outcome prose arrives with the outcome, not before it.
              ...(act.outcomes ? { win: a.win, lose: a.lose } : {}),
            })),
          },
        }
      : null,
    // Never the whole deck: only what has been faced.
    seenScenes: room.deck.slice(0, act ? act.index : room.deck.length),
    me: {
      id: me?.id ?? "",
      scars: me?.scars ?? [],
      laurelFor: me?.laurelFor ?? null,
      canAct: !!me && !!act && !act.choices[me.id] && room.phase === "ACT",
    },
  };
}
