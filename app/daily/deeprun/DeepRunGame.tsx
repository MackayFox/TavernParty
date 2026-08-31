"use client";

/**
 * THE DEEP RUN.
 *
 * Two screens: build somebody, then take them down. The build is on paper
 * because it is yours; every room is on the dark because it is not.
 *
 * ONE STAGE, ONE STRIP, ONE RAIL. At any moment the descent answers exactly one
 * question, which is "what is happening, and what can I do about it?". Everything
 * else is either ambient or one tap away:
 *
 *   the stage  the floor you are on, and the doors out of it. It owns the whole
 *              viewport, so scenes REPLACE each other rather than being appended
 *              to a page that then has to be scrolled to. There is no scrolling
 *              to hunt, because there is no page to hunt through.
 *   the strip  your character, on paper, along the bottom edge of the table.
 *   the rail   how far down you are, as a column of nodes rather than a list.
 *
 * The daily furniture (the glyph, the date, the 36px title, the blurb, the rule
 * line) exists on the build screen and on the score screen and nowhere in
 * between: during the descent it is one quiet line at the top.
 *
 * No import of `lib/daily/deeprun` anywhere in here. That module computes par,
 * which is the answer. `lib/game/rules` is imported for the ability labels and
 * the modifier curve, which is a table of six words and a divide by two, and
 * knows nothing about tonight.
 *
 * The client never knows a room's number until it has committed to a door. Each
 * choice posts the whole run so far and the server replays it, so the dungeon
 * arrives a room at a time with nothing kept in a session anywhere.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Announcer,
  Button,
  Card,
  ErrorNote,
  Pill,
  Sheet,
  Spinner,
} from "@/components/ui";
import { postJson } from "@/components/client";
import {
  AdventurerStrip,
  DepthRail,
  FullSheet,
  Ledger,
  type Sheet as CharacterSheet,
} from "@/components/daily/Adventurer";
import { Reveal } from "@/components/daily/Reveal";
import { playOut, setSoundOn, soundOn } from "@/components/daily/sfx";
import { Runner } from "@/components/daily/Runner";
import { readHero, recordNight, type Hero } from "@/lib/daily/hero";
import { ABILITY_BLURB, ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import {
  failRange,
  listOf,
  stakeLine,
  startingVigourFrom,
  type Outcome,
} from "@/lib/daily/core";
import type { Ability } from "@/lib/game/types";
import { readProgress, useLocalStreak, writeProgress } from "@/lib/daily/local";
import { DailyHeader, DieRule, NextUp, RuleLine, ShareCard, finishDaily, getPuzzle } from "../shell";

const GAME = "deeprun" as const;

/** How long the doors wait after the scene lands, and the gap between them. */
const DOORS_AFTER_MS = 480;
const DOOR_STAGGER_MS = 130;

type CallingCard = {
  id: string;
  name: string;
  blurb: string;
  affinities: Ability[];
  knack: { kind: string; label: string; text: string };
};
type KitCard = { id: string; name: string; blurb: string; ability: Ability | null; value: number };
type Option = {
  id: string;
  label: string;
  kind: "check" | "brace";
  vigour: number;
  promise: string;
  /**
   * Marks: what this door wants, what it will not have, and what it leaves on
   * you. Public rules, like the target number, and for the same reason: this is a
   * bet rather than a riddle. The die and the prose stay behind the wall.
   */
  needs?: string[];
  forbids?: string[];
  sets?: string[];
  /**
   * What a catastrophe on this door leaves on you. Public for exactly the reason
   * `needs` and `forbids` are: a door that shuts on "hurt" three floors down is
   * only a fair rule if you could see what might make you hurt up here.
   */
  ruinSets?: string[];
};
type Aside = { when?: string[]; unless?: string[]; text: string };
type Room = {
  id: string;
  index: number;
  title: string;
  setup: string;
  asides: Aside[];
  boss: boolean;
  options: Option[];
};

/**
 * Which of a room's asides apply to somebody carrying `held`.
 *
 * Filtered here rather than on the server because a mark is already public to
 * the player holding it - the strip prints what you are carrying - and an aside
 * is prose rather than an answer. Nothing to redact, and the rooms are sent once
 * at the start of the run.
 */
function asidesFor(room: Room, held: readonly string[]): string[] {
  const have = new Set(held);
  return room.asides
    .filter(
      (a) =>
        (a.when ?? []).every((m) => have.has(m)) && !(a.unless ?? []).some((m) => have.has(m))
    )
    .map((a) => a.text);
}

type Payload = {
  date: string;
  /**
   * What it is called: the date for the daily, the author's title for a dungeon.
   *
   * Already in the payload since dungeons became a thing; the client type simply
   * never declared it, so nothing could read it. The runner's ledger needs it, or
   * every line of a life reads "2026-08-25" including the nights somebody spent
   * in a dungeon with a name.
   */
  label: string;
  archive: boolean;
  array: number[];
  abilities: Ability[];
  callings: CallingCard[];
  kit: KitCard[];
  rooms: Room[];
  /** Why you came down, and what it means if you get back up. */
  premise: { hook: string; paid: string };
  baseVigour: number;
  maxScore: number;
};

type Line = {
  roomIndex: number;
  title: string;
  optionId: string;
  label: string;
  roll: number;
  mods: { label: string; value: number }[];
  total: number;
  tn: number | null;
  cleared: boolean;
  /** How badly, not merely whether. Arrives with the resolved floor. */
  outcome: Outcome;
  vigourSpent: number;
  vigourAfter: number;
  text: string;
  /** What that floor left on you, and everything in hand after it. */
  gained?: string[];
  marks?: string[];
};

type RunReply = {
  lines: Line[];
  depth: number;
  vigour: number;
  out: boolean;
  bossBeaten: boolean;
  roomsCleared: number;
  score: number;
  /**
   * Where the score came from, line by line. See the note beside its
   * construction in `run`: the house rule is the ledger, never a total.
   */
  ledger: { label: string; rate: string; value: number }[];
  archive: boolean;
  finished: boolean;
  par?: number;
  /** The line that scored par. Sent with the score, and never before it. */
  bestRun?: { build: { callingId: string; kitIds: string[] }; steps: Step[] } | null;
  share?: string;
};

