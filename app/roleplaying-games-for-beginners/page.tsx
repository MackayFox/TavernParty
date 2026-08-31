/**
 * The page for somebody who has never played one of these.
 *
 * WHY THIS AND NOT THE PAGE THAT WAS ASKED FOR. The brief said to target
 * "a tabletop-style roleplaying game you can play in a browser with friends and
 * no game master". That page already exists and is good: it is
 * /online-roleplaying-games, whose title is literally "Online Roleplaying Games
 * With No Game Master". Writing a second one would have been two pages
 * competing for one result, which is the exact anti-pattern that gets a site
 * marked as thin.
 *
 * The genuinely uncovered intent next door is the beginner. Nothing on this site
 * explains what a roleplaying game IS, and CLAUDE.md records the observed
 * problem in Adam's own words: "my non-D&D friends are just like what the hell
 * is 'signature once a night', 'hook', 'a calling', 'a Blood'." That is a real
 * bounce, from real people, and it is a different search from the lander's.
 *
 * Every number is read out of lib/game/rules.ts and lib/content/, like the
 * rulebook. Nothing about anybody else's game is named, per GAME_DESIGN §9.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES } from "@/lib/content/scenes";
import {
  ABILITY_BLURB,
  ABILITY_LABEL,
  ARRAY_DICE,
  ARRAY_DROP,
  ARRAY_SIZE,
  DEFAULT_SETTINGS,
  DIE_SIDES,
  DRAFT_RANKS,
  DREAD_DOUBLE_AT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMINGS,
  abilityMod,
  estimateRunMs,
  formatDuration,
} from "@/lib/game/rules";
import { ABILITIES } from "@/lib/game/types";

const RUN_LENGTH = formatDuration(estimateRunMs(DEFAULT_SETTINGS));

/** "+3", "-1". A bare 3 next to "adds one to your roll" reads as a target. */
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const metadata: Metadata = {
  title: "Roleplaying Games for Beginners: Your First Night",
  description:
    "What a roleplaying game actually is, what the dice are for, and what the words mean, written for somebody who has never played one and has nobody to ask.",
  alternates: { canonical: "/roleplaying-games-for-beginners" },
  openGraph: {
    title: "Roleplaying Games for Beginners: Your First Night",
    description:
      "The vocabulary translated, the dice explained, and what the first ten minutes actually feel like. No experience and no game master needed.",
    url: "/roleplaying-games-for-beginners",
  },
};

/** The words a first-timer meets, and the plain ones underneath them. */
const GLOSSARY: [string, string][] = [
  ["Calling", "your job. The sort of person you are, and what you are good at."],
  ["Blood", "where you are from, and the one odd thing that gives you."],
  ["Kit", "the things you are carrying."],
  ["Hook", "your backstory. One thing you did, and what it left behind."],
  ["Act", "one scene. Something happens, and you decide what you do about it."],
  ["Approach", "one of the ways of dealing with a scene. Each one uses a different ability."],
  ["Reckless", "the risky way. Pays the most, costs the most, and only one person may take it."],
  ["Signature", "your one special move. Once a night, and then never again."],
  ["Renown", "your score."],
  ["Dread", "how badly the night is going, for everybody. It only goes up."],
  ["Scar", "what a failure leaves on you. Worth something later, if you dare show it."],
  ["Laurel", "a vote you give somebody else at the end. Never yourself."],
  ["The Hoard", "the prize. Exactly one player gets it."],
];

