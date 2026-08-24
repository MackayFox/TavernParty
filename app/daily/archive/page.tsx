import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import {
  ARCHIVE_START,
  DAILY_GAMES,
  DAILY_META,
  archiveDates,
  prettyDate,
  utcDate,
} from "@/lib/daily/core";

export const metadata: Metadata = {
  title: "Past Days: Every Puzzle Since We Started",
  description:
    "Every daily puzzle Tavern Party has ever set, back to the first one. Play any of them as practice: the dice are pinned to the date, so a past day is exactly the puzzle everybody else got that morning.",
  alternates: { canonical: "/daily/archive" },
};

/**
 * The archive. A server component: it is a grid of links and a date arithmetic
 * helper, and there is nothing here worth shipping JavaScript for.
 *
 * Everything this needs already existed and was simply never given a page:
 * `archiveDates`, `resolvePlayDate`'s `archive` flag, the "Practice" banner on
 * the daily shell, and the streak exemption on the result route.
 */
export default function DailyArchive() {
  const today = utcDate();
  const dates = archiveDates();

  return (
    <section className="mx-auto w-full max-w-3xl py-8">
      <p className="label-caps">The back room shelf</p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        Past days
      </h1>
      <p className="prose-read mt-3 text-text-mid">
        Every puzzle we have set, back to {prettyDate(ARCHIVE_START)}. The dice are pinned to the
        date, so playing an old one gives you exactly the puzzle everybody else got that morning.
        Past days are practice: they do not count towards a streak, which is the point of a streak.
      </p>

      <h2 className="label-caps mt-8">Today</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {DAILY_GAMES.map((game) => {
          const meta = DAILY_META[game];
          return (
            <li key={game}>
              <Link href={meta.path} className="block rounded-lg focus-visible:outline-none">
                <Card className="min-h-14 transition-colors hover:border-accent/50">
                  <span aria-hidden className="mr-2 text-xl leading-none">
                    {meta.glyph}
                  </span>
                  <span className="font-display text-text-hi">{meta.name}</span>
                  <span className="mt-1 block text-sm text-text-mid">{prettyDate(today)}</span>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="label-caps mt-10">Everything before that</h2>
      <p className="mt-2 text-sm text-text-mid">
        {dates.length - 1} {dates.length === 2 ? "day" : "days"} on the shelf. Four puzzles each.
      </p>

      <ul className="mt-4 space-y-3">
        {dates.slice(1).map((date) => (
          <li key={date} className="rounded-lg border border-border-dim bg-bg-1 p-3">
            <h3 className="font-display text-text-hi">{prettyDate(date)}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {DAILY_GAMES.map((game) => {
                const meta = DAILY_META[game];
                return (
                  <li key={game}>
                    <Link
                      href={`${meta.path}?date=${date}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-3 text-sm text-text-mid hover:border-accent/50 hover:text-text-hi"
                    >
                      <span aria-hidden>{meta.glyph}</span>
                      {/* The full name, not the glyph alone: an emoji is not a label. */}
                      <span>{meta.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {dates.length <= 1 && (
        <p className="mt-4 rounded-lg border border-border-dim bg-bg-1 p-4 text-text-mid">
          Nothing on the shelf yet. Today is the first day. Come back tomorrow and this page will
          have something on it.
        </p>
      )}

      <p className="mt-8 text-sm text-text-mid">
        <Link href="/daily" className="text-accent underline">
          Back to tonight&apos;s four
        </Link>
      </p>
    </section>
  );
}
