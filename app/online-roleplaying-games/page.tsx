/**
 * The one search landing page.
 *
 * Rules for this file, because a page like this is where sites start lying.
 * Every claim is checkable against the code, every number comes from
 * lib/game/rules.ts, and the FAQ answers in the JSON-LD are the same sentences
 * that are visible on the page. If a question cannot be answered honestly it is
 * not on the page.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Card } from "@/components/ui";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES } from "@/lib/content/scenes";
import {
  ARRAY_SIZE,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMINGS,
  estimateRunMs,
  formatDuration,
} from "@/lib/game/rules";

const RUN_LENGTH = formatDuration(estimateRunMs(DEFAULT_SETTINGS));

/**
 * "Online roleplaying games" on its own is a head term a five-page site is not
 * going to take off Roll20 and D&D Beyond, and pretending otherwise wastes the
 * only landing page there is. The qualifier is the whole point: no game master,
 * no evening to book. That is a question people genuinely type, the page already
 * answered it in the FAQ, and it is a query this domain can actually hold.
 */
export const metadata: Metadata = {
  title: "Online Roleplaying Games With No Game Master",
  description: `A free online roleplaying game for ${MIN_PLAYERS} to ${MAX_PLAYERS} players, ${RUN_LENGTH} a run, with nobody having to run it. The server sets the encounters and rolls every die.`,
  alternates: { canonical: "/online-roleplaying-games" },
  openGraph: {
    title: "Online Roleplaying Games With No Game Master",
    description: `Nobody prepares anything and nobody sits out. Free, ${RUN_LENGTH}, ${MIN_PLAYERS} to ${MAX_PLAYERS} players, nothing to install.`,
    url: "/online-roleplaying-games",
  },
};

