/**
 * The hub for the four idea lists.
 *
 * It exists to be the parent that links the four together and to answer the
 * broadest of the four questions ("how do I build a fantasy character"), which
 * none of the leaves should try to answer on their own. Kept to an index and a
 * short FAQ on purpose: the writing lives on the leaves.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { ARRAY_SIZE, TIMINGS } from "@/lib/game/rules";
import { CHARACTER_PAGES } from "./shared";

export const metadata: Metadata = {
  title: "How to Build a Fantasy Character",
  description:
    "A class, a place to be from, one piece of gear and one thing you did. Forty eight worked examples, free to read and free to take to a table of your own.",
  alternates: { canonical: "/characters" },
  openGraph: {
    title: "How to Build a Fantasy Character",
    description:
      "Four parts, forty eight worked examples: classes, origins, gear and backstories. Take any of them to your own table.",
    url: "/characters",
  },
};

/** Every combination before the six numbers are placed. It is a large number. */
const COMBINATIONS = (
  CALLINGS.length *
  BLOODS.length *
  KIT.length *
  HOOKS.length
).toLocaleString("en-GB");

const FAQ: { q: string; a: string }[] = [
  {
    q: "What makes a character backstory worth having?",
    a: "One specific thing you did, or that was done to you, and what it left behind. The test is whether four strangers form an opinion about the person from a single line. A mysterious past gives them nothing to decide with; cutting a second key for a client's strongroom and never asking who wanted it does. Everything on these pages is written to that rule, and the ones that failed it were thrown out.",
  },
  {
    q: "Can I use any of this at my own table?",
    a: "Yes. Take a Calling, a Blood, a piece of Kit or a Hook to whatever game you play, change the name and make it yours. Rules and ideas are nobody's property. The only thing we ask is that you write your own words rather than reprinting ours, which is the same deal we took from everybody else.",
  },
  {
    q: "How many different characters is that?",
    a: `${COMBINATIONS} before anybody rolls a number. A run also hands every player the same ${ARRAY_SIZE} scores and asks where they go, so two players with the identical Calling and Blood are still not the same character.`,
  },
  {
    q: "Do I have to read all this before I can play?",
    a: `No. The game deals you the lists and gives you ${Math.round(TIMINGS.assignMs / 1000)} seconds, and it is more fun to read them under a clock. These pages are for the people who make characters for games they never get round to playing, which is most of us.`,
  },
];

export default function CharactersPage() {
  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />

      <header className="flex flex-col gap-4">
        <p className="label-caps">Character creation</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          How to build a fantasy character, in four decisions
        </h1>
        <p className="prose-read text-text-mid">
          A character is a job, a place to be from, one thing you are carrying and one thing
          you did. That is the whole of it, and the four lists below are the ones this game
          actually deals. There are {CALLINGS.length} Callings, {BLOODS.length} Bloods,{" "}
          {KIT.length} pieces of Kit and {HOOKS.length} Hooks, every one written out in full,
          and you are welcome to take any of them to a table that has nothing to do with us.
        </p>
        <p className="prose-read text-text-mid">
          They are in this order because that is the order that works. The job decides what you
          reach for, so it goes first and it is the loudest. Where you are from decides what you
          have stopped noticing. The gear is one real object rather than a loadout. And the last
          one is the one people skip and then wish they had not, because a past is the only part
          of a character that other people at the table can pick up and use against you.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {CHARACTER_PAGES.map((p) => (
          <li key={p.path}>
            <Link
              href={p.path}
              className="flex h-full flex-col gap-2 rounded-lg border border-border-dim bg-bg-1 p-5 transition-colors hover:border-accent/50 hover:bg-bg-2"
            >
              <span className="font-display text-xl font-bold text-text-hi">{p.heading}</span>
              <span className="text-text-mid">{p.blurb}</span>
              <span className="mt-auto pt-2 text-sm text-accent">Read the list ›</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Why a character here is not a stat block
        </h2>
        <p className="prose-read text-text-mid">
          Nothing in these four lists adds a large number to a roll. A Calling gives you two
          abilities you are trained in and one situation that makes you irrelevant. A Blood does
          not touch the arithmetic at all: it changes what a failure costs, or who it costs, or
          what you knew before you committed. Kit is a flat two points or a couple of uses of
          something you fire when you choose. A Hook is a past you can spend, and it puts a
          matching problem into the night for everybody at the table.
        </p>
        <p className="prose-read text-text-mid">
          That is deliberate, and it is the difference between choosing a character and choosing
          a build. The numbers on the sheet are the same six for everybody in the room. What
          separates you is what you are prepared to be no use at, and{" "}
          <Link href="/how-it-works" className="text-accent underline">
            the rules page
          </Link>{" "}
          spells out exactly how each of those four things reaches the dice.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Questions people ask</h2>
        <dl className="flex flex-col gap-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="rounded-lg border border-border-dim bg-bg-1 p-4">
              <dt className="font-display text-lg font-bold text-text-hi">{q}</dt>
              <dd className="mt-2 text-text-mid">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="flex flex-wrap gap-3 border-t border-border-dim pt-8">
        <Link
          href="/daily/muster"
          className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
        >
          Build one now, on your own
        </Link>
        <Link
          href="/tables"
          className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
        >
          Find a table
        </Link>
      </footer>
    </div>
  );
}