type Step = { optionId: string; knack?: boolean };

/** Everything about a run in progress: the character, and how far down they are. */
type Saved = {
  callingId: string | null;
  slots: (number | null)[];
  kitIds: string[];
  down: boolean;
  steps: Step[];
  reply: RunReply | null;
};

/**
 * A run in progress, read back off this browser.
 *
 * This is the one daily where the dice are worth knowing twice: the numbers
 * arrive a room at a time and there is no way to see them again, so a reload
 * used to destroy the whole run with nothing to go back to. Everything is checked
 * against tonight's dungeon rather than trusted, because the stored copy may be a
 * shape from an older release or simply somebody's editing.
 *
 * The lines and the steps are written together and are meaningless apart, so if
 * they do not match, the descent is dropped and the build is kept. Losing the
 * character as well would be the same bug wearing a coat.
 *
 * Exported only so a test can hold the validation to all of that.
 */
export function restore(data: Payload): Saved | null {
  const saved = readProgress<Saved>(GAME, data.date);
  if (!saved || typeof saved !== "object") return null;
  const okCalling =
    saved.callingId === null || data.callings.some((c) => c.id === saved.callingId);
  const okSlots =
    Array.isArray(saved.slots) &&
    saved.slots.length === data.abilities.length &&
    saved.slots.every(
      (s) => s === null || (Number.isInteger(s) && s >= 0 && s < data.array.length)
    );
  const okKit =
    Array.isArray(saved.kitIds) &&
    saved.kitIds.length <= 2 &&
    new Set(saved.kitIds).size === saved.kitIds.length &&
    saved.kitIds.every((id) => data.kit.some((k) => k.id === id));
  if (!okCalling || !okSlots || !okKit) return null;

  const okSteps =
    Array.isArray(saved.steps) &&
    saved.steps.length <= data.rooms.length &&
    saved.steps.every((s, i) => data.rooms[i]?.options.some((o) => o.id === s?.optionId));
  const steps = okSteps ? saved.steps : [];
  const okReply =
    saved.reply == null
      ? steps.length === 0 // nothing chosen yet is a consistent state too
      : Array.isArray(saved.reply.lines) && saved.reply.lines.length === steps.length;
  const descending = okSteps && okReply;

  return {
    callingId: saved.callingId ?? null,
    slots: saved.slots,
    kitIds: saved.kitIds,
    down: descending ? !!saved.down : false,
    steps: descending ? steps : [],
    reply: descending ? saved.reply : null,
  };
}

/**
 * `dungeon` points the same runner at somebody's authored dungeon instead of
 * tonight's. One prop rather than a second component, because everything that
 * matters here (the blind die, the reply carrying only committed floors, the
 * ledger) is identical and a copy would be a copy that drifts.
 *
 * The daily furniture is suppressed for a dungeon: it has no streak, it is not
 * part of anybody's four, and offering "the other three" under somebody's own
 * dungeon would be pointing away from the thing the link was sent for.
 */
export function DeepRunGame({
  date,
  dungeon = null,
}: {
  date: string | null;
  dungeon?: string | null;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = dungeon
      ? `/api/daily/deeprun?c=${encodeURIComponent(dungeon)}`
      : date
        ? `/api/daily/deeprun?date=${encodeURIComponent(date)}`
        : "/api/daily/deeprun";
    getPuzzle<Payload>(url)
      .then(setData)
      .catch(() => setError("Could not find the way in. Try again."));
  }, [date, dungeon]);

  if (error && !data) return <ErrorNote message={error} />;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Finding the way in" />
      </div>
    );
  }
  // Keyed on the date so a move to the archive starts a clean run rather than
  // carrying a half-finished one into a different dungeon.
  return <Run key={dungeon ?? data.date} data={data} dungeon={dungeon} />;
}

