"use client";

/**
 * WHAT YOU HAVE ALREADY DONE TONIGHT, on the hub that lists tonight's four.
 *
 * The hub used to be four identical cards and a date. Every one of them looked
 * unplayed whether you had played it or not, so the only way to find out where you
 * were up to was to open all four and read the top of each. On the page whose whole
 * job is "come back tomorrow", that is the wrong page to have no memory.
 *
 * A client island rather than a client page. The four cards stay server-rendered
 * because they carry the copy this page is indexed on, and none of what is below
 * can be rendered on a server at all: it lives in this browser's localStorage.
 * Nothing here crosses the wire.
 *
 * It renders nothing at all until it has read that store, because the alternative
 * is telling somebody they have played none of them and then correcting itself a
 * frame later.
 */
import { useEffect, useState } from "react";
import { DAILY_GAMES, DAILY_META, type DailyGame } from "@/lib/daily/core";
import { localStats, readAllDone } from "@/lib/daily/local";

type Row = { game: DailyGame; score: number | null; streak: number };

export function Tonight({ today }: { today: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const done = readAllDone();
    setRows(
      DAILY_GAMES.map((game) => ({
        game,
        score: done[game]?.[today] ?? null,
        streak: localStats(game).streak,
      }))
    );
  }, [today]);

  if (!rows) return null;

  const played = rows.filter((r) => r.score !== null);
  const longest = rows.reduce((best, r) => Math.max(best, r.streak), 0);

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border-dim bg-bg-2 px-4 py-3"
        // The count changes the moment this mounts, without a click, so it has to
        // announce itself.
        aria-live="polite"
      >
        <p className="text-text-mid">
          {played.length === 0 ? (
            <>All four still to play tonight.</>
          ) : played.length === rows.length ? (
            <>
              <span className="text-text-hi">All four done tonight.</span> The next lot land at
              midnight.
            </>
          ) : (
            <>
              <span className="num text-text-hi">{played.length}</span> of{" "}
              <span className="num text-text-hi">{rows.length}</span> played tonight.
            </>
          )}
        </p>
        {longest > 1 && (
          <p className="label-caps text-accent">
            Best run going: <span className="num">{longest}</span> days
          </p>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <li
            key={row.game}
            className={`rounded-md border px-3 py-2 ${
              row.score === null ? "border-border-dim bg-bg-2" : "border-accent/60 bg-accent-dim"
            }`}
          >
            {/*
              The tick is the shape and "done" is the word. Neither the border
              colour nor the tint may be the only thing saying which of these you
              have finished.
            */}
            <p className="label-caps flex items-center gap-1 text-[10px]">
              <span aria-hidden>{row.score === null ? "○" : "✓"}</span>
              {DAILY_META[row.game].name}
            </p>
            <p className="mt-0.5 text-sm text-text-mid">
              {row.score === null ? (
                "not played"
              ) : (
                <>
                  done, <span className="num text-text-hi">{row.score}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
