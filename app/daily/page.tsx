import type { Metadata } from "next";
import Link from "next/link";
import { Tonight } from "@/components/daily/Tonight";
import { Card } from "@/components/ui";
import { DAILY_GAMES, DAILY_META, prettyDate, utcDate } from "@/lib/daily/core";

export const metadata: Metadata = {
  title: "Four Daily Fantasy Puzzles, Free Every Day",
  description:
    "Four fantasy puzzles, new at midnight, the same for everybody alive. Five doors, a blind dungeon, a debt grid, and a character built on tonight's numbers.",
  alternates: { canonical: "/daily" },
  openGraph: {
    title: "Four Daily Fantasy Puzzles, Free Every Day",
    description:
      "New at midnight, the same four for everybody in the world, and three of them publish a par worked out by brute force.",
    url: "/daily",
  },
};

/**
 * The hub. Still a server component: the four cards are the copy this page is
 * indexed on, so they render on the server as they always did.
 *
 * The one client island is `Tonight`, which says which of the four you have
 * already played and what you scored. That cannot be server-rendered at all,
 * because it is in this browser's localStorage and nowhere else.
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
        Four puzzles, new at midnight, the same four for everybody in the world. Three of them are
        two or three minutes; the Deep Run is the long one and wants about five. Three of them publish a par worked out by brute force, so you find out not
        just what you scored but what there was to score.
      </p>

      <Tonight today={today} />

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

      {/* ------------------------------------------------------------------
          The hub is what a stranger lands on, and four cards with a blurb each
          told them nothing about how the four differ or how any of it works.
          Everything below is checkable against lib/daily/: the reset is
          `utcDate`, the streak rule is `recordCounted` in local.ts, and the
          score ceilings are DAILY_META.
          ------------------------------------------------------------------ */}
      <section className="mt-10 flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Which of the four to open first
        </h2>
        <p className="prose-read text-text-mid">
          They look like variations on each other and they are not. The thing that separates
          them is how much you are allowed to know before you commit, and that single dial
          changes what kind of thinking each one asks for.
        </p>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">The Long Way Down</strong> shows you everything. Five
          scenes, three doors each, and all five dice thrown and printed before you touch
          anything. There is no luck left in it at all: it is an assignment problem, and the
          only question is which die you are willing to waste on which door. It is the one that
          rewards knowing the rules, because the two that decide it are stated and easy to
          skip. Dread doubles every cost once it reaches three, so an early cheap failure and a
          late cheap failure are not the same price. And a natural 1 always fails while a
          natural 20 always clears, whatever the arithmetic says, so the die you are looking at
          may be worth more or less than the number on it.
        </p>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">The Deep Run</strong> is the long one, and the only
          one where you do not know the number before you choose. You build a character first,
          then take them down six floors, and each room owns its die: you see it when you are
          standing in the room and not a moment earlier. Every floor has one way through that
          always works and always costs, so a bad build is a slow bleed rather than a wall.
          Budget five minutes rather than two, and expect to not come back the first few times.
        </p>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">The Ledger</strong> has no dice in it anywhere. Five
          drinkers, five debts, and four statements that are all true. It is scored out of
          four, and every check you spend against the ledger takes one of those four off, so a
          clean four means you worked it out and asked for nothing. It is the one to send
          somebody who says they
          do not like this sort of game, because it is a logic grid with a pub in it.
        </p>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">Muster</strong> is character creation as the whole
          game. Tonight&apos;s six numbers, rolled once for the world, one Calling and one piece
          of Kit, then five doors that were chosen for you. Out of five, and the day is drawn
          so that par is never five, because a set of doors any sensible build clears is not a
          puzzle. Everything you needed to know was on the sheet before you pressed anything,
          which is either the most satisfying two minutes of the four or the most annoying.
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          The reset, and what a streak actually counts
        </h2>
        <p className="prose-read text-text-mid">
          The day rolls over at midnight UTC, not at midnight where you are. In British summer
          time that is one in the morning, so a puzzle opened late on a Tuesday evening is
          still Tuesday&apos;s. Everything is a pure function of that date: the same date
          produces the same dice, the same drinkers and the same six numbers for everybody
          alive, and nothing is stored anywhere to make that true. It falls out of the seed.
        </p>
        <p className="prose-read text-text-mid">
          A streak counts one thing only, and it is narrower than most sites make it: a puzzle
          played on its own date. The archive is deliberately open, all the way back, and
          everything in it is practice. Play three weeks of back days this afternoon and your
          streak stays exactly where it was, because a streak that can be farmed in ten minutes
          is not measuring anything. It is per puzzle, too, so a Ledger streak and a Deep Run
          streak are separate animals and missing one does not cost you the other.
        </p>
        <p className="prose-read text-text-mid">
          Three of the four publish a par, and par here is the best score that was achievable,
          found by brute force rather than estimated: the solver walks every legal line through
          tonight&apos;s puzzle and reports the top of it. That is why the golf convention is
          upside down and the results screen says &quot;two short of par&quot; rather than two
          over. You cannot beat par. You can only find out how much of it was there.
        </p>
        <p className="prose-read text-text-mid">
          The same solver is what checks{" "}
          <Link href="/write" className="text-accent underline">
            a dungeon you write yourself
          </Link>
          , and the rules underneath all four are{" "}
          <Link href="/how-it-works" className="text-accent underline">
            the ones the multiplayer game runs on
          </Link>
          . Nothing here is a spin-off with its own maths.
        </p>
      </section>
    </section>
  );
}