function Run({ data, dungeon }: { data: Payload; dungeon: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Whatever this browser already had of tonight, read once on the way in.
  const [saved] = useState(() => restore(data));

  // The build.
  const [callingId, setCallingId] = useState<string | null>(saved?.callingId ?? null);
  const [slots, setSlots] = useState<(number | null)[]>(
    () => saved?.slots ?? new Array(data.abilities.length).fill(null)
  );
  const [held, setHeld] = useState<number | null>(null);
  const [kitIds, setKitIds] = useState<string[]>(saved?.kitIds ?? []);
  const [down, setDown] = useState(saved?.down ?? false);

  // The descent.
  const [steps, setSteps] = useState<Step[]>(saved?.steps ?? []);
  /**
   * How many resolved floors the player has actually WATCHED.
   *
   * The server is the authority on what happened and `reply.lines` is that answer,
   * but a line the player has not been shown yet must not appear behind them and
   * must not advance the room. So this is the cursor, and everything on screen is
   * derived from it: the room you are facing is `rooms[seen]`, the history is the
   * first `seen` lines, and a reveal is open whenever the server knows about a
   * floor that you do not.
   *
   * Restoring a saved run sets it to the end, because a reveal is an event and an
   * event you have already lived through is not one you want replayed on reload.
   */
  const [seen, setSeen] = useState<number>(saved?.reply?.lines.length ?? 0);
  const [sound, setSound] = useState(true);
  /**
   * THE ONE TRICK IS ARMED, NOT MULTIPLIED.
   *
   * It used to render as a boxed button with its own paragraph under every
   * eligible door, so a floor with three doors carried three copies of an
   * explanation about a thing you only get once. Now it is one toggle on the
   * "what do you do?" row: arm it, and it goes on whichever door you take next.
   * The wire is unchanged, `choose(option, knack)` either way.
   */
  const [armed, setArmed] = useState(false);
  /** The paper overlay: your whole sheet, and everything behind you. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * The runner: one character, kept between nights.
   *
   * Read after mount, never during render, because localStorage does not exist on
   * the server and a first client render that disagrees with the server's makes
   * React throw the whole tree away.
   */
  const [hero, setHero] = useState<Hero | null>(null);
  useEffect(() => setHero(readHero()), []);
  // Read after mount, for the same reason.
  useEffect(() => setSound(soundOn()), []);
  const [reply, setReply] = useState<RunReply | null>(saved?.reply ?? null);
  const [streak, setStreak] = useLocalStreak(GAME);
  const recorded = useRef(false);

  /**
   * The run is over AND the player has watched the floor that ended it.
   *
   * `reply.finished` is the server's answer and arrives with the last line. Using
   * it directly put the score and the share card on screen behind a dialog still
   * revealing the roll that produced them, which gives away the ending before the
   * beat that earns it.
   */
  const finished = !!reply?.finished && !!reply && seen >= reply.lines.length;
  /** The stage is up: the descent owns the viewport and the page does not exist. */
  const descending = down && !finished;

  /**
   * EVERY FLOOR STARTS AT THE TOP OF THE FLOOR.
   *
   * A phone cannot hold sixty words of prose, four doors that each carry two
   * sentences, and your character, all at once, and pretending otherwise is how
   * you end up with a screen that fits nothing properly. Adam's read, and it is
   * the right one: the roll and the outcome are a modal, so the only thing that
   * has to be true afterwards is that the next floor begins at its beginning.
   * Scrolling prose is what reading is.
   *
   * This used `useLanded`, which the other three dailies share and which centres
   * what it lands on. Centring is right for a result appended to a page and wrong
   * here: it left the eyebrow and the title floating in the middle of the stage
   * with the top of the floor scrolled off, from wherever you happened to be
   * standing at the bottom of the last one.
   *
   * So: the stage goes to the top, instantly, and the heading takes focus without
   * scrolling. Instant rather than smooth because the scene is NEW content, it
   * arrives with its own `tp-descend`, and animating a scroll through prose
   * nobody has read yet is motion for its own sake.
   */
  const stage = useRef<HTMLDivElement | null>(null);
  const scene = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (!descending) return;
    if (stage.current) stage.current.scrollTop = 0;
    const heading = scene.current;
    if (!heading) return;
    // `focus()` on a non-focusable element silently does nothing, and a silent
    // nothing is how this kind of fix gets shipped broken.
    if (heading.tabIndex < 0) heading.tabIndex = -1;
    try {
      heading.focus({ preventScroll: true });
    } catch {
      heading.focus();
    }
  }, [descending, seen]);

  /**
   * The stage is `position: fixed`, so the document behind it is still scrollable
   * and a phone will happily rubber-band the game off the top of itself. Lock it
   * while the stage is up, and put back exactly what was there before.
   */
  useEffect(() => {
    if (!descending) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [descending]);

  // Written on every change rather than at the end, because the end is exactly
  // what a lost run never reaches. The initial state is the stored state, so the
  // first pass writes back what it just read.
  useEffect(() => {
    writeProgress(GAME, data.date, {
      callingId,
      slots,
      kitIds,
      down,
      steps,
      reply,
    } satisfies Saved);
  }, [data.date, callingId, slots, kitIds, down, steps, reply]);

  useEffect(() => {
    if (!finished || !reply || recorded.current) return;
    recorded.current = true;
    // A dungeon is not one of tonight's four, so it touches no streak and writes
    // no daily result. It is somebody's link, and the score belongs to them.
    /**
     * The runner's ledger, and it counts somebody else's dungeon too.
     *
     * A dungeon touches no streak and writes no daily result, because the score
     * belongs to whoever wrote it. But it IS a night your character went down, and
     * a ledger that only counted the house's four would be a worse record of a
     * life than the one the player actually led.
     *
     * ARCHIVE RUNS ARE NOT NIGHTS. `lib/daily/local` already keeps archive play
     * separate on purpose: you have seen those dice. A ledger counting them would
     * let "eleven nights down" be built on the one path the codebase has already
     * conceded does not count.
     */
    if (!reply.archive && readHero()) {
      const scars = reply.lines
        .filter((line) => !line.cleared && line.text)
        // The authored `lose` sentence, verbatim. Never a generated label: every
        // door in the game already has one written as a wound, and the gate
        // refuses to publish an authored door without one.
        .map((line) => ({ where: line.title, line: line.text, on: dungeon ?? data.date }));
      setHero(
        recordNight(
          {
            on: dungeon ?? data.date,
            label: dungeon ? data.label : data.date,
            callingId: callingId ?? "",
            score: reply.score,
            par: reply.par ?? null,
            out: reply.out,
            floors: data.rooms.length,
            reached: reply.depth,
          },
          scars
        )
      );
    }

    if (dungeon) return;
    void finishDaily(GAME, data.date, reply.score, reply.par ?? null, reply.archive).then(
      setStreak
    );
  }, [finished, data.date, data.label, data.rooms.length, reply, dungeon, callingId]);

  const calling = data.callings.find((c) => c.id === callingId);
  const placed = slots.filter((s) => s !== null).length;
  const tray = data.array.map((_, i) => i).filter((i) => !slots.includes(i));
  const buildReady = !!calling && placed === data.abilities.length && kitIds.length === 2;

  /*
   * `bonusFor` used to live here: a client-side copy of the server's reach
   * arithmetic, existing only to print "you bring +3" on every door. The doors
   * lead with the fiction now, and the server itemises the whole sum in the
   * ledger once a floor resolves, so the duplicate is gone. One implementation of
   * "what do I bring to this", on the side of the wire that decides it.
   */

  function place(index: number) {
    if (held === null) return;
    setSlots((current) => {
      const next = [...current];
      // Putting a number where one already is sends the old one back to the tray.
      const already = next.indexOf(held);
      if (already !== -1) next[already] = null;
      next[index] = held;
      return next;
    });
    setAnnounce(
      `${data.array[held]} to ${ABILITY_LABEL[data.abilities[index]]}`
    );
    setHeld(null);
  }

  /**
   * GRIT FIRST, THEN WHAT YOU ARE TRAINED FOR.
   *
   * This used to put the best number on the first affinity, and that is a bad
   * build. Measured on 2026-08-25: it put 16 on a Warden's Brawn, while the
   * server's own par line put 16 on GRIT, and playing the button's build to the
   * bottom scored 16 against a par of 51.
   *
   * The reason is that Grit is the only number that pays twice. It buys Vigour
   * before you go down, and Vigour left over is points when you come back up.
   * Everything else pays once, and only up to what a door happens to want:
   * anything above the target is wasted, and you cannot see the target's die.
   *
   * Still not optimal, and it does not claim to be. It is the safe spread, which
   * is what a first-timer wants from a button.
   */
  function autoPlace() {
    if (!calling) return;
    const order: Ability[] = [
      "grit",
      ...calling.affinities.filter((a) => a !== "grit"),
      ...data.abilities.filter((a) => a !== "grit" && !calling.affinities.includes(a)),
    ];
    const byValue = data.array
      .map((value, i) => ({ value, i }))
      .sort((a, b) => b.value - a.value);
    const next = new Array<number | null>(data.abilities.length).fill(null);
    order.forEach((ability, rank) => {
      const slot = data.abilities.indexOf(ability);
      if (slot >= 0 && byValue[rank]) next[slot] = byValue[rank].i;
    });
    setSlots(next);
    setHeld(null);
    setAnnounce("Spread the safe way: the best number on Grit");
  }

  async function choose(option: Option, knack: boolean) {
    if (!buildReady || busy) return;
    setBusy(true);
    setError(null);
    const next: Step[] = [...steps, knack ? { optionId: option.id, knack: true } : { optionId: option.id }];
    try {
      const result = await postJson<RunReply>(
        dungeon ? `/api/daily/deeprun?c=${encodeURIComponent(dungeon)}` : "/api/daily/deeprun",
        {
        date: data.date,
        callingId,
        placement: slots.map((s) => s ?? 0),
        kitIds,
        steps: next,
      });
      setSteps(next);
      setReply(result);
      // Whether it was used or not, the door has been taken. Leaving it armed
      // would silently spend it on the next floor as well.
      setArmed(false);
      /*
       * Deliberately NOT announcing here any more, and deliberately not scrolling.
       * The reveal opens on the new line, it is a modal, so focus moves into it and
       * the announcement comes from its own live region at the moment the outcome
       * is shown rather than the moment the request returned. Announcing both
       * would read the result out twice, once before the player has seen it.
       */
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Everything the screen shows is derived from `seen`, not from `steps`.
   *
   * `steps` is what has been committed to the server; `seen` is what the player
   * has been shown. Between a click and the end of the reveal those differ by one,
   * and that gap is the whole of the interaction: the room behind the dialog is
   * still the room you just left, and it becomes the next one when you press on.
   */
  const behind = reply ? reply.lines.slice(0, seen) : [];
  const pending = reply && seen < reply.lines.length ? reply.lines[seen] : null;
  const vigour = behind.length > 0 ? behind[behind.length - 1].vigourAfter : (reply?.vigour ?? null);
  const room = data.rooms[seen];
  const knackSpent = steps.some((s) => s.knack);
  /**
   * What they are carrying, straight off the last line the server sent.
   *
   * Never accumulated here. The server replays the whole run on every choice and
   * says what is in hand afterwards, so this screen has no state of its own to get
   * wrong, and a reloaded tab is right for free.
   */
  const carrying: string[] = behind.length ? (behind[behind.length - 1].marks ?? []) : [];
  const holding = new Set(carrying);

  /**
   * Whether this door could carry the one trick.
   *
   * Unchanged from when it decided which doors got their own knack button, and
   * still per door rather than per floor: some knacks apply to anything, most
   * only to a check. Arming is a single control, but a brace on a floor where the
   * knack only works on checks must not quietly eat it.
   */
  function knackTakes(option: Option): boolean {
    if (knackSpent || !calling) return false;
    return ["pass", "mend", "slip"].includes(calling.knack.kind) || option.kind === "check";
  }

  /**
   * Your character, as one object, built in one place.
   *
   * The per-ability sum is here and NOT on the doors, and that distinction is the
   * whole point: what you bring is yours to see, which door wants which ability is
   * not. `bonusFor` used to compute the same thing per door, which is what let
   * somebody play the game without reading a word of it.
   */
  /** The placed Grit, which is the only score that matters before floor one. */
  const gritScore = (() => {
    const at = data.abilities.indexOf("grit");
    const slot = at >= 0 ? slots[at] : null;
    return slot === null || slot === undefined ? 10 : data.array[slot];
  })();

  const sheet: CharacterSheet | null = calling
    ? {
        callingName: calling.name,
        callingBlurb: calling.blurb,
        abilities: data.abilities,
        scores: Object.fromEntries(
          data.abilities.map((ability, i) => {
            const slot = slots[i];
            return [ability, slot === null ? 0 : data.array[slot]];
          })
        ) as CharacterSheet["scores"],
        affinities: calling.affinities,
        kit: kitIds
          .map((id) => data.kit.find((k) => k.id === id))
          .filter((k): k is NonNullable<typeof k> => !!k)
          .map((k) => ({ name: k.name, ability: k.ability, value: k.value })),
        knack: { label: calling.knack.label, text: calling.knack.text },
        knackSpent,
        /*
         * What THIS character started on, not what the dungeon starts anybody
         * on. Grit buys Vigour before the first door, so a Houndmaster with
         * seventeen Grit begins on twelve of a base of nine, and the strip was
         * printing "12 of 9" with a bar drawn past its own end.
         */
        vigour: vigour ?? startingVigourFrom(data.baseVigour, gritScore),
        baseVigour: startingVigourFrom(data.baseVigour, gritScore),
        floor: Math.min(seen + 1, data.rooms.length),
        floors: data.rooms.length,
        carrying,
      }
    : null;

  /** Whether any door on this floor could take the trick, so the toggle is honest. */
  const knackUseful = !!room && !knackSpent && room.options.some(knackTakes);

  /**
   * WHAT A BAD FLOOR COSTS, SAID ONCE.
   *
   * Measured across the whole dataset on 2026-08-25: all 32 rooms price every one
   * of their doors identically, so "costs 3 Vigour if it goes wrong" was printed
   * two or three times a floor to say a thing that was true of the floor. Three
   * copies of a constant read as three different numbers you are supposed to be
   * weighing, which is most of why the doors looked like arithmetic.
   *
   * Null when a floor really does price its doors differently, which the daily
   * never does but an authored dungeon is free to: then the price goes back on
   * each door, because there it is genuinely part of the choice.
   */
  const floorCost: { bad: number; ruin: number } | null = (() => {
    const checks = room?.options.filter((o) => o.kind === "check") ?? [];
    if (checks.length === 0) return null;
    const bands = checks.map((o) => failRange(o));
    const bad = new Set(bands.map((b) => b.bad));
    const ruin = new Set(bands.map((b) => b.ruin));
    return bad.size === 1 && ruin.size === 1
      ? { bad: [...bad][0], ruin: [...ruin][0] }
      : null;
  })();

  return (
    <>
      {/* ---------------------------------------------------------- the stage */}
      {descending && sheet && room && (
        <div className="fixed inset-0 z-40 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-0">
          {/*
            The header, reduced to the one line that says where you are. The full
            one is on the build screen and on the score screen; between them it is
            furniture over the top of the game.
          */}
          <header className="flex items-center gap-2 border-b border-border-dim px-2 py-2 sm:gap-3 sm:px-3">
            {/*
              THE WAY OUT, and it has to be here because there is nowhere else.
              The stage is `fixed inset-0`, which is what makes the descent own
              the viewport, and the side effect is that it covers the site nav
              completely: once you were down here the only way back to the rest
              of the site was the browser's own back button. Leaving is safe and
              costs nothing, because the run is written to this browser on every
              change and picked back up exactly where it was.
            */}
            <Link
              href="/"
              aria-label="Leave the descent and go back to Tavern Party. Your run is kept."
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-text-mid hover:bg-bg-2 hover:text-text-hi"
            >
              <span aria-hidden className="text-base">&#8592;</span>
              <span className="hidden sm:inline">Out</span>
            </Link>
            <div className="min-w-0 flex-1">
              {dungeon ? (
                <p className="font-display truncate text-sm uppercase tracking-[0.14em] text-text-hi">
                  {data.label}
                </p>
              ) : (
                <DailyHeader game={GAME} date={data.date} archive={data.archive} slim />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !sound;
                setSound(next);
                setSoundOn(next);
              }}
              aria-pressed={sound}
              className="min-h-11 shrink-0 rounded-md border border-border-dim px-2 text-sm text-text-mid hover:border-border-strong hover:text-text-hi sm:px-3"
            >
              <span aria-hidden>{sound ? "\u{1F50A}" : "\u{1F507}"}</span>
              {/* The word is the label on a wide screen and the glyph carries it
                  on a phone, where the header has three things in 390px. The
                  accessible name says it in full either way. */}
              <span className="ml-1 hidden sm:inline">Sound {sound ? "on" : "off"}</span>
              <span className="sr-only">Sound is {sound ? "on" : "off"}</span>
            </button>
          </header>

          <div className="relative min-h-0">
            <DepthRail
              floors={data.rooms.length}
              lines={behind}
              current={seen}
              onOpen={() => setSheetOpen(true)}
            />

            {/*
              The stage column. The frame does not scroll; this does, and only
              when a floor is longer than the screen. A short floor sits in the
              middle of the viewport instead of jammed under the header.
            */}
            <div
              ref={stage}
              className="absolute inset-0 flex flex-col overflow-y-auto py-5 pl-11 pr-3 sm:pl-14 sm:pr-6"
            >
              <div className="mx-auto my-auto w-full max-w-[39rem]">
                <ErrorNote message={error} />

                {/*
                  Keyed on the floor, so every scene is a fresh mount and every
                  scene arrives: the story first, the doors a beat behind it.
                */}
                <article key={seen}>
                  <div className="tp-anim-descend">
                    <header className="flex flex-wrap items-center gap-2">
                      <span className="label-caps">
                        Floor {room.index + 1} of {data.rooms.length}
                      </span>
                      {room.boss && <Pill tone="danger">The bottom</Pill>}
                      {carrying.map((m) => (
                        <Pill key={m} tone="accent">
                          {m}
                        </Pill>
                      ))}
                    </header>
                    <h2
                      ref={scene}
                      className="font-display mt-2 text-[1.85rem] leading-tight text-text-hi"
                    >
                      {room.title}
                    </h2>
                    <p className="prose-read mt-3">{room.setup}</p>
                    {/*
                      WHAT THE ROOM MAKES OF WHAT YOU BROUGHT IT.
                      These are the descent's connective tissue: the same room
                      reads differently soaked, or bleeding, or already heard,
                      and this is where floor two is allowed to be visible on
                      floor five. Same prose treatment as the setup, because it
                      is the setup - just the part that could not be written
                      until it knew who turned up.
                    */}
                    {asidesFor(room, carrying).map((text) => (
                      <p key={text} className="prose-read mt-2 text-text-mid">
                        {text}
                      </p>
                    ))}
                    {carrying.length > 0 && (
                      <p className="mt-2 max-w-[34em] text-sm text-text-low">
                        You are {listOf(carrying)}, and some doors care about that.
                      </p>
                    )}
                    {/*
                      THE RULES, ON THE FIRST FLOOR AND NOWHERE ELSE. By floor two
                      the player has watched a reveal, which teaches the same thing
                      better than a paragraph does. Leaving it on every floor is
                      three lines of furniture between the story and the choice,
                      six times a night.
                    */}
                    {seen === 0 && (
                      <>
                        <p className="mt-3 max-w-[34em] text-sm text-text-low">
                          Vigour is your health. Every floor takes some, whether the door gives or
                          not, and at nothing you do not come back up. You cannot see what a room
                          rolled, or which of your abilities a door leans on, until you commit.
                        </p>
                        <DieRule />
                      </>
                    )}
                  </div>

                  {/* ------------------------------------------ what do you do */}
                  <div className="tp-anim-descend mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-dim pt-3">
                    <span className="label-caps text-accent">What do you do?</span>
                    {calling && knackSpent && (
                      <span className="label-caps">One trick: spent</span>
                    )}
                    {calling && knackUseful && (
                      <button
                        type="button"
                        aria-pressed={armed}
                        onClick={() => setArmed((on) => !on)}
                        className={`min-h-11 rounded-full border px-3 ${
                          armed
                            ? "border-accent bg-accent-dim"
                            : "border-border-dim hover:border-accent/60"
                        }`}
                      >
                        <span className={`label-caps ${armed ? "text-accent" : "text-text-mid"}`}>
                          {/* Not colour alone: the tick says it too. */}
                          <span aria-hidden>{armed ? "✓ " : "○ "}</span>
                          {armed
                            ? `Armed: ${calling.knack.label}`
                            : `One trick in hand: ${calling.knack.label}`}
                        </span>
                      </button>
                    )}
                  </div>
                  {/*
                    ONE LINE OF CHROME BETWEEN THE QUESTION AND THE DOORS.
                    There were three: what the trick does, what a miss costs, and
                    what a disaster costs. On a phone that put the first door
                    below the fold on every floor, which is the exact problem this
                    screen was rebuilt to solve. The trick explains itself only
                    once it is armed, when knowing matters; the prices merge.
                  */}
                  {floorCost !== null && (
                    <p className="tp-anim-descend mt-1 max-w-[34em] text-xs text-text-low">
                      Getting it wrong here costs {floorCost.bad} Vigour, or {floorCost.ruin} if it
                      goes badly, and leaves the floor uncleared.
                    </p>
                  )}
                  {calling && armed && (
                    <p className="tp-anim-descend mt-1 max-w-[34em] text-xs text-accent">
                      {calling.knack.text}
                    </p>
                  )}

                  {/* ------------------------------------------------ the doors */}
                  <ul className="mt-4 flex flex-col gap-3">
                    {room.options.map((option, i) => {
                      // Which of this door's demands are not met. Named rather than
                      // implied: a door that is simply greyed out is a bug as far as
                      // the player is concerned.
                      const wants = (option.needs ?? []).filter((m) => !holding.has(m));
                      const refuses = (option.forbids ?? []).filter((m) => holding.has(m));
                      const shut = wants.length > 0 || refuses.length > 0;
                      const lit = armed && !shut && knackTakes(option);
                      return (
                        <li key={option.id}>
                          {/*
                            A DOOR IS ONE BUTTON.

                            It used to be a card containing a label, a promise, a
                            meta line and then a full-size button repeating the
                            label, which is the same control drawn twice and about
                            twice the height it needed. The card is the control now.
                          */}
                          <button
                            type="button"
                            disabled={busy || shut}
                            onClick={() => void choose(option, lit)}
                            style={{
                              animationDelay: `${DOORS_AFTER_MS + i * DOOR_STAGGER_MS}ms`,
                            }}
                            className={`tp-anim-descend w-full rounded-md border bg-bg-1 p-4 text-left transition-all duration-[120ms] ease-out hover:-translate-y-px hover:border-accent hover:bg-bg-2 disabled:translate-y-0 disabled:opacity-60 disabled:hover:border-border-dim disabled:hover:bg-bg-1 ${
                              lit ? "border-accent ring-1 ring-accent/40" : "border-border-dim"
                            }`}
                          >
                            <span className="font-display block text-lg leading-snug text-text-hi">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-sm text-text-mid">
                              {option.promise}
                            </span>
                            {shut && (
                              <span className="mt-1 block text-sm text-text-hi">
                                <span aria-hidden>&#9866; </span>
                                {wants.length > 0 && `Not for you without ${listOf(wants)}.`}
                                {wants.length > 0 && refuses.length > 0 && " "}
                                {refuses.length > 0 && `Not while you are ${listOf(refuses)}.`}
                              </span>
                            )}
                            {/*
                              A CHECK CANNOT PROMISE AN OUTCOME. This line rendered
                              for any door with `sets`, so the first door of the
                              house dungeon read "Works, and you come away carrying
                              the lantern" directly above "costs 3 if it goes
                              wrong". A brace does always work; a check does not.
                            */}
                            {!shut && (option.sets ?? []).length > 0 && (
                              <span className="mt-1 block text-sm text-text-low">
                                {option.kind === "brace"
                                  ? `You come away ${listOf(option.sets ?? [])}.`
                                  : `Get through it and you come away ${listOf(option.sets ?? [])}.`}
                              </span>
                            )}
                            {/*
                              WHAT A DOOR TELLS YOU BEFORE YOU TAKE IT, and what it
                              does not.

                              It used to print the ability, your modifier and the
                              face you needed, which meant the fastest way to play
                              well was to ignore every word of the writing and take
                              the biggest number. At a table you say what you are
                              going to do and the person running it tells you what
                              to roll: the fiction comes first and the stat is a
                              consequence of it.

                              The cut is YOUR MODIFIER, not the room's number. What
                              the room wants is a fact about the room and stays
                              public: this is a bet, not a riddle. The whole sum
                              arrives in the reveal the moment the floor resolves,
                              which is where it teaches you what you should have
                              read.
                            */}
                            {/*
                              WHAT A DOOR TELLS YOU, AND WHAT IT NO LONGER DOES.

                              It used to print the number the room wanted, and
                              since every check on a floor costs the same, that
                              number was the only thing telling three doors apart.
                              So the whole game was: read three numbers, take the
                              smallest, never read a word. Adam asked "eleven
                              what?" and the honest answer was "the thing you are
                              actually playing".

                              What is here instead is the STAKE, authored per
                              door: what a catastrophe on THIS door leaves on you.
                              It cannot be sorted, because it says nothing about
                              whether you will make it. The number is not hidden,
                              it is deferred: the reveal prints "it wanted 14"
                              against your total the moment the floor resolves,
                              which is where it teaches instead of shortcuts.
                            */}
                            <span className="mt-2 block text-xs text-text-low">
                              {option.kind === "brace"
                                ? `Slow, certain, and it costs you ${option.vigour} Vigour either way.`
                                : stakeLine(option.ruinSets)}
                              {lit && calling && ` ${calling.knack.label} is armed.`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- this is you */}
          <AdventurerStrip sheet={sheet} onOpen={() => setSheetOpen(true)} />
        </div>
      )}

      {/* ------------------------------------------- the build and the score */}
      {!descending && (
        <section className="mx-auto w-full max-w-2xl py-8">
          {!dungeon && <DailyHeader game={GAME} date={data.date} archive={data.archive} />}
          <RuleLine game={GAME} />

          {!down && (
            <div className="mt-6 space-y-4">
              {/*
                WHO IS GOING DOWN, AND HOW LONG THEY HAVE BEEN DOING THIS.

                The complaint this answers: "I am making a few choices from a very
                limited selection, then throwing the character away within minutes."
                The choices are the same, because a shared par depends on them being
                the same. What changes is that the character is no longer thrown away:
                it has a name, an ancestry, a past, and a list of everything that has
                happened to it.
              */}
              <Runner hero={hero} onChange={setHero} />
              <Card>
                <p className="label-caps">One. Who is going down</p>
                <ul className="mt-3 space-y-2">
                  {data.callings.map((c) => {
                    const chosen = c.id === callingId;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => setCallingId(c.id)}
                          className={`w-full rounded-md border px-3 py-3 text-left ${
                            chosen ? "border-accent bg-bg-2" : "border-border-dim bg-bg-2"
                          }`}
                        >
                          <span className="font-display flex items-center gap-2 text-text-hi">
                            {/* Not colour alone: the tick says it too. */}
                            <span aria-hidden>{chosen ? "✓" : "○"}</span>
                            {c.name}
                          </span>
                          <span className="mt-1 block text-sm text-text-mid">{c.blurb}</span>
                          <span className="mt-1 block text-xs text-text-low">
                            Trained in {ABILITY_LABEL[c.affinities[0]]} and{" "}
                            {ABILITY_LABEL[c.affinities[1]]}
                          </span>
                          <span className="mt-2 block text-sm text-accent">
                            {c.knack.label}: {c.knack.text}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Sheet title="Two. The numbers" subtitle="The same six for everybody tonight">
                <p className="text-sm text-paper-ink">
                  Take one from the pile and put it on an ability. Every room asks for one ability or
                  another, and you do not know which ones yet.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Numbers not yet placed">
                  {tray.map((i) => (
                    <li key={i}>
                      <button
                        type="button"
                        aria-pressed={held === i}
                        onClick={() => setHeld(held === i ? null : i)}
                        className={`sheet-box num min-h-11 min-w-11 px-3 text-lg ${
                          held === i ? "outline outline-2 outline-paper-ink" : ""
                        }`}
                      >
                        {data.array[i]}
                      </button>
                    </li>
                  ))}
                  {tray.length === 0 && <li className="sheet-label">All placed.</li>}
                </ul>

                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {data.abilities.map((ability, i) => {
                    const slot = slots[i];
                    const value = slot === null ? null : data.array[slot];
                    return (
                      <li key={ability}>
                        <button
                          type="button"
                          onClick={() => (slot === null ? place(i) : setHeld(slot))}
                          aria-label={
                            value === null
                              ? `${ABILITY_LABEL[ability]}, empty. ${ABILITY_BLURB[ability]}`
                              : `${ABILITY_LABEL[ability]}, ${value}, worth ${abilityMod(value) >= 0 ? "+" : ""}${abilityMod(value)}. ${ABILITY_BLURB[ability]}`
                          }
                          className={`sheet-box flex min-h-20 w-full flex-col items-center justify-center px-2 py-2 ${
                            slot === null ? "border-dashed" : ""
                          }`}
                        >
                          <span className="sheet-label">{ABILITY_LABEL[ability]}</span>
                          <span className="num text-2xl leading-none text-paper-ink">
                            {value ?? "·"}
                          </span>
                          <span className="sheet-label">
                            {value === null
                              ? "empty"
                              : `${abilityMod(value) >= 0 ? "+" : ""}${abilityMod(value)}`}
                          </span>
                          {/*
                            WHAT THE WORD MEANS, WHERE THE WORD IS.
                            Six invented ability names with nothing but a number
                            under them assume the reader has met this kind of game
                            before. The line already exists in `rules.ts` and the
                            multiplayer build screen already prints it; the Deep
                            Run was the one place asking people to choose on six
                            words it had never explained.
                          */}
                          <span aria-hidden className="sheet-label mt-1 block normal-case tracking-normal">
                            {ABILITY_BLURB[ability]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={autoPlace} disabled={!calling}>
                    Spread it the safe way
                  </Button>
                  <span className="sheet-label self-center max-w-sm">
                    Grit is the only number that pays twice: it buys Vigour before you go down, and
                    Vigour is points if you come back up. Anything above what a door needs is wasted,
                    and you cannot see what a door needs.
                  </span>
                </div>
              </Sheet>

              <Card>
                <p className="label-caps">Three. Two things to take</p>
                <ul className="mt-3 space-y-2">
                  {data.kit.map((k) => {
                    const taken = kitIds.includes(k.id);
                    const full = kitIds.length >= 2 && !taken;
                    return (
                      <li key={k.id}>
                        <button
                          type="button"
                          aria-pressed={taken}
                          disabled={full}
                          onClick={() =>
                            setKitIds((current) =>
                              current.includes(k.id)
                                ? current.filter((x) => x !== k.id)
                                : [...current, k.id]
                            )
                          }
                          className={`w-full rounded-md border px-3 py-3 text-left disabled:opacity-50 ${
                            taken ? "border-accent bg-bg-2" : "border-border-dim bg-bg-2"
                          }`}
                        >
                          <span className="font-display flex items-center gap-2 text-text-hi">
                            <span aria-hidden>{taken ? "✓" : "○"}</span>
                            {k.name}
                            {k.ability && (
                              <Pill>
                                {k.value >= 0 ? "+" : ""}
                                {k.value} {ABILITY_LABEL[k.ability]}
                              </Pill>
                            )}
                          </span>
                          <span className="mt-1 block text-sm text-text-mid">{k.blurb}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/*
                WHY YOU ARE HERE, and it goes last, immediately above the button
                that takes you down. A run used to open on a Calling and a
                button: you went down because the button said so, and the bottom
                was therefore only where the floors stopped. The rooms are dealt
                blind from three bands and can never refer to each other, so the
                frame has to come from outside them, and this is the one thing
                about the night no shuffle can contradict.
              */}
              <Card>
                <p className="label-caps">Why you are going down</p>
                <p className="prose-read mt-2 text-text-hi">{data.premise.hook}</p>
              </Card>

              <Button
                size="lg"
                disabled={!buildReady}
                onClick={() => {
                  setDown(true);
                  setAnnounce(`Floor 1 of ${data.rooms.length}. ${data.rooms[0]?.title ?? ""}`);
                }}
              >
                {buildReady
                  ? "Go down"
                  : !calling
                    ? "Pick who is going down"
                    : placed < data.abilities.length
                      ? `Place ${data.abilities.length - placed} more`
                      : "Take two things with you"}
              </Button>
            </div>
          )}

          {/* --------------------------------------------------- how it went */}
          {finished && reply && (
            <div className="mt-6 space-y-4">
              <Card>
                <p className="label-caps">
                  {reply.out ? "Out" : `Stopped on floor ${reply.depth}`}
                </p>
                <h2 className="font-display mt-1 text-2xl text-text-hi">
                  {reply.out
                    ? reply.bossBeaten
                      ? "Out, and it is not down there any more."
                      : "Out, and it is still down there."
                    : "You did not come back up."}
                </h2>
                {/* The reason, paid. Only on a run somebody walked out of:
                    nothing is owed to a person still down there. */}
                {reply.out && (
                  <p className="prose-read mt-3 text-text-mid">{data.premise.paid}</p>
                )}
                {/* Where the score came from, line by line. It used to print
                    "Floors cleared 4, Vigour left 0, Score 16" with nothing
                    connecting the three, so nobody could tell that the floor at
                    the bottom is worth three ordinary ones and that walking out
                    is worth two and a half more. Built server-side in
                    `lib/daily/deeprun.ts`, beside the sum it explains. */}
                <dl className="mt-3 space-y-1 text-sm">
                  {reply.ledger?.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <dt className={row.value > 0 ? "text-text-mid" : "text-text-low"}>
                        {row.label}{" "}
                        <span className="text-text-low">({row.rate})</span>
                      </dt>
                      <dd className={`num ${row.value > 0 ? "text-text-hi" : "text-text-low"}`}>
                        {row.value}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border-dim pt-1">
                    <dt className="label-caps">Score</dt>
                    <dd className="num text-lg text-text-hi">
                      {reply.score}
                      {reply.par !== undefined ? ` of a possible ${reply.par}` : ""}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* The night you actually had, floor by floor, and it is yours, so
                  it comes back up out of the overlay and onto paper. */}
              <Sheet title="Behind you" subtitle="Every floor, and what it cost" className="max-w-none">
                <Ledger lines={behind} par={reply.par ?? null} />
              </Sheet>

              {/* The other two dailies show you the night you could have had.
                  This one knew it and was keeping it to itself. */}
              {reply.bestRun && reply.score < (reply.par ?? 0) && (
                <Card>
                  <p className="label-caps">The best run there was tonight</p>
                  <p className="mt-1 text-text-hi">
                    {data.callings.find((c) => c.id === reply.bestRun!.build.callingId)?.name ??
                      "Somebody else"}
                    , carrying{" "}
                    {reply
                      .bestRun!.build.kitIds.map(
                        (id) => data.kit.find((k) => k.id === id)?.name ?? id
                      )
                      .join(" and ")}
                    .
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-text-mid">
                    {reply.bestRun.steps.map((step, i) => {
                      const best = data.rooms[i];
                      const option = best?.options.find((o) => o.id === step.optionId);
                      return (
                        <li key={`${step.optionId}-${i}`}>
                          <span className="num text-text-low">Floor {i + 1}. </span>
                          {option?.label ?? step.optionId}
                          {step.knack ? ", on their one trick" : ""}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-2 text-sm text-text-low">
                    The dice were the same for them as for you. Only the character and the doors
                    were different.
                  </p>
                </Card>
              )}

              {reply.share && <ShareCard text={reply.share} />}
              {!dungeon && <NextUp game={GAME} archive={reply.archive} streak={streak} />}
            </div>
          )}
        </section>
      )}

      {/*
        THE REVEAL. Open whenever the server knows about a floor the player has not
        been shown. It is the answer to "you click an option and the page stays
        scrolled down so you do not even know what has happened": a modal moves
        focus by itself, so there is nothing to scroll to.
      */}
      {pending && sheet && (
        <Reveal
          key={pending.roomIndex}
          line={pending}
          floor={pending.roomIndex + 1}
          floors={data.rooms.length}
          /*
            `finished` also requires that every line has been SEEN, and this dialog
            only exists while one has not, so it was provably false here: the last
            floor of every run offered "Press on" and then replaced the room with a
            score card. The server's own `reply.finished` is the right half to ask.
          */
          doneLabel={
            reply?.finished && seen + 1 >= reply.lines.length ? "See how it went" : "Press on"
          }
          onDone={() => {
            const wasLast = !!reply && seen + 1 >= reply.lines.length;
            setSeen((n) => n + 1);
            if (wasLast && reply?.out) playOut();
            setAnnounce(
              wasLast && reply?.finished
                ? "The run is over. Your score is below."
                : `Floor ${Math.min(seen + 2, data.rooms.length)}. ${
                    data.rooms[seen + 1]?.title ?? ""
                  }`
            );
          }}
        />
      )}

      {/* Everything that is yours, and everything you have done, on one sheet. */}
      {sheetOpen && sheet && (
        <FullSheet
          sheet={sheet}
          lines={behind}
          par={reply?.par ?? null}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <Announcer message={announce} />
    </>
  );
}
