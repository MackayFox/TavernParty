"use client";

/**
 * THE DEEP RUN.
 *
 * Two screens: build somebody, then take them down. The build is on paper
 * because it is yours; every room is on the dark because it is not.
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
import { useEffect, useRef, useState } from "react";
import {
  Announcer,
  Button,
  Card,
  Die,
  ErrorNote,
  Pill,
  Sheet,
  SheetBox,
  Spinner,
} from "@/components/ui";
import { postJson } from "@/components/client";
import { Adventurer, Behind, type Sheet as CharacterSheet } from "@/components/daily/Adventurer";
import { Reveal } from "@/components/daily/Reveal";
import { playOut, setSoundOn, soundOn } from "@/components/daily/sfx";
import { Runner } from "@/components/daily/Runner";
import { useLanded } from "@/components/daily/landed";
import { oneLine, readHero, recordNight, type Hero } from "@/lib/daily/hero";
import { ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import { FAILED_CHECK_EXTRA } from "@/lib/daily/core";
import type { Ability } from "@/lib/game/types";
import { readProgress, writeProgress } from "@/lib/daily/local";
import { DailyHeader, DieRule, NextUp, RuleLine, ShareCard, finishDaily, getPuzzle } from "../shell";

const GAME = "deeprun" as const;

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
  ability: Ability | null;
  tn: number | null;
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
};
type Room = { id: string; index: number; title: string; setup: string; boss: boolean; options: Option[] };

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
  archive: boolean;
  finished: boolean;
  par?: number;
  /** The line that scored par. Sent with the score, and never before it. */
  bestRun?: { build: { callingId: string; kitIds: string[] }; steps: Step[] } | null;
  share?: string;
};

type Step = { optionId: string; knack?: boolean };

/** "an 8", "an 11", "a 12". Printed in a sentence, so it has to read like one. */
function article(n: number | null): string {
  if (n === null) return "a";
  return n === 8 || n === 11 || n === 18 ? "an" : "a";
}

