"use client";

/**
 * YOUR DAILIES, ON THE PAGE CALLED "YOUR RECORD".
 *
 * /history was 1,330 characters of prose ABOUT what is kept and showed none of
 * it. Somebody who had played all four dailies, whose scores and streaks were
 * sitting in `tp_daily_done` and `tp_daily_counted` in that very browser, was
 * told at length that their record was being kept and shown nothing. A page
 * called "Your record" that contains no record reads as broken, and it is the
 * only place a daily player would think to look.
 *
 * Client-side and read on mount, because localStorage does not exist on the
 * server and reading it during render is a hydration mismatch. It renders
 * nothing at all until it has read, and nothing at all if there is nothing to
 * show: an empty table of noughts is worse than the essay was.
 *
 * Guests and account holders both get this. The server keeps a registered
 * player's dailies too, but the browser's copy is the one that is complete --
 * it has every day since before they signed up -- so this is the honest source
 * for "what have I played".
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { DAILY_GAMES, DAILY_META, type DailyGame } from "@/lib/daily/core";
import { localStats, readCounted, readDone } from "@/lib/daily/local";
import { Sheet } from "@/components/ui";

/** The last `n` dates, newest last, as YYYY-MM-DD in UTC. */
function recentDates(n: number): string[] {
  const out: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < n; i++) {
    out.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

type Row = {
  game: DailyGame;
  streak: number;
  played: number;
  best: number;
  /** One entry per recent day: the score, or null for a day not played. */
  strip: (number | null)[];
};

const DAYS = 14;

export function DailyRecord() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const dates = recentDates(DAYS);
    setRows(
      DAILY_GAMES.map((game) => {
        const counted = readCounted(game);
        return {
          game,
          ...localStats(game),
          // From `counted`, not `done`: the strip is "days you kept the habit",
          // and archive practice is explicitly not that.
          strip: dates.map((d) => counted[d] ?? null),
        };
      })
    );
  }, []);

  if (!rows) return null;
  const anything = rows.some((r) => r.played > 0);
  if (!anything) return null;

  return (
    <Sheet className="mt-6 max-w-none" title="Your four" subtitle="The dailies, kept in this browser">
      <ul className="space-y-4">
        {rows.map((row) => {
          const meta = DAILY_META[row.game];
          const done = readDone(row.game);
          const today = recentDates(1)[0];
          return (
            <li key={row.game} className="border-b border-paper-rule pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link href={meta.path} className="font-display text-lg text-paper-ink underline">
                  {meta.name}
                </Link>
                <p className="sheet-label">
                  {row.played === 0
                    ? "not played yet"
                    : `${row.played} ${row.played === 1 ? "day" : "days"} played`}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper-ink">
                <span>
                  <span className="sheet-label">Streak</span>{" "}
                  <span className="num">{row.streak}</span>
                </span>
                <span>
                  <span className="sheet-label">Best</span>{" "}
                  <span className="num">{row.best}</span>
                </span>
                <span>
                  <span className="sheet-label">Today</span>{" "}
                  <span className="num">
                    {done[today] !== undefined ? done[today] : "not yet"}
                  </span>
                </span>
              </div>
              {/*
                The last fortnight. A filled box is a day you played on the day;
                an empty one is a day you did not. Not colour alone: the filled
                and empty glyphs are different shapes, and the whole strip has a
                text alternative, because a row of squares is meaningless to a
                screen reader.
              */}
              <p
                className="num mt-2 tracking-[0.15em] text-paper-ink"
                aria-label={`Last ${DAYS} days: ${row.strip.filter((s) => s !== null).length} played`}
              >
                <span aria-hidden>
                  {row.strip.map((score) => (score === null ? "▫" : "▪")).join("")}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
