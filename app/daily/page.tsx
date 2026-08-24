import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { DAILY_GAMES, DAILY_META, prettyDate, utcDate } from "@/lib/daily/core";

export const metadata: Metadata = {
  title: "Four Daily Fantasy Puzzles, Free Every Day",
  description:
    "Four fantasy puzzles, new at midnight and identical for everybody in the world. Five doors, a blind dungeon, a debt grid, and a character built on tonight's numbers.",
  alternates: { canonical: "/daily" },
  openGraph: {
    title: "Four Daily Fantasy Puzzles, Free Every Day",
    description:
      "New at midnight, the same four for everybody in the world, and three of them publish a par worked out by brute force.",
    url: "/daily",
  },
};

/**
 * The hub. A server component on purpose: it is four links and a date, and
 * there is nothing here worth shipping JavaScript for.
 */
export default function DailyHub() {
  const today = utcDate();
  return (
    <section className="mx-auto w-full max-w-2xl py-8">
      <p className="label-caps">{prettyDate(today)}</p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        Tonight&apos;s four
      </h1>
      <p className="prose-read mt-3 text-text-mid">
        Four puzzles, new at midnight, the same four for everybody in the world. Each one is two or
        three minutes. Three of them publish a par worked out by brute force, so you find out not
        just what you scored but what there was to score.
      </p>

      <ul className="mt-6 space-y-3">
        {DAILY_GAMES.map((game) => {
          const meta = DAILY_META[game];
          return (
            <li key={game}>
              <Link href={meta.path} className="block rounded-lg focus-visible:outline-none">
                <Card className="transition-colors hover:border-accent/50">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-2xl leading-none">
                      {meta.glyph}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-bold uppercase text-text-hi">
                        {meta.name}
                      </h2>
                      <p className="mt-1 text-text-mid">{meta.blurb}</p>
                      <p className="mt-2 text-sm text-accent">{meta.rule}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-sm text-text-low">
        Nothing here needs an account. Sign in and your streaks follow you between browsers,
        otherwise they stay in this one.
      </p>
    </section>
  );
}
