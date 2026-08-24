"use client";

/**
 * TABLE OF SIX. Six rolls, six obstacles, one assignment.
 *
 * Nothing here imports `lib/daily/tableofsix`: that module can work out the
 * optimum, and the optimum is the answer. Everything this file knows arrives
 * from the route, and the score comes back from the route too.
 *
 * The assignment is made with six native selects rather than a drag surface.
 * Dragging six dice around a table would be prettier and would exclude anybody
 * on a keyboard, a screen reader or a bad touchscreen, and a select is the one
 * control every one of those already knows how to drive.
 */
import { useEffect, useRef, useState } from "react";
import { Announcer, Card, Button, Die, ErrorNote, Pill, Spinner } from "@/components/ui";
import { getJson, postJson } from "@/components/client";
import { DailyHeader, NextUp, RuleLine, ShareCard, finishDaily } from "../shell";
import { readProgress, writeProgress } from "@/lib/daily/local";

const GAME = "tableofsix" as const;

type Obstacle = {
  id: string;
  label: string;
  ability: string;
  tn: number;
  deed: number;
  cost: number;
};

type Payload = {
  date: string;
  archive: boolean;
  faces: number[];
  obstacles: Obstacle[];
  sides: number;
  starting: number[];
};

type Line = { obstacleId: string; face: number; slot: number; cleared: boolean; value: number };

type Result = {
  total: number;
  lines: Line[];
  par: number;
  bestSlots: number[];
  share: string;
  archive: boolean;
};

type Saved = { slots: number[]; result: Result | null };

/** localStorage is editable and can go stale across releases. Trust nothing. */
function usable(value: Result | null | undefined, slots: number): Result | null {
  if (!value || !Array.isArray(value.lines) || value.lines.length !== slots) return null;
  if (!Array.isArray(value.bestSlots) || typeof value.share !== "string") return null;
  if (typeof value.total !== "number" || typeof value.par !== "number") return null;
  return value;
}

