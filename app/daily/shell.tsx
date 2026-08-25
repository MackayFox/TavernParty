"use client";

/**
 * The furniture every daily shares: the heading, the one-line rule, the practice
 * note, the share block and the what-next block.
 *
 * It exists so the four games only contain their own game. It imports
 * `lib/daily/core` and nothing else from `lib/daily`, because core is the only
 * daily module that cannot resolve an answer.
 */
import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { postJson, shareOrCopy, useNow } from "@/components/client";
import {
  DAILY_META,
  DIE_RULE,
  archiveDates,
  msUntilReset,
  prettyDate,
  type DailyGame,
} from "@/lib/daily/core";
import { localStats, pruneProgress, recordCounted, recordDone } from "@/lib/daily/local";

/**
 * Fetch one night's puzzle.
 *
 * Deliberately not `getJson`, which sends `cache: "no-store"`: that helper exists
 * for live room state, where a stale answer is a wrong answer. A daily is the
 * opposite. It is one constant per UTC day, the same bytes for everybody, and
 * the route now says so in a Cache-Control that expires at the reset, so the
 * browser is allowed to keep it and a reload costs nothing.
 */
export async function getPuzzle<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
  return data as T;
}

/**
 * The one thing the arithmetic on a page cannot show you, said out loud.
 *
 * It is stated nowhere else in the product, and three of the four dailies hand
 * you the die before you choose, so without this a face of 1 or 20 looks like an
 * ordinary number that has been mislabelled.
 */
export function DieRule() {
  return <p className="mt-2 text-sm text-text-low">{DIE_RULE}</p>;
}

export function DailyHeader({
  game,
  date,
  archive,
}: {
  game: DailyGame;
  date: string | null;
  archive: boolean;
}) {
  const meta = DAILY_META[game];
  return (
    <header>
      <p className="label-caps">
        <span aria-hidden>{meta.glyph} </span>
        {date ? prettyDate(date) : "Tonight"}
      </p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        {meta.name}
      </h1>
      <p className="prose-read mt-2 text-text-mid">{meta.blurb}</p>
      {archive ? (
        <p
          role="note"
          className="mt-3 rounded-md border border-warning/40 bg-bg-1 px-3 py-2 text-sm text-warning"
        >
          <span aria-hidden>◆ </span>
          <span className="font-semibold uppercase">Practice.</span> An old night, replayed. It
          does not touch your streak.
        </p>
      ) : null}
    </header>
  );
}

/** The rule, in one line, above the first input. Never more than one line. */
export function RuleLine({ game }: { game: DailyGame }) {
  return (
    <p className="mt-4 rounded-md border border-border-dim bg-bg-1 px-4 py-3 text-text-hi">
      <span className="label-caps mr-2 text-accent">Rule</span>
      {DAILY_META[game].rule}
    </p>
  );
}

/**
 * Record a finished game.
 *
 * The guest path is first and cannot fail: the score goes into localStorage
 * before any request is made, and a registered user's save is a best effort on
 * top of it. Returns the streak to show, from whichever source answered.
 */
export async function finishDaily(
  game: DailyGame,
  date: string,
  score: number,
  par: number | null,
  archive: boolean
): Promise<number> {
  recordDone(game, date, score);
  // Practice does not build a streak, and until now it did: the streak walked the
  // same map this line writes, so replaying yesterday from the archive extended
  // it, while three strings in this file and the archive page promised otherwise.
  if (!archive) recordCounted(game, date, score);
  // Progress keys are per game per date and nothing was ever clearing them, so a
  // regular player's localStorage grew forever until the quota refused a write.
  // `writeProgress` swallows that failure, so the symptom would have been the
  // dailies quietly forgetting a half-finished puzzle: the bug this is meant to
  // prevent, arriving eighteen months late.
  //
  // A quarter rather than a month, because the window is also what protects a
  // half-finished ARCHIVE night from being tidied away by finishing something
  // else today. The date just played is kept whatever its age.
  pruneProgress([...archiveDates(90), date]);
  const local = localStats(game).streak;
  if (archive) return local;
  try {
    const saved = await postJson<{ stats?: { streak: number } | null }>("/api/daily/result", {
      game,
      score,
      par,
      date,
    });
    return saved.stats?.streak ?? local;
  } catch {
    // A failed save must never block a result screen.
    return local;
  }
}

export function ShareCard({ text }: { text: string }) {
  const [note, setNote] = useState("");
  return (
    <Card>
      <p className="label-caps">Tell them what happened</p>
      <pre className="num mt-2 whitespace-pre-wrap break-words text-sm text-text-hi">{text}</pre>
      <Button className="mt-3 w-full" onClick={async () => setNote(noteFor(await shareOrCopy(text)))}>
        Share
      </Button>
      <p className="mt-2 text-xs text-text-low" role="status" aria-live="polite">
        {note}
      </p>
    </Card>
  );
}

function noteFor(outcome: "shared" | "copied" | "failed"): string {
  if (outcome === "shared") return "Shared.";
  if (outcome === "copied") return "Copied to your clipboard.";
  return "Could not copy. Select the lines above instead.";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Countdown() {
  const ms = msUntilReset(useNow(1000));
  return (
    <span className="num">
      {pad(Math.floor(ms / 3_600_000))}:{pad(Math.floor(ms / 60_000) % 60)}:
      {pad(Math.floor(ms / 1000) % 60)}
    </span>
  );
}

/** Streak, the clock, and the other three. Shown once a game is over. */
export function NextUp({
  game,
  archive,
  streak,
}: {
  game: DailyGame;
  archive: boolean;
  streak: number | null;
}) {
  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        {archive ? (
          <p className="text-sm text-text-mid">A practice night. Your streak is untouched.</p>
        ) : (
          <p className="text-sm text-text-mid">
            Streak: <span className="num text-text-hi">{streak ?? 0}</span>{" "}
            {streak === 1 ? "day" : "days"}
          </p>
        )}
        <p className="text-sm text-text-mid">
          Next one in <Countdown />
        </p>
      </Card>

      <Card>
        <p className="label-caps">The other three</p>
        <ul className="mt-2 space-y-2">
          {Object.entries(DAILY_META)
            .filter(([key]) => key !== game)
            .map(([key, meta]) => (
              <li key={key}>
                <Link
                  href={meta.path}
                  className="flex min-h-11 items-center gap-3 rounded-md border border-border-dim bg-bg-2 px-3 py-2 hover:border-accent/50"
                >
                  <span aria-hidden className="text-lg">
                    {meta.glyph}
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block uppercase text-text-hi">{meta.name}</span>
                    <span className="block text-xs text-text-mid">{meta.rule}</span>
                  </span>
                </Link>
              </li>
            ))}
        </ul>
        <p className="mt-4 text-sm text-text-mid">
          Had enough of your own company?{" "}
          <Link href="/" className="text-accent underline">
            Take a table
          </Link>{" "}
          and survive a night with up to five other people.
        </p>
      </Card>
    </>
  );
}
