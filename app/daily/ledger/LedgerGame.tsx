"use client";

/**
 * THE LEDGER. Five drinkers, five debts, four true statements.
 *
 * The solved grid never comes near this file. `lib/daily/ledger` holds it, the
 * route settles every check and the close, and all this component ever has is
 * the names, the amounts and the sentences.
 *
 * The grid is on the sheet, because a ledger with your handwriting in it is
 * yours: paper is the only light surface in the product and it always means
 * exactly that.
 */
import { useEffect, useRef, useState } from "react";
import { Announcer, Button, Card, ErrorNote, Pill, Sheet, Spinner } from "@/components/ui";
import { postJson } from "@/components/client";
import { useLanded } from "@/components/daily/landed";
import { DailyHeader, NextUp, RuleLine, ShareCard, finishDaily, getPuzzle } from "../shell";
import { readProgress, writeProgress } from "@/lib/daily/local";

const GAME = "ledger" as const;

type Payload = {
  date: string;
  archive: boolean;
  names: string[];
  amounts: number[];
  clues: string[];
  maxChecks: number;
  maxScore: number;
};

type CheckReply = { mode: "check"; correctRows: number; rows: number };

type Closed = {
  mode: "close";
  archive: boolean;
  solved: boolean;
  score: number;
  maxScore: number;
  checksUsed: number;
  solution: number[];
  share: string;
};

type Saved = { assignment: number[]; checks: number; closed: Closed | null };

function usable(value: Closed | null | undefined, rows: number): Closed | null {
  if (!value || value.mode !== "close") return null;
  if (!Array.isArray(value.solution) || value.solution.length !== rows) return null;
  if (typeof value.share !== "string" || typeof value.score !== "number") return null;
  return value;
}

