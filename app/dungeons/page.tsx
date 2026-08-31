/**
 * The Hall, plus the writing that makes it worth indexing.
 *
 * The shelf itself is a client component that fetches a list, so on a young Hall
 * this page was two sentences and an empty state: thin, in the exact sense
 * Google means by it, and in the sitemap. The essay below is the answer, and
 * every claim in it is checkable against `lib/campaign/gate.ts`. Nothing here is
 * transcribed prose about dungeons in general.
 *
 * It sits BELOW the shelf on purpose. `Hall` owns the h1 and the list is what
 * somebody arriving from a link came for; the reader who wants to know what
 * "Stiff" means is the one who scrolls.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { MAX_FLOORS, MAX_MARKS_READ, MIN_FLOORS } from "@/lib/campaign/gate";
import { Hall } from "./Hall";

export const metadata: Metadata = {
  title: "The Hall: Dungeons People Wrote",
  description:
    "Player-made dungeon crawls, every one checked by the same solver that sets the daily's par, and ranked by what the people who finished them thought.",
  alternates: { canonical: "/dungeons" },
  openGraph: {
    title: "The Hall: dungeons people wrote",
    description:
      "Player-made dungeon crawls, measured rather than claimed. Ranked by what the people who finished them thought.",
    url: "/dungeons",
  },
};

export default function DungeonsPage() {
  return (
    <>
      <Hall />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-12">
        <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            What makes a dungeon finishable
          </h2>
          <p className="prose-read text-text-mid">
            Almost no level editor can tell you your level is impossible. It can count your
            rooms and check your spelling, and then it has to hand the question to strangers and
            hope some of them come back and complain. This one can answer it exactly, and the
            reason is a quirk of the engine rather than anything clever: every room throws its
            die before the player chooses a door. There is no probability anywhere in the
            problem. The best line through a dungeon for a given character is a plain walk, not
            an expectation, so the solver can enumerate every character the author allows, play
            each one perfectly, and count who is standing at the bottom.
          </p>
          <p className="prose-read text-text-mid">
            Which turns &quot;is this any good&quot; into arithmetic. A dungeon between{" "}
            {MIN_FLOORS} and {MAX_FLOORS} floors is solved in a fraction of a second, and the
            author is told, before anybody else sees it: what par is, how many of the characters
            they allow get out alive, and which floor the rest of them stop on. That last
            sentence is the one that fixes dungeons. An author almost always knows something is
            wrong and almost never knows where.
          </p>
          <p className="prose-read text-text-mid">
            The floor rule underneath all of it is that a floor must be a price and never a
            wall. Every floor needs two ways to try it on two different abilities, and one way
            through that always works and always costs you. That last one cannot be locked
            behind anything you might not be carrying, because the whole point of it is that
            somebody who arrives with nothing and rolls badly still gets down. A dungeon where
            the guaranteed door needs the lamp is a dungeon with a dead end in it, and it does
            not publish.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            What the solver actually checks
          </h2>
          <p className="prose-read text-text-mid">
            There are two kinds of finding and the difference matters. A block stops the
            dungeon going out. A warning is printed loudly and publishes anyway, because
            sometimes a meat grinder is the point and a validator that refuses taste is a
            validator people route around.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="h-full">
              <h3 className="font-display text-lg font-bold text-text-hi">
                <span aria-hidden className="mr-2 font-mono text-danger">
                  ✕
                </span>
                Blocked: it is not a dungeon
              </h3>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm text-text-mid">
                <li>
                  Nobody gets out. The best character allowed, playing perfectly, runs out of
                  Vigour partway down.
                </li>
                <li>
                  Fewer than three kinds of person survive it. That is a lock, not a dungeon.
                </li>
                <li>
                  A door that wants a mark nothing above it hands out. It can never open, and
                  neither floor looks wrong on its own.
                </li>
                <li>
                  A check with no target number, which is not merely hard: it goes
                  catastrophically wrong every single time, at the top price.
                </li>
                <li>
                  A shelf where nothing does anything. Some gear is a charge you spend at a
                  table with other people at it, and a charge is inert down a hole.
                </li>
              </ul>
            </Card>
            <Card className="h-full">
              <h3 className="font-display text-lg font-bold text-text-hi">
                <span aria-hidden className="mr-2 font-mono text-warning">
                  ▲
                </span>
                Warned: it is a dungeon, but
              </h3>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm text-text-mid">
                <li>
                  &quot;Floor 3: everybody takes Cut the rope. The others are furniture.&quot;
                  One door dominating is a floor that only looks like a choice.
                </li>
                <li>
                  Two or more doors nobody would ever take. That floor is one choice wearing a
                  hat.
                </li>
                <li>
                  Everybody who does well is the same Calling. That is not a choice, it is a
                  requirement, and a player deserves to know before they build.
                </li>
                <li>
                  A mark handed out that no door ever reads. Legal, free, and nearly always a
                  word spelled two ways.
                </li>
                <li>
                  Over nine tenths get out, or under a tenth. Both are allowed and the card
                  says which.
                </li>
              </ul>
            </Card>
          </div>
          <p className="prose-read text-text-mid">
            One cap is worth explaining because it looks arbitrary and is not. A dungeon may
            test at most {MAX_MARKS_READ} distinct marks, the things a floor leaves on you and a
            lower floor can ask about. Marks nothing tests are free and unlimited, because
            flavour cannot branch a search. Every mark a door actually reads can double the size
            of the solver&apos;s table, so {MAX_MARKS_READ} is fast and eight is a request that
            times out.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            Why the difficulty word can be trusted
          </h2>
          <p className="prose-read text-text-mid">
            A walk, Fair, Stiff, Brutal, Barely possible. The word on a card is derived and
            never authored: it is the share of allowed characters that get out alive, banded.
            Nobody can label their walkover brutal to make it sound better, and nobody can call
            a meat grinder gentle to get more people to press it. It is the one thing on a
            browse card that is measured rather than claimed, and it is worth more than any
            star rating, because a star rating tells you how the people who liked it felt.
          </p>
          <p className="prose-read text-text-mid">
            The ranking above works the same way. There is no most played tab, deliberately:
            popularity ranks whatever got seen first and keeps it there, and a board nothing new
            can climb is a board nobody submits to twice. What is ranked instead is the share of
            people who <em>finished</em> a dungeon and then said it was worth their time, and
            nothing is ranked at all until enough people have finished it, so one friendly vote
            tops nothing.
          </p>
          <p className="prose-read text-text-mid">
            Everything in the Hall was shelved by hand by the person who wrote it. Unlisted is
            the default, so a draft or a private link never appears here. If you want to see
            what the report reads like on something of your own,{" "}
            <Link href="/write" className="text-accent underline">
              the desk is open
            </Link>
            , and{" "}
            <Link href="/daily/deeprun" className="text-accent underline">
              tonight&apos;s official dungeon
            </Link>{" "}
            is the same engine with the dice pinned to the date.
          </p>
        </section>
      </div>
    </>
  );
}