/** "wet", "wet and seen", "wet, seen and lit". Printed, so it has to read. */
function list(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

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
   * The runner: one character, kept between nights.
   *
   * Read after mount, never during render, because localStorage does not exist on
   * the server and a first client render that disagrees with the server's makes
   * React throw the whole tree away.
   */
  const [hero, setHero] = useState<Hero | null>(null);
  useEffect(() => setHero(readHero()), []);
  /**
   * Going down replaces the whole screen, so take the player with you.
   *
   * The build block is `{!down && ...}`, so pressing the button unmounts the
   * button, and focus fell to the body with nothing announced. The same hook the
   * other three dailies use for the same problem.
   */
  const descent = useLanded<HTMLDivElement>(down ? "down" : null);
  // Read after mount: localStorage does not exist while this renders on the
  // server, and disagreeing with the server's HTML throws the tree away.
  useEffect(() => setSound(soundOn()), []);
  const [reply, setReply] = useState<RunReply | null>(saved?.reply ?? null);
  const [streak, setStreak] = useState<number | null>(null);
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
   * Your character, as one object, built in one place.
   *
   * The per-ability sum is here and NOT on the doors, and that distinction is the
   * whole point: what you bring is yours to see, which door wants which ability is
   * not. `bonusFor` used to compute the same thing per door, which is what let
   * somebody play the game without reading a word of it.
   */
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
        vigour: vigour ?? data.baseVigour,
        baseVigour: data.baseVigour,
        floor: Math.min(seen + 1, data.rooms.length),
        floors: data.rooms.length,
        carrying,
      }
    : null;

  return (
    /*
     * Wide enough for the room and your sheet side by side once the descent
     * starts. The build screen keeps its own narrower column below, because a
     * form spread over 72rem is harder to read, not easier.
     */
    <section className={`mx-auto w-full py-8 ${down ? "max-w-5xl" : "max-w-2xl"}`}>
      {!dungeon && <DailyHeader game={GAME} date={data.date} archive={data.archive} />}
      <RuleLine game={GAME} />

      {/* ---------------------------------------------------------- the build */}
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
                          ? `${ABILITY_LABEL[ability]}, empty`
                          : `${ABILITY_LABEL[ability]}, ${value}, worth ${abilityMod(value) >= 0 ? "+" : ""}${abilityMod(value)}`
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

      {/* --------------------------------------------------------- the crawl */}
      {down && (
        <div className="mt-6" ref={descent}>
          {/*
            THREE ZONES, and the layout is the thing that says which is which.
            Adam: "there is no clear focus on this is your character, this is what
            is happening right now, this is what has happened."

            On a wide screen: the room and its doors on the left, your sheet and
            what is behind you in a sticky column on the right, so all of it fits
            one screen and your abilities never scroll away. On a narrow screen:
            three facts in a strip above the room, the room, then the sheet under
            it, because a phone has no column to spare and a sticky panel on a
            phone is a thing covering the game.
          */}
          <ErrorNote message={error} />

          {sheet && (
            <div className="mb-3 lg:hidden">
              <Adventurer sheet={sheet} compact />
            </div>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 space-y-4">

          {!finished && room && (
            <article className="tp-anim-reveal rounded-lg border border-border-strong bg-bg-1 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="label-caps">Floor {room.index + 1}</span>
                {room.boss && <Pill tone="danger">The bottom</Pill>}
                {carrying.map((m) => (
                  <Pill key={m} tone="accent">
                    {m}
                  </Pill>
                ))}
              </header>
              <h2 className="font-display mt-1 text-xl text-text-hi">{room.title}</h2>
              <p className="prose-read mt-2">{room.setup}</p>
              {carrying.length > 0 && (
                <p className="mt-1 text-sm text-text-mid">
                  You are {list(carrying)}, and some doors care about that.
                </p>
              )}
              <p className="mt-3 text-sm text-text-low">
                You do not know what this room rolled, and nobody does until somebody opens it.
                Nor which of your abilities a door leans on: that is in the writing, and it is
                the whole of the game. The sums arrive with the outcome.
              </p>
              <DieRule />

              <ul className="mt-3 space-y-3">
                {room.options.map((option) => {
                  // Which of this door's demands are not met. Named rather than
                  // implied: a door that is simply greyed out is a bug as far as
                  // the player is concerned.
                  const wants = (option.needs ?? []).filter((m) => !holding.has(m));
                  const refuses = (option.forbids ?? []).filter((m) => holding.has(m));
                  const shut = wants.length > 0 || refuses.length > 0;
                  const canKnack =
                    !knackSpent &&
                    !!calling &&
                    (["pass", "mend", "slip"].includes(calling.knack.kind) ||
                      option.kind === "check");
                  return (
                    <li
                      key={option.id}
                      className="rounded-md border border-border-dim bg-bg-2 p-3"
                    >
                      <p className="font-display text-text-hi">{option.label}</p>
                      <p className="mt-1 text-sm text-text-mid">{option.promise}</p>
                      {shut && (
                        <p className="mt-1 text-sm text-text-hi">
                          <span aria-hidden>&#9866; </span>
                          {wants.length > 0 && `Not for you without ${list(wants)}.`}
                          {wants.length > 0 && refuses.length > 0 && " "}
                          {refuses.length > 0 && `Not while you are ${list(refuses)}.`}
                        </p>
                      )}
                      {/*
                        A CHECK CANNOT PROMISE AN OUTCOME. This line rendered for
                        any door with `sets`, so the first door of the house
                        dungeon read "Works, and you come away carrying the
                        lantern" directly above "costs 3 if it goes wrong". A
                        brace does always work; a check does not, and it is the
                        only door copy that says what will happen.
                      */}
                      {!shut && (option.sets ?? []).length > 0 && (
                        <p className="mt-1 text-sm text-text-low">
                          {option.kind === "brace"
                            ? `You come away ${list(option.sets ?? [])}.`
                            : `Get through it and you come away ${list(option.sets ?? [])}.`}
                        </p>
                      )}
{/*
                        WHAT A DOOR TELLS YOU BEFORE YOU TAKE IT, and what it does
                        not.

                        It used to print the ability, your modifier and the face
                        you needed on every door, which meant the fastest way to
                        play well was to ignore every word of the writing and take
                        the biggest number. In a game about a dungeon that is the
                        wrong incentive: at a table you say what you are going to
                        do and the person running it tells you what to roll, so
                        the fiction comes first and the stat is a consequence of
                        it.

                        The cut is YOUR MODIFIER, not the room's number. What the
                        room wants is a fact about the room and stays public, the
                        way it always has been: this is a bet, not a riddle. What
                        goes is which ability it leans on and what you happen to
                        bring to it, because that pair is what let you rank three
                        doors without reading a word.

                        A first attempt printed a difficulty word instead of the
                        target. It was worse: on a floor whose doors want 11, 12
                        and 13 it said "Looks fair" three times, which is noise
                        dressed as signal. The number discriminates and still
                        tells you nothing about whether the door is yours.

                        The whole sum arrives in the ledger the moment the floor
                        resolves, which is where it teaches you what you should
                        have read.
                      */}
                      <p className="num mt-1 text-sm text-text-low">
                        {option.kind === "brace"
                          ? `Always works, and clears the floor. Costs ${option.vigour} Vigour, every time.`
                          : `The room wants ${article(option.tn)} ${option.tn} · costs ${option.vigour + FAILED_CHECK_EXTRA} Vigour if it goes wrong, and you do not clear the floor`}
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        <Button
                          size="lg"
                          disabled={busy || shut}
                          onClick={() => void choose(option, false)}
                        >
                          {option.label}
                        </Button>
                        {/*
                          THE KNACK BUTTON USED TO SAY ONLY THE KNACK'S NAME.
                          "Price the door", on its own, next to a door, with no
                          indication of what it did, whether it was free, or that
                          there was only ever one of them. Adam asked what it was
                          supposed to mean and he was right to.

                          It now says what it is, what it does and that it is the
                          only one you get. The explanation sits under the button
                          rather than in a tooltip, because a tooltip is not a
                          thing a thumb can hover over.
                        */}
                        {canKnack && (
                          <div className="rounded-md border border-accent/40 bg-accent-dim/40 p-2">
                            <Button
                              variant="secondary"
                              className="w-full"
                              disabled={busy || shut}
                              onClick={() => void choose(option, true)}
                            >
                              Use your one trick: {calling!.knack.label}
                            </Button>
                            <p className="mt-1 text-xs text-text-mid">
                              {calling!.knack.text} Once tonight, and you have not used it.
                            </p>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          )}

          {finished && reply && (
            <>
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
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-text-mid">Floors cleared</dt>
                    <dd className="num text-text-hi">{reply.roomsCleared}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-mid">Vigour left</dt>
                    <dd className="num text-text-hi">{reply.vigour}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border-dim pt-1">
                    <dt className="label-caps">Score</dt>
                    <dd className="num text-lg text-text-hi">
                      {reply.score}
                      {reply.par !== undefined ? ` of a possible ${reply.par}` : ""}
                    </dd>
                  </div>
                </dl>
              </Card>

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
                      const room = data.rooms[i];
                      const option = room?.options.find((o) => o.id === step.optionId);
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
            </>
          )}
            </div>

            {/* ------------------------------------------------- this is you */}
            <aside className="min-w-0 space-y-3 lg:sticky lg:top-4">
              {sheet && (
                <div className="hidden lg:block">
                  <Adventurer sheet={sheet} />
                </div>
              )}
              <Behind lines={behind} par={reply?.par ?? null} />
              {sheet && (
                <div className="lg:hidden">
                  <Adventurer sheet={sheet} />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = !sound;
                  setSound(next);
                  setSoundOn(next);
                }}
                aria-pressed={sound}
                className="min-h-11 w-full rounded-lg border border-border-dim px-3 text-sm text-text-mid hover:text-text-hi"
              >
                <span aria-hidden>{sound ? "🔊 " : "🔇 "}</span>
                Sound {sound ? "on" : "off"}
              </button>
            </aside>
          </div>
        </div>
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

      <Announcer message={announce} />
    </section>
  );
}