export function LedgerGame({ date }: { date?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [assignment, setAssignment] = useState<number[]>([]);
  const [checks, setChecks] = useState(0);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [closed, setClosed] = useState<Closed | null>(null);
  /**
   * Take the player to the verdict.
   *
   * The Ledger closes once, so the key is simply whether it has. Before this the
   * verdict appeared under a five by five grid and four clues and the page did not
   * move, so on a phone you pressed Close and nothing visibly happened.
   */
  const landed = useLanded<HTMLDivElement>(closed ? "closed" : null);
  const [arming, setArming] = useState(false);
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
    setCheckNote(null);
    getPuzzle<Payload>(`/api/daily/ledger${date ? `?date=${encodeURIComponent(date)}` : ""}`)
      .then((payload) => {
        if (!live) return;
        const rows = payload.names.length;
        const saved = readProgress<Saved>(GAME, payload.date);
        const ok =
          saved &&
          Array.isArray(saved.assignment) &&
          saved.assignment.length === rows &&
          saved.assignment.every((a) => Number.isInteger(a) && a >= 0 && a < rows);
        setData(payload);
        setAssignment(ok ? saved!.assignment : Array.from({ length: rows }, (_, i) => i));
        setChecks(ok && typeof saved!.checks === "number" ? saved!.checks : 0);
        setClosed(ok ? usable(saved!.closed, rows) : null);
        setRestored(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Tonight's ledger will not load.");
        setRestored(true);
      });
    return () => {
      live = false;
    };
  }, [date]);

  useEffect(() => {
    if (!restored || !data) return;
    writeProgress(GAME, data.date, { assignment, checks, closed } satisfies Saved);
  }, [restored, data, assignment, checks, closed]);

  const locked = closed !== null;
  const duplicates = new Set(assignment).size !== assignment.length;
  const checksLeft = data ? data.maxChecks - checks : 0;

  function assign(row: number, amountIndex: number) {
    if (locked || !data) return;
    const next = [...assignment];
    // Swap, so the column is always a real one-to-one ledger.
    const held = next.indexOf(amountIndex);
    if (held === row) return; // already there; nothing to say
    if (held !== -1) next[held] = next[row];
    next[row] = amountIndex;
    setAssignment(next);
    setArming(false); // they are still writing; the close is not armed any more
    setAnnounce(`${data.names[row]} written down for ${data.amounts[amountIndex]} shillings`);
  }

  /**
   * Closing settles the day and cannot be undone, and the button sits next to one
   * that merely costs one off the tally. A mis-tap was the entire game, so it
   * takes two, and any change to the grid disarms it again.
   */
  function armOrClose() {
    if (!arming) {
      setArming(true);
      setAnnounce("Press close again to settle it. There is no going back.");
      return;
    }
    void close();
  }

  async function check() {
    if (!data || locked || busy || duplicates || checksLeft <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<CheckReply>("/api/daily/ledger", {
        date: data.date,
        assignment,
        mode: "check",
      });
      if (!alive.current) return;
      setChecks((n) => n + 1);
      const line =
        res.correctRows === res.rows
          ? "Every line is right. Close it."
          : `${res.correctRows} of the ${res.rows} lines are right. Not which ones.`;
      setCheckNote(line);
      setAnnounce(line);
    } catch (err: unknown) {
      if (alive.current)
        setError(err instanceof Error ? err.message : "That check would not run. Try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function close() {
    if (!data || locked || busy || duplicates) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<Closed>("/api/daily/ledger", {
        date: data.date,
        assignment,
        mode: "close",
        checksUsed: checks,
      });
      if (alive.current) {
        setClosed(res);
        setAnnounce(
          res.solved
            ? `The ledger balances. ${res.score} of ${res.maxScore} on the tally.`
            : "The ledger does not balance. The true figures are now shown."
        );
      }
      const next = await finishDaily(GAME, data.date, res.score, null, res.archive);
      if (alive.current) setStreak(next);
    } catch (err: unknown) {
      if (alive.current)
        setError(err instanceof Error ? err.message : "That would not close. Try again.");
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
          <Spinner label="Opening the ledger" />
        </Card>
      ) : data ? (
        <>
          <Card className="mt-4">
            <p className="label-caps">What is known, and all of it is true</p>
            <ol className="mt-2 space-y-2">
              {data.clues.map((clue, i) => (
                <li key={i} className="flex gap-3 text-text-hi">
                  <span className="num shrink-0 text-text-low">{i + 1}</span>
                  <span>{clue}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-text-low">
              Five debts, one each: {data.amounts.map((a) => `${a}s`).join(", ")}. There is exactly
              one arrangement that fits all four statements.
            </p>
          </Card>

          <div className="mt-4">
            <Sheet title="The Ledger" subtitle={data.date}>
              <ul className="space-y-3">
                {data.names.map((name, row) => {
                  const truth = closed ? data.amounts[closed.solution[row]] : null;
                  const right = closed ? closed.solution[row] === assignment[row] : null;
                  return (
                    <li key={name} className="border-b border-paper-rule pb-3 last:border-0">
                      <label className="block">
                        <span className="font-display block text-lg font-bold text-paper-ink">
                          {name}
                        </span>
                        <span className="sheet-label mb-1 block">owes</span>
                        <select
                          className="min-h-11 w-full rounded-none border border-paper-rule bg-paper px-3 text-base text-paper-ink disabled:opacity-70"
                          value={assignment[row] ?? 0}
                          disabled={locked}
                          onChange={(e) => assign(row, Number(e.target.value))}
                          aria-label={`What ${name} owes`}
                        >
                          {data.amounts.map((amount, i) => (
                            <option key={i} value={i}>
                              {amount} shillings
                            </option>
                          ))}
                        </select>
                      </label>
                      {closed ? (
                        <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm text-paper-ink">
                          <span aria-hidden>{right ? "✓" : "✕"}</span>
                          <span className="sheet-label">{right ? "Correct" : "Wrong"}</span>
                          <span className="num">
                            {name} owed {truth}s
                          </span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Sheet>
          </div>

          {duplicates && !locked ? (
            <p role="alert" className="mt-3 text-sm text-warning">
              <span aria-hidden>◆ </span>Two drinkers are down for the same figure. Each debt
              belongs to exactly one of them.
            </p>
          ) : null}

          {!locked ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={checksLeft > 0 ? "accent" : "danger"}>
                  {checksLeft} of {data.maxChecks} checks left
                </Pill>
                <Pill tone="neutral">worth {data.maxScore - checks} marks</Pill>
              </div>
              {checkNote ? (
                <p className="rounded-md border border-border-dim bg-bg-1 px-3 py-2 text-sm text-text-hi">
                  {checkNote}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 aria-disabled:opacity-40"
                  onClick={check}
                  aria-disabled={busy || duplicates || checksLeft <= 0}
                  aria-busy={busy}
                >
                  {checksLeft <= 0 ? "No checks left" : "Check it (costs a mark)"}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 aria-disabled:opacity-40"
                  onClick={armOrClose}
                  aria-disabled={busy || duplicates}
                  aria-busy={busy}
                >
                  {arming ? "Yes, close it" : "Close the ledger"}
                </Button>
              </div>
              <p className="text-sm text-text-low">
                {arming
                  ? "Press it again and that is your answer for today."
                  : "Closing it is free and final, so it takes two presses. A check tells you how many lines are right and never which, and it costs you a mark whether the news is good or not."}
              </p>
            </div>
          ) : null}

          {closed ? (
            <div className="mt-6 space-y-4" ref={landed}>
              <Card>
                <p className="label-caps">{closed.solved ? "It balances" : "It does not balance"}</p>
                <p className="num mt-1 text-4xl text-text-hi">
                  {closed.score} <span className="text-lg text-text-low">/ {closed.maxScore}</span>
                </p>
                <p className="mt-1 text-text-mid">
                  {closed.solved
                    ? closed.checksUsed === 0
                      ? "Closed first time, without a single check. The landlord is quietly impressed."
                      : `Closed on ${closed.checksUsed === 1 ? "one check" : `${closed.checksUsed} checks`}.`
                    : "Somebody has been written down for the wrong figure. The true column is on the sheet."}
                </p>
              </Card>
              <ShareCard text={closed.share} />
              <NextUp game={GAME} archive={closed.archive} streak={streak} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
