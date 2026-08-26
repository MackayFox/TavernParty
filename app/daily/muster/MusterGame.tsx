"use client";

/**
 * MUSTER. Character creation as the whole game.
 *
 * No import of `lib/daily/muster`: that module computes par. `lib/game/rules` is
 * imported for the ability labels only, which is a table of six words and knows
 * nothing about tonight.
 *
 * The build is on the sheet and the encounter is on the dark, which is the
 * visual argument of the whole product: paper is yours, the night is not.
 */
import { useEffect, useRef, useState } from "react";
import { Announcer, Button, Card, Die, ErrorNote, Pill, Sheet, Spinner } from "@/components/ui";
import { postJson } from "@/components/client";
import { useLanded } from "@/components/daily/landed";
import { DailyHeader, DieRule, NextUp, RuleLine, ShareCard, finishDaily, getPuzzle } from "../shell";
import { clears, reachNote } from "@/lib/daily/core";
import { readProgress, writeProgress } from "@/lib/daily/local";
import { ABILITY_LABEL, AFFINITY_BONUS, abilityMod } from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";

const GAME = "muster" as const;

type Trial = { id: string; label: string; ability: Ability; tn: number; face: number };
type CallingCard = { id: string; name: string; blurb: string; affinities: [Ability, Ability] };
type KitCard = { id: string; name: string; blurb: string; ability: Ability; value: number };

type Payload = {
  date: string;
  archive: boolean;
  encounter: string;
  array: number[];
  abilities: Ability[];
  trials: Trial[];
  callings: CallingCard[];
  kit: KitCard[];
  sides: number;
};

type TrialResult = {
  id: string;
  label: string;
  ability: Ability;
  face: number;
  tn: number;
  mods: { label: string; value: number }[];
  total: number;
  cleared: boolean;
};

type Result = {
  cleared: number;
  trials: TrialResult[];
  archive: boolean;
  par: number;
  bestBuild: { placement: number[]; callingId: string; kitId: string };
  share: string;
};

type Saved = {
  placement: number[];
  callingId: string;
  kitId: string;
  result: Result | null;
};

function usable(value: Result | null | undefined, trials: number): Result | null {
  if (!value || !Array.isArray(value.trials) || value.trials.length !== trials) return null;
  if (!value.bestBuild || !Array.isArray(value.bestBuild.placement)) return null;
  if (typeof value.share !== "string" || typeof value.par !== "number") return null;
  return value;
}