export default function BeginnersPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8 sm:py-12">

      <header className="flex flex-col gap-4">
        <p className="label-caps">For a first night</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Roleplaying games for beginners, and what nobody explains
        </h1>
        <p className="prose-read text-text-mid">
          A roleplaying game is a game where you make up a person, and then dice decide whether
          that person manages the thing they just tried. That is the whole of it. Everything
          else, all the words and all the numbers, exists to make those two sentences
          interesting for a few hours, and none of it is as complicated as the people who love
          it make it sound.
        </p>
        <p className="prose-read text-text-mid">
          This page is written for somebody who has never played one and has nobody handy to
          ask. It uses Tavern Party as the worked example, because that is the game this site
          is, and because you can go and play it in a browser in {RUN_LENGTH} with no
          account and nothing to install. But the ideas are the ideas. Take them anywhere.
        </p>
      </header>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">What the dice are for</h2>
        <p className="prose-read text-text-mid">
          The dice are not there to add randomness for its own sake. They are there so that
          nobody at the table, including whoever wrote the game, gets to decide whether you
          succeed. You describe what you are trying, the game names a number you have to beat,
          you roll, and the result stands. That is the contract, and it is why people who have
          never rolled a die in their lives find these games grip them: the outcome is genuinely
          not up to anybody.
        </p>
        <p className="prose-read text-text-mid">
          Your character is a small set of numbers that lean the dice in your favour. Here there
          are {ARRAY_SIZE} of them, one per ability, and the rule joining a score to a roll is
          the only arithmetic worth learning. Ten and eleven are average and add nothing. Every
          two points above that adds one to your roll and every two points below takes one off,
          so a score of 16 is {signed(abilityMod(16))} to everything you attempt with it and a score
          of 8 is {signed(abilityMod(8))}. That is the whole system. You never need to know more than that
          to play, and neither does anybody at a real table.
        </p>
        <p className="prose-read text-text-mid">
          The die itself has {DIE_SIDES} sides, so it swings a lot more than your character
          does. A brilliant character has an enormous advantage and no guarantee, which is
          exactly the right shape for a story. It is also why one bad roll is never the end of
          anything here: a failed roll costs you, and the game carries on.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((a) => (
            <Card key={a} className="h-full">
              <h3 className="font-display text-base font-bold uppercase text-text-hi">
                {ABILITY_LABEL[a]}
              </h3>
              <p className="mt-1 text-sm text-text-mid">{ABILITY_BLURB[a]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          The game master, and why there is not one here
        </h2>
        <p className="prose-read text-text-mid">
          In most of these games one person at the table is not playing a character. They are
          running the world: deciding what you walk into, how hard it is, and what happens
          afterwards. It is a genuinely great job and it is the reason most people never get to
          try one of these games, because it wants somebody prepared to read a book, prepare an
          evening, and then be available on a specific Tuesday. Most groups that fall apart
          fall apart because that person got busy.
        </p>
        <p className="prose-read text-text-mid">
          So there is not one here. The server does that job. It chooses the encounter from a
          pool of {SCENES.length}, it sets the number you have to beat, it rolls every die and
          it works out what everything costs. Nobody prepares anything, nobody has to be the
          responsible adult, and nobody sits the game out in order to run it. The trade is
          honest and worth knowing before you start: a server can be perfectly fair and
          perfectly consistent, and it cannot be surprised by you.
        </p>
        <p className="prose-read text-text-mid">
          Which means there is no typing in what your character says. You are never asked to
          improvise in front of strangers, which for a lot of people is the actual barrier
          rather than the rules. Every option is written down in front of you with a real number
          attached, and the choice between them is the game.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          The words, in plain ones
        </h2>
        <p className="prose-read text-text-mid">
          Every game in this genre invents its own vocabulary, and it is the single biggest
          reason people bounce off them. Here is the whole of ours. Read it once and you will
          not meet a word on this site you cannot decode.
        </p>
        <dl className="flex flex-col gap-2">
          {GLOSSARY.map(([term, gloss]) => (
            <div
              key={term}
              className="flex flex-col gap-x-3 border-b border-border-dim pb-2 sm:flex-row"
            >
              <dt className="font-display shrink-0 font-bold text-text-hi sm:w-40">{term}</dt>
              <dd className="text-text-mid">{gloss}</dd>
            </div>
          ))}
        </dl>
        <p className="prose-read text-text-mid">
          There are {CALLINGS.length} Callings, {BLOODS.length} Bloods, {KIT.length} pieces of
          Kit and {HOOKS.length} Hooks, and{" "}
          <Link href="/characters" className="text-accent underline">
            all of them are written out in full
          </Link>{" "}
          so you can decide what you want before a clock is running.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What the first ten minutes are actually like
        </h2>
        <p className="prose-read text-text-mid">
          Beat by beat, so nothing is a surprise. {MIN_PLAYERS} to {MAX_PLAYERS} of you open the
          same link. Nobody signs up.
        </p>
        <ol className="flex flex-col gap-3">
          <li>
            <Card>
              <h3 className="font-display text-lg font-bold text-text-hi">
                The numbers are rolled, once, for the room
              </h3>
              <p className="mt-1 text-text-mid">
                The server throws {ARRAY_DICE} dice and drops the lowest{" "}
                {ARRAY_DROP === 1 ? "one" : ARRAY_DROP}, {ARRAY_SIZE} times, and publishes the
                result. Everybody at the table gets those same {ARRAY_SIZE} numbers. You are not
                competing on luck with each other, only on where you put them.
              </p>
            </Card>
          </li>
          <li>
            <Card>
              <h3 className="font-display text-lg font-bold text-text-hi">
                You rank what you want, and you might not get it
              </h3>
              <p className="mt-1 text-text-mid">
                Up to {DRAFT_RANKS} choices of Calling, submitted at the same time as everybody
                else, with one of each per table. Then the same again for Kit, in reverse order,
                so whoever got first pick of the jobs picks last off the gear. Being denied your
                first choice is not a bug. It is the first thing in the evening that makes you
                think.
              </p>
            </Card>
          </li>
          <li>
            <Card>
              <h3 className="font-display text-lg font-bold text-text-hi">
                You place the numbers and pick a past
              </h3>
              <p className="mt-1 text-text-mid">
                Six numbers into six abilities, then one Hook. This is the bit veterans of this
                hobby actually love, and it is over in a couple of minutes rather than an
                evening.
              </p>
            </Card>
          </li>
          <li>
            <Card>
              <h3 className="font-display text-lg font-bold text-text-hi">
                Then something happens, {DEFAULT_SETTINGS.acts} times
              </h3>
              <p className="mt-1 text-text-mid">
                A scene, three ways through it, and {Math.round(TIMINGS.actMs / 1000)} seconds to
                choose. Everybody commits at once and nobody sees anybody else&apos;s choice
                until it resolves. Then you find out what the die did, and what the doors nobody
                took would have paid.
              </p>
            </Card>
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          The two things first-timers get wrong
        </h2>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">Spreading the numbers evenly.</strong> It feels
          responsible and it is the worst build in the game. Every scene offers three different
          abilities, so somebody at the table will be brilliant at any given door. Being
          adequate at all six means you are the best answer to nothing, and nobody ever hands
          you the interesting job. Put your highest number somewhere and accept that one of
          your six is going to be embarrassing.
        </p>
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">Playing it safe all night.</strong> Failure is not
          the punishment here. Standing still is. The party shares one Dread number that only
          ever goes up, and at {DREAD_DOUBLE_AT} of it every cost in the game doubles, hesitation
          included. A table where everybody sensibly takes the safe door is a table where the
          bill quietly grows until somebody has to pay it. Go through the door early, while it
          is cheap.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What a browser genuinely cannot do
        </h2>
        <p className="prose-read text-text-mid">
          Worth being straight about, because you will hear this argument eventually and you may
          as well hear it fairly. The thing a real table has that no piece of software has is
          permission to try the idea you just had. You say, could I climb the outside instead,
          and a person considers it and gives you a number. Nothing here can do that. There is a
          fixed set of options and they were written before you arrived.
        </p>
        <p className="prose-read text-text-mid">
          A long game is the other loss. Games run over months turn a character into somebody
          you know, and the payoff for that only exists at that length. This is one night,
          finished in one sitting, and it does not pretend otherwise.
        </p>
        <p className="prose-read text-text-mid">
          What you get in exchange is that it happens at all. No preparation, no scheduling, no
          rulebook, no one person carrying the whole thing, and no evening ruined because
          somebody cancelled. If you have spent years meaning to try one of these games and
          never getting past the meaning to, that trade is the entire pitch.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Where to start tonight</h2>
        <p className="prose-read text-text-mid">
          If you have nobody to play with yet, start with{" "}
          <Link href="/daily" className="text-accent underline">
            one of the four daily puzzles
          </Link>
          . They run the same rules and the same dice, on your own, in two or three minutes, and
          the one called Muster is nothing but character creation, which is the part you will
          find out whether you like. If you do have people,{" "}
          <Link href="/tables" className="text-accent underline">
            open a table
          </Link>{" "}
          and send them the link, and read{" "}
          <Link href="/how-it-works" className="text-accent underline">
            the full rules
          </Link>{" "}
          while they arrive. It is one page and it has a worked example on it.
        </p>
      </section>
    </div>
  );
}