export function TableOfSixGame({ date }: { date?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [slots, setSlots] = useState<number[]>([]);
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
    getJson<Payload>(`/api/daily/tableofsix${date ? `?date=${encodeURIComponent(date)}` : ""}`)
      .then((payload) => {
        if (!live) return;
        const saved = readProgress<Saved>(GAME, payload.date);
        const ok =
          saved &&
          Array.isArray(saved.slots) &&
          saved.slots.length === payload.obstacles.length &&
          saved.slots.every((s) => Number.isInteger(s) && s >= 0 && s < payload.faces.length);
        setData(payload);
        setSlots(ok ? saved!.slots : payload.starting);
        setResult(ok ? usable(saved!.result, payload.obstacles.length) : null);
        setRestored(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Tonight's dice will not load.");
        setRestored(true);
      });
    return () => {
      live = false;
    };
  }, [date]);

  useEffect(() => {
    if (!restored || !data) return;
    writeProgress(GAME, data.date, { slots, result } satisfies Saved);
  }, [restored, data, slots, result]);

  const locked = result !== null;
  const duplicates = new Set(slots).size !== slots.length;

  function assign(row: number, slot: number) {
    if (locked || !data) return;
    const next = [...slots];
    // Swap rather than overwrite, so the grid is always a real assignment and
    // nobody has to hunt for the die they just displaced.
    const held = next.indexOf(slot);
    if (held === row) return; // already there; nothing to say
    if (held !== -1) next[held] = next[row];
    next[row] = slot;
    setSlots(next);
    setAnnounce(
      `${data.faces[slot]} assigned to ${data.obstacles[row].label}${
        held !== -1 ? `, and ${data.faces[next[held]]} moved to ${data.obstacles[held].label}` : ""
      }`
    );
  }

  async function submit() {
    if (!data || locked || busy || duplicates) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<Result>("/api/daily/tableofsix", { date: data.date, slots });
      if (alive.current) {
        setResult(res);
        setAnnounce(
          `Assigned. ${res.total} against a best possible of ${res.par}. Every obstacle now shows what it paid.`
        );
      }
      const next = await finishDaily(GAME, data.date, res.total, res.par, res.archive);
      if (alive.current) setStreak(next);
    } catch (err: unknown) {
      if (alive.current)
        setError(err instanceof Error ? err.message : "That would not go in. Try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl py-6">
      <DailyHeader game={GAME} date={data?.date ?? null} archive={!!data?.archive} />
      <RuleLine game={GAME} />
      <ErrorNote message={error} />
      <Announcer message={announce} />

      {!restored ? (
        <Card className="mt-4" aria-busy="true">
          <Spinner label="Throwing tonight's six" />
        </Card>
      ) : data ? (
        <>
          <Card className="mt-4">
            <p className="label-caps">Tonight&apos;s six, thrown once for everybody</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {data.faces.map((face, slot) => {
                const usedBy = slots.indexOf(slot);
                return (
                  <li key={slot} className="flex flex-col items-center gap-1">
                    <Die face={face} sides={data.sides} size={48} />
                    <span className="label-caps text-[10px]">
                      {usedBy === -1 ? "spare" : `on ${usedBy + 1}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <ol className="mt-4 space-y-3">
            {data.obstacles.map((obstacle, row) => {
              const line = result?.lines[row];
              const bestSlot = result?.bestSlots[row];
              return (
                <li key={obstacle.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="label-caps">Obstacle {row + 1}</p>
                        <p className="font-display text-lg text-text-hi">{obstacle.label}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <Pill tone="neutral">needs {obstacle.tn}</Pill>
                        <Pill tone="success">pays {obstacle.deed}</Pill>
                        <Pill tone="danger">costs {obstacle.cost}</Pill>
                      </div>
                    </div>

                    <label className="mt-3 block">
                      <span className="label-caps mb-1 block">Send which roll</span>
                      <select
                        aria-label={`Send which roll to: ${obstacle.label}`}
                        className="min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-3 text-base text-text-hi disabled:opacity-60"
                        value={slots[row] ?? 0}
                        disabled={locked}
                        onChange={(e) => assign(row, Number(e.target.value))}
                      >
                        {data.faces.map((face, slot) => (
                          <option key={slot} value={slot}>
                            Die {slot + 1}: rolled {face}
                          </option>
                        ))}
                      </select>
                    </label>

                    {line ? (
                      <p
                        className={`mt-3 flex flex-wrap items-baseline gap-2 text-sm ${
                          line.cleared ? "text-success" : "text-danger"
                        }`}
                      >
                        <span aria-hidden>{line.cleared ? "✓" : "✕"}</span>
                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
                          {line.cleared ? "Cleared" : "Failed"}
                        </span>
                        <span className="num text-text-hi">
                          {line.face} against {obstacle.tn}
                        </span>
                        <span className="num">
                          {line.value >= 0 ? "+" : ""}
                          {line.value}
                        </span>
                        {bestSlot !== undefined && bestSlot !== line.slot ? (
                          <span className="text-text-low">
                            best line sent die {bestSlot + 1}, a {data.faces[bestSlot]}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ol>

          {duplicates && !locked ? (
            <p role="alert" className="mt-3 text-sm text-warning">
              <span aria-hidden>◆ </span>Two obstacles are waiting on the same die. Every roll goes
              somewhere, and only somewhere.
            </p>
          ) : null}

          {/* aria-disabled, not disabled: a disabled button gets blurred by the
              browser, which throws keyboard focus to the top of the page at the
              exact moment the result appears below it. submit() refuses. */}
          <Button
            size="lg"
            className="mt-4 w-full aria-disabled:opacity-40"
            onClick={submit}
            aria-disabled={busy || locked || duplicates}
            aria-busy={busy}
          >
            {locked ? "Sent" : busy ? "Sending" : "Send them in"}
          </Button>

          {result ? (
            <div className="mt-6 space-y-4">
              <Card>
                <p className="label-caps">The reckoning</p>
                <p className="num mt-1 text-4xl text-text-hi">{result.total}</p>
                <p className="mt-1 text-text-mid">
                  The best any assignment could have taken was{" "}
                  <span className="num text-accent">{result.par}</span>.{" "}
                  {result.total === result.par
                    ? "There was nothing left on the table."
                    : `You left ${result.par - result.total} behind.`}
                </p>
                <p className="mt-2 text-sm text-text-low">
                  A twenty clears anything and a one clears nothing, whatever the target number
                  says. Usually the question is who gets the one.
                </p>
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