export function MusterGame({ date }: { date?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [placement, setPlacement] = useState<number[]>([]);
  const [callingId, setCallingId] = useState("");
  const [kitId, setKitId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [streak, setStreak] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setRestored(false);
    getPuzzle<Payload>(`/api/daily/muster${date ? `?date=${encodeURIComponent(date)}` : ""}`)
      .then((payload) => {
        if (!live) return;
        const size = payload.array.length;
        const saved = readProgress<Saved>(GAME, payload.date);
        const ok =
          saved &&
          Array.isArray(saved.placement) &&
          saved.placement.length === size &&
          saved.placement.every((s) => Number.isInteger(s) && s >= 0 && s < size) &&
          payload.callings.some((c) => c.id === saved!.callingId) &&
          payload.kit.some((k) => k.id === saved!.kitId);
        setData(payload);
        setPlacement(ok ? saved!.placement : Array.from({ length: size }, (_, i) => i));
        setCallingId(ok ? saved!.callingId : payload.callings[0].id);
        setKitId(ok ? saved!.kitId : payload.kit[0].id);
        setResult(ok ? usable(saved!.result, payload.trials.length) : null);
        setRestored(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Tonight's muster will not load.");
        setRestored(true);
      });
    return () => {
      live = false;
    };
  }, [date]);

  useEffect(() => {
    if (!restored || !data) return;
    writeProgress(GAME, data.date, { placement, callingId, kitId, result } satisfies Saved);
  }, [restored, data, placement, callingId, kitId, result]);

  const locked = result !== null;
  /**
   * Take the player to the result.
   *
   * Muster resolves once, so the key is simply whether there is a result. Before
   * this the whole outcome appeared below a long build form and the page stayed
   * exactly where the button had been.
   */
  const landed = useLanded<HTMLDivElement>(result ? "result" : null);
  const duplicates = new Set(placement).size !== placement.length;
  const calling = data?.callings.find((c) => c.id === callingId);
  const kit = data?.kit.find((k) => k.id === kitId);

  function place(row: number, slot: number) {
    if (locked || !data) return;
    const next = [...placement];
    const held = next.indexOf(slot);
    if (held === row) return; // already there; nothing to say
    if (held !== -1) next[held] = next[row];
    next[row] = slot;
    setPlacement(next);
    setAnnounce(
      `${data.array[slot]} placed in ${ABILITY_LABEL[data.abilities[row]]}${
        held !== -1
          ? `, and ${data.array[next[held]]} moved to ${ABILITY_LABEL[data.abilities[held]]}`
          : ""
      }`
    );
  }

  /** The score a placement produces, for the sheet. Display only. */
  function scoreAt(row: number): number {
    return data?.array[placement[row]] ?? 10;
  }

  function bonusFor(ability: Ability): number {
    let bonus = 0;
    if (calling?.affinities.includes(ability)) bonus += AFFINITY_BONUS;
    if (kit?.ability === ability) bonus += kit.value;
    return bonus;
  }

  /**
   * What this build brings to one door, die included.
   *
   * The same sum the server builds in `resolve`: the face, the ability, the
   * training and the kit. Without it the whole game was six subtractions in your
   * head per candidate build, which buried the only decision in it: every night
   * is set so that at least one door cannot be answered, and choosing which one
   * to give up is the game. Guessing at that is not the same as deciding it.
   */
  function reachFor(trial: Trial): number {
    if (!data) return trial.face;
    const row = data.abilities.indexOf(trial.ability);
    return trial.face + abilityMod(scoreAt(row)) + bonusFor(trial.ability);
  }

  async function commit() {
    if (!data || locked || busy || duplicates) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<Result>("/api/daily/muster", {
        date: data.date,
        placement,
        callingId,
        kitId,
      });
      if (alive.current) {
        setResult(res);
        setAnnounce(
          `${res.cleared} of ${res.trials.length} doors cleared, against a best possible of ${res.par}.`
        );
      }
      const next = await finishDaily(GAME, data.date, res.cleared, res.par, res.archive);
      if (alive.current) setStreak(next);
    } catch (err: unknown) {
      if (alive.current)
        setError(err instanceof Error ? err.message : "That build would not stand. Try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl py-6 lg:max-w-5xl">
      <DailyHeader game={GAME} date={data?.date ?? null} archive={!!data?.archive} />
      <RuleLine game={GAME} />
      <ErrorNote message={error} />
      <Announcer message={announce} />

      {!restored ? (
        <Card className="mt-4" aria-busy="true">
          <Spinner label="Rolling tonight's numbers" />
        </Card>
      ) : data ? (
        <>
          {/*
            Two columns from `lg` up, the shape the Ledger already uses. Tonight's
            doors stay on screen while you place the numbers against them, because
            Muster is one decision made six times and it was being made by
            scrolling up to read a target number and back down to change a select.
            The phone keeps the single column: the doors first, then the build.

            The left column scrolls inside itself when it is taller than the
            window. A sticky panel taller than the viewport pins its top and hides
            its own bottom for good, which is worse than not sticking at all.
          */}
          <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
            {/*
              A REGION, AND FOCUSABLE, because it scrolls.
              Once the doors are taller than the window this clips, and a panel
              that scrolls with nothing focusable inside it is unreachable from a
              keyboard: tab order steps straight over it into the build. The role
              and the name are what make the tabstop mean something when it lands.
            */}
            <div
              role="region"
              aria-label="Tonight's work"
              tabIndex={0}
              className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            >
          <Card className="mt-4">
            <p className="label-caps">Tonight&apos;s work</p>
            <h2 className="font-display text-2xl font-bold text-text-hi">{data.encounter}</h2>
            <p className="mt-1 text-text-mid">
              Five doors. Every die has already been thrown and every one of them is below, so
              nothing that happens next is luck.
            </p>
            <ul className="mt-3 space-y-2">
              {data.trials.map((trial, i) => {
                const outcome = result?.trials[i];
                const reach = reachFor(trial);
                return (
                  <li
                    key={trial.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border-dim bg-bg-2 p-2"
                  >
                    <Die face={trial.face} sides={data.sides} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-text-hi">{trial.label}</span>
                      <span className="label-caps">
                        {ABILITY_LABEL[trial.ability]} · needs {trial.tn}
                      </span>
                      {/* What the character on the sheet would bring to this one,
                          updating as the numbers move. */}
                      {!locked ? (
                        <span className="num block text-sm text-accent">
                          your reach: {reach} ({reachNote(trial.face, reach, trial.tn)})
                        </span>
                      ) : null}
                    </span>
                    {outcome ? (
                      <span
                        className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${
                          outcome.cleared ? "text-success" : "text-danger"
                        }`}
                      >
                        <span aria-hidden>{outcome.cleared ? "✓ " : "✕ "}</span>
                        {outcome.cleared ? "Cleared" : "Failed"}
                        <span className="num ml-2 text-text-mid">{outcome.total}</span>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {/* Announced as well as shown: the doors are at the top of the page
                and the selects that change them are at the bottom of it. */}
            {!locked ? (
              <p className="mt-3 text-sm text-text-hi" role="status" aria-live="polite">
                This build clears{" "}
                <span className="num">
                  {data.trials.filter((t) => clears(t.face, reachFor(t), t.tn)).length}
                </span>{" "}
                of {data.trials.length}.
              </p>
            ) : null}
            <DieRule />
          </Card>
            </div>

            <div>
          <div className="mt-4">
            <Sheet
              title={calling?.name ?? "Unmustered"}
              subtitle={`Character sheet · ${data.date}`}
              className="max-w-none"
            >
              <p className="text-paper-ink">{calling?.blurb}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.abilities.map((ability, row) => {
                  const score = scoreAt(row);
                  const bonus = bonusFor(ability);
                  const mod = abilityMod(score) + bonus;
                  return (
                    <label key={ability} className="sheet-box block px-2 py-2">
                      <span className="sheet-label block">{ABILITY_LABEL[ability]}</span>
                      <select
                        className="num mt-1 min-h-11 w-full rounded-none border border-paper-rule bg-paper px-2 text-lg text-paper-ink disabled:opacity-70"
                        value={placement[row] ?? 0}
                        disabled={locked}
                        onChange={(e) => place(row, Number(e.target.value))}
                        aria-label={`Number for ${ABILITY_LABEL[ability]}`}
                      >
                        {data.array.map((value, slot) => (
                          <option key={slot} value={slot}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <span className="sheet-label mt-1 block">
                        {mod >= 0 ? "+" : ""}
                        {mod} on a roll
                        {bonus > 0 ? " (trained)" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="sheet-label mb-1 block">Calling</span>
                  <select
                    className="min-h-11 w-full rounded-none border border-paper-rule bg-paper px-3 text-base text-paper-ink disabled:opacity-70"
                    value={callingId}
                    disabled={locked}
                    onChange={(e) => {
                      setCallingId(e.target.value);
                      setAnnounce(
                        `Calling set to ${
                          data.callings.find((c) => c.id === e.target.value)?.name ??
                          e.target.value
                        }`
                      );
                    }}
                  >
                    {data.callings.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · trained in {ABILITY_LABEL[c.affinities[0]]} and{" "}
                        {ABILITY_LABEL[c.affinities[1]]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="sheet-label mb-1 block">Kit</span>
                  <select
                    className="min-h-11 w-full rounded-none border border-paper-rule bg-paper px-3 text-base text-paper-ink disabled:opacity-70"
                    value={kitId}
                    disabled={locked}
                    onChange={(e) => {
                      setKitId(e.target.value);
                      setAnnounce(
                        `Kit set to ${
                          data.kit.find((k) => k.id === e.target.value)?.name ?? e.target.value
                        }`
                      );
                    }}
                  >
                    {data.kit.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} · +{k.value} {ABILITY_LABEL[k.ability]}
                      </option>
                    ))}
                  </select>
                  {kit ? <span className="sheet-label mt-1 block">{kit.blurb}</span> : null}
                </label>
              </div>
            </Sheet>
          </div>

          {duplicates && !locked ? (
            <p role="alert" className="mt-3 text-sm text-warning">
              <span aria-hidden>◆ </span>Two abilities are down for the same number. All six go
              somewhere, once each.
            </p>
          ) : null}

          <Button
            size="lg"
            className="mt-4 w-full aria-disabled:opacity-40"
            onClick={commit}
            aria-disabled={busy || locked || duplicates}
            aria-busy={busy}
          >
            {locked ? "Mustered" : busy ? "Setting off" : "Face the night"}
          </Button>
            </div>
          </div>

          {result ? (
            <div className="mt-6 space-y-4" ref={landed}>
              <Card>
                <p className="label-caps">{data.encounter}</p>
                <p className="num mt-1 text-4xl text-text-hi">
                  {result.cleared}{" "}
                  <span className="text-lg text-text-low">of {result.trials.length}</span>
                </p>
                <p className="mt-1 text-text-mid">
                  The best build available tonight cleared{" "}
                  <span className="num text-accent">{result.par}</span>.{" "}
                  {result.cleared >= result.par
                    ? "There was no better character to bring."
                    : "Somebody built better than you did."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="accent">
                    par {result.par} of {result.trials.length}
                  </Pill>
                  {result.cleared === result.par ? <Pill tone="success">matched par</Pill> : null}
                </div>
              </Card>

              {result.cleared < result.par ? (
                <Card>
                  <p className="label-caps">What would have worked</p>
                  <p className="mt-2 text-text-hi">
                    {data.callings.find((c) => c.id === result.bestBuild.callingId)?.name}, carrying{" "}
                    {data.kit.find((k) => k.id === result.bestBuild.kitId)?.name}.
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {data.abilities.map((ability, row) => (
                      <li key={ability} className="text-sm text-text-mid">
                        <span className="label-caps">{ABILITY_LABEL[ability]}</span>{" "}
                        <span className="num text-text-hi">
                          {data.array[result.bestBuild.placement[row]]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <Card>
                <p className="label-caps">The ledger, door by door</p>
                <ul className="mt-2 space-y-3">
                  {result.trials.map((trial) => (
                    <li key={trial.id} className="border-b border-border-dim pb-2 last:border-0">
                      <p className="text-text-hi">{trial.label}</p>
                      <p className="num mt-1 text-sm text-text-mid">
                        {trial.mods.map((m) => `${m.label} ${m.value >= 0 ? "+" : ""}${m.value}`).join("  ")}
                        {"  =  "}
                        {trial.total} against {trial.tn}
                      </p>
                      <p
                        className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${
                          trial.cleared ? "text-success" : "text-danger"
                        }`}
                      >
                        <span aria-hidden>{trial.cleared ? "✓ " : "✕ "}</span>
                        {trial.cleared ? "Cleared" : "Failed"}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>

              <ShareCard text={result.share} />
              <NextUp game={GAME} archive={result.archive} streak={streak} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