/**
 * Visible copy and structured data come from one place, so the two can never
 * disagree. Google wants the answer on the page; this makes that automatic.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "What is an online roleplaying game, in this sense?",
    a: `A game where you build a character with abilities and a history, and then those numbers decide what happens when the character tries something. Tavern Party does that in a browser tab, on a clock, for ${MIN_PLAYERS} to ${MAX_PLAYERS} players at once. It is not a virtual tabletop for running a longer game, and it is not a chat room. It is one self-contained night that takes ${RUN_LENGTH}.`,
  },
  {
    q: "Is it free?",
    a: "Yes, completely. There is nothing to buy, no subscription and no in-game currency. Adverts pay for the hosting, and they are never shown during a live encounter or a daily puzzle in progress.",
  },
  {
    q: "Do I need to download anything, or make an account?",
    a: "No to both. It runs in a browser on a phone or a laptop, and you can play as a guest. An account exists only so that your run history and daily scores follow you between devices.",
  },
  {
    q: "Does somebody have to be the game master?",
    a: "No. The server runs the encounters, rolls the dice and decides every outcome, so nobody has to prepare anything and nobody sits out. That is the main reason it is shaped this way: a game that needs one specific person to be present and responsive at a specific moment is a game that does not happen.",
  },
  {
    q: "How long does a game take?",
    a: `About ${Math.round(estimateRunMs(DEFAULT_SETTINGS) / 60000)} minutes. Every phase is simultaneous and on a timer, so a table of six takes the same time as a table of two, and the run never waits for one player to move.`,
  },
  {
    q: "What happens if somebody closes the tab halfway through?",
    a: `Nothing stalls. Each phase resolves on its deadline whether or not everybody acted, and the default when you do not act is a real move called Flinch: it scores badly for you and it raises the party's Dread. An absent player becomes a problem the rest of the table can see and argue about, rather than a game that hangs.`,
  },
  {
    q: "Can I type what my character says or does?",
    a: "No, and that is deliberate rather than a missing feature. Nothing here can adjudicate a sentence you invent, so instead every choice is a real option with a real number attached. The unknown lives in one hidden target number per encounter, on the line that pays the most.",
  },
  {
    q: "Is there anything to play on my own?",
    a: "Yes. There are four daily puzzles, all built on the same engine with the dice pinned to the date, so everybody in the world gets the same problem and the score you post is comparable. One of them is nothing but character creation.",
  },
  {
    q: "Is this based on an existing tabletop game?",
    a: "No. Every Calling, Blood, Hook, encounter and line of text was written for this game. Rules and mechanics are not anybody's property, so the dice work in a way you will recognise, but none of the words or the setting are borrowed from anywhere.",
  },
];

export default function OnlineRoleplayingGamesPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <JsonLd data={faqLd} />

      <header className="flex flex-col gap-4">
        <p className="label-caps">Online roleplaying games</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          An online roleplaying game that needs no game master
        </h1>
        <p className="prose-read text-text-mid">
          Most online roleplaying games ask for the two things people do not have: an evening
          everybody is free for, and somebody willing to prepare it. Tavern Party is the
          version that asks for neither, and it fits in a coffee break. {MIN_PLAYERS} to{" "}
          {MAX_PLAYERS} of you open a link,
          build a character each, take on {DEFAULT_SETTINGS.acts} encounters together, and one
          of you walks out with the Hoard. It takes {RUN_LENGTH}, it is free, and there is
          nothing to install.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tables"
            className="font-display inline-flex min-h-14 items-center rounded-md bg-accent px-7 text-lg font-semibold text-ink hover:bg-accent-hover"
          >
            Find a table
          </Link>
          <Link
            href="/how-it-works"
            className="font-display inline-flex min-h-14 items-center rounded-md border border-border-strong bg-bg-2 px-7 text-lg font-medium text-text-hi hover:bg-bg-3"
          >
            Read the rules
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What you actually do in it
        </h2>
        <p className="prose-read text-text-mid">
          The first two and a half minutes are character creation, and they are competitive.
          There are {CALLINGS.length} Callings and only one of each per table, so you rank your
          choices and find out whether you got the one you wanted. The same again for the{" "}
          {KIT.length} pieces of Kit, except the order is reversed, so first crack at the
          Callings buys last crack at the gear. Then the server rolls {ARRAY_SIZE} numbers once
          for the whole room and everybody assigns those same {ARRAY_SIZE} numbers to their own
          abilities, which quietly ends the oldest argument in this hobby: real dice, identical
          starting material, and the only decision left is where you put the best one and who
          is prepared to live with the worst. Everything you are choosing between is published:{" "}
          <Link href="/characters" className="text-accent underline">
            the Callings, the Bloods, the Kit and the Hooks
          </Link>{" "}
          are all written out, so you can turn up having already decided what you want.
        </p>
        <p className="prose-read text-text-mid">
          After that come the encounters, drawn from a pool of {SCENES.length}. Each one offers
          three ways through, each on a different ability, so the player who put their high
          number in Charm and the player who put it in Brawn are both looking at a door with
          their name on it and it is not the same door. One of the three pays far more than the
          others, keeps its target number hidden, and can only be taken by one player. That is
          the door the table argues about, every single time.
        </p>
        <p className="prose-read text-text-mid">
          Then the part that surprises people. The game never prints a total. It prints the
          named things that made the total, in the order you would read them out: the die, then
          the ability, then the piece of gear, then the fact that you have done this before.
          Every number on screen traces back to a word, so a roll reads as a sentence and you
          always know which of your own choices did the work.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What makes it a game rather than a form
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Your history is everybody&apos;s problem
            </h3>
            <p className="mt-1 text-text-mid">
              You pick one of {HOOKS.length} Hooks: a specific thing you did, and what it left
              behind. It guarantees a matching encounter into the deck for the whole table, so
              your past is an edit to the night the other players have to survive, and they can
              all see whose fault it was.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Your fuel is in other people&apos;s hands
            </h3>
            <p className="mt-1 text-text-mid">
              The tokens that make you good at something only refill when your own worst trait
              is used against you. Being singled out stops being a punishment and becomes the
              thing you were waiting for.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Failing leaves something you can spend
            </h3>
            <p className="mt-1 text-text-mid">
              Every failure leaves a Scar, and after each encounter you decide: wear it in
              public, which pays at the end and frightens the party, or hide it, which costs
              you and nobody else. It is the cleanest decision in the game and there is no die
              involved.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Only one of you gets paid
            </h3>
            <p className="mt-1 text-text-mid">
              The party survives together and exactly one player takes the Hoard, decided at
              the end by what you earned, what you were prepared to show, and one secret vote
              each. Nobody is ever fully out of it, which is the point of the vote.
            </p>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Honestly, what it is not
        </h2>
        <p className="prose-read text-text-mid">
          It is not a virtual tabletop. There are no maps to draw on, no character portraits to
          upload, no campaign to continue next week and no way to type a plan and have somebody
          rule on it. If what you want is a long game with a person running it, this is not a
          substitute and it is not trying to be one. What it is, is the thirty seconds where
          somebody says &quot;fine, I will go first&quot;, and the ten minutes either side of
          that, with nobody having to prepare anything.
        </p>
        <p className="prose-read text-text-mid">
          It also does not need friends. Four daily puzzles run on the same engine with the
          dice pinned to the date, so everybody gets the same problem on the same day and a
          score is worth comparing. One of them is character creation on a fixed budget against
          a named encounter, because for a lot of people that always was the best part.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What you need to start
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-text-mid">
          <li>A browser. A phone is fine, and every control is sized for a thumb.</li>
          <li>
            Between {MIN_PLAYERS} and {MAX_PLAYERS} people, or nobody at all if you sit a
            couple of strangers down at the table instead.
          </li>
          <li>
            {Math.round(estimateRunMs(DEFAULT_SETTINGS) / 60000)} minutes, and{" "}
            {Math.round(TIMINGS.actMs / 1000)} seconds of attention at a time.
          </li>
          <li>No account, no download, no card, no email address.</li>
        </ul>
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
          href="/tables"
          className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
        >
          Find a table
        </Link>
        <Link
          href="/daily"
          className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
        >
          Play today&apos;s puzzles
        </Link>
        <Link
          href="/about"
          className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
        >
          About the game
        </Link>
      </footer>
    </div>
  );
}
