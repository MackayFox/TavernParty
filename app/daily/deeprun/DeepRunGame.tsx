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
import { getJson, postJson } from "@/components/client";
import { ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";
import { DailyHeader, NextUp, RuleLine, ShareCard, finishDaily } from "../shell";

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
};
type Room = { id: string; index: number; title: string; setup: string; boss: boolean; options: Option[] };

type Payload = {
  date: string;
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
  share?: string;
};

type Step = { optionId: string; knack?: boolean };

export function DeepRunGame({ date }: { date: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = date ? `/api/daily/deeprun?date=${encodeURIComponent(date)}` : "/api/daily/deeprun";
    getJson<Payload>(url)
      .then(setData)
      .catch(() => setError("Could not find the way in. Try again."));
  }, [date]);

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
  return <Run key={data.date} data={data} />;
}

function Run({ data }: { data: Payload }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  // The build.
  const [callingId, setCallingId] = useState<string | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>(() =>
    new Array(data.abilities.length).fill(null)
  );
  const [held, setHeld] = useState<number | null>(null);
  const [kitIds, setKitIds] = useState<string[]>([]);
  const [down, setDown] = useState(false);

  // The descent.
  const [steps, setSteps] = useState<Step[]>([]);
  const [reply, setReply] = useState<RunReply | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const recorded = useRef(false);

  const finished = !!reply?.finished;

  useEffect(() => {
    if (!finished || !reply || recorded.current) return;
    recorded.current = true;
    void finishDaily(GAME, data.date, reply.score, reply.par ?? null, reply.archive).then(
      setStreak
    );
  }, [finished, data.date, reply]);

  const calling = data.callings.find((c) => c.id === callingId);
  const placed = slots.filter((s) => s !== null).length;
  const tray = data.array.map((_, i) => i).filter((i) => !slots.includes(i));
  const buildReady = !!calling && placed === data.abilities.length && kitIds.length === 2;

  /** What a score of this ability comes to, once the build is on it. */
  function bonusFor(ability: Ability): number {
    const slot = slots[data.abilities.indexOf(ability)];
    let total = slot === null ? 0 : abilityMod(data.array[slot]);
    if (calling?.affinities.includes(ability)) total += 2;
    for (const id of kitIds) {
      const item = data.kit.find((k) => k.id === id);
      if (item?.ability === ability) total += item.value;
    }
    return total;
  }

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

  function autoPlace() {
    if (!calling) return;
    const order: Ability[] = [
      ...calling.affinities,
      ...data.abilities.filter((a) => !calling.affinities.includes(a)),
    ];
    const byValue = data.array
      .map((value, i) => ({ value, i }))
      .sort((a, b) => b.value - a.value);
    const next = new Array<number | null>(data.abilities.length).fill(null);
    order.forEach((ability, rank) => {
      next[data.abilities.indexOf(ability)] = byValue[rank].i;
    });
    setSlots(next);
    setHeld(null);
    setAnnounce("Best numbers on what you are trained for");
  }

  async function choose(option: Option, knack: boolean) {
    if (!buildReady || busy) return;
    setBusy(true);
    setError(null);
    const next: Step[] = [...steps, knack ? { optionId: option.id, knack: true } : { optionId: option.id }];
    try {
      const result = await postJson<RunReply>("/api/daily/deeprun", {
        date: data.date,
        callingId,
        placement: slots.map((s) => s ?? 0),
        kitIds,
        steps: next,
      });
      setSteps(next);
      setReply(result);
      const line = result.lines[result.lines.length - 1];
      if (line) setAnnounce(`${line.cleared ? "Cleared" : "Not cleared"}. ${line.text}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const vigour = reply ? reply.vigour : null;
  const room = data.rooms[steps.length];
  const knackSpent = steps.some((s) => s.knack);

  return (
    <section className="mx-auto w-full max-w-2xl py-8">
      <DailyHeader game={GAME} date={data.date} archive={data.archive} />
      <RuleLine game={GAME} />

      {/* ---------------------------------------------------------- the build */}
      {!down && (
        <div className="mt-6 space-y-4">
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
                Best on what I am trained for
              </Button>
              <span className="sheet-label self-center">
                Grit also buys you the wind to keep going.
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

          <Button size="lg" disabled={!buildReady} onClick={() => setDown(true)}>
            {buildReady
              ? "Go down"
              : !calling
                ? "Pick who is going first"
                : placed < data.abilities.length
                  ? `Place ${data.abilities.length - placed} more`
                  : "Take two things with you"}
          </Button>
        </div>
      )}

      {/* --------------------------------------------------------- the crawl */}
      {down && (
        <div className="mt-6 space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span className="label-caps">
              {calling?.name} · floor {Math.min(steps.length + 1, data.rooms.length)} of{" "}
              {data.rooms.length}
            </span>
            <span className="num text-text-hi">
              {/* Never a bar alone: the number and the word are both here. */}
              Vigour {vigour ?? data.baseVigour}
              {vigour !== null && vigour <= 2 ? " · nearly done" : ""}
            </span>
            {!knackSpent && calling && <Pill tone="accent">{calling.knack.label} in hand</Pill>}
          </Card>

          <ErrorNote message={error} />

          {reply?.lines.map((line) => (
            <article
              key={line.roomIndex}
              className="rounded-lg border border-border-dim bg-bg-1 p-4"
            >
              <header className="flex flex-wrap items-center gap-2">
                <span className="label-caps">Floor {line.roomIndex + 1}</span>
                <span className="font-display text-text-hi">{line.title}</span>
                <Pill tone={line.cleared ? "success" : "danger"}>
                  {line.cleared ? "✓ Cleared" : "✕ Not cleared"}
                </Pill>
              </header>
              <p className="mt-1 text-sm text-text-mid">{line.label}</p>
              {line.roll > 0 && (
                <div className="mt-2 flex items-start gap-3">
                  <Die face={line.roll} size={44} />
                  <dl className="min-w-0 flex-1">
                    {line.mods.map((mod, i) => (
                      <div
                        key={`${mod.label}-${i}`}
                        className="flex items-baseline justify-between gap-3 border-b border-border-dim py-0.5"
                      >
                        <dt className="text-sm text-text-mid">{mod.label}</dt>
                        <dd className="num text-sm text-text-hi">
                          {mod.value >= 0 ? "+" : ""}
                          {mod.value}
                        </dd>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <dt className="label-caps">Total</dt>
                      <dd className="num text-text-hi">{line.total}</dd>
                    </div>
                    {line.tn !== null && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="label-caps">Needed</dt>
                        <dd className="num text-text-hi">{line.tn}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
              <p className="prose-read mt-2">{line.text}</p>
              {line.vigourSpent > 0 && (
                <p className="num mt-1 text-sm text-danger">
                  ✕ {line.vigourSpent} Vigour, {line.vigourAfter} left
                </p>
              )}
            </article>
          ))}

          {!finished && room && (
            <article className="tp-anim-reveal rounded-lg border border-border-strong bg-bg-1 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="label-caps">Floor {room.index + 1}</span>
                {room.boss && <Pill tone="danger">The bottom</Pill>}
              </header>
              <h2 className="font-display mt-1 text-xl text-text-hi">{room.title}</h2>
              <p className="prose-read mt-2">{room.setup}</p>
              <p className="mt-3 text-sm text-text-low">
                You do not know what this room rolled. Nobody does until somebody opens it.
              </p>

              <ul className="mt-3 space-y-3">
                {room.options.map((option) => {
                  const bonus = option.ability ? bonusFor(option.ability) : 0;
                  const need =
                    option.tn !== null ? Math.max(1, Math.min(20, option.tn - bonus)) : null;
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
                      <p className="num mt-1 text-sm text-text-low">
                        {option.kind === "brace"
                          ? `Always works. Costs ${option.vigour} Vigour, every time.`
                          : `${ABILITY_LABEL[option.ability!]} · you bring ${bonus >= 0 ? "+" : ""}${bonus} · needs ${option.tn}, so a ${need} or better · costs ${option.vigour} if it goes wrong`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button disabled={busy} onClick={() => void choose(option, false)}>
                          {option.label}
                        </Button>
                        {canKnack && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void choose(option, true)}
                          >
                            {calling!.knack.label}
                          </Button>
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
              {reply.share && <ShareCard text={reply.share} />}
              <NextUp game={GAME} archive={reply.archive} streak={streak} />
            </>
          )}
        </div>
      )}

      <Announcer message={announce} />
    </section>
  );
}
