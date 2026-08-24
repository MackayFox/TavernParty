import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { OTHER_SITES } from "@/lib/content/network";
import { SCENES } from "@/lib/content/scenes";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  estimateRunMs,
  formatDuration,
} from "@/lib/game/rules";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Tavern Party is, why it is shaped the way it is, and what it deliberately does not do. A small browser roleplaying game, free to play, made by one person.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">About</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          A whole roleplaying night in {formatDuration(estimateRunMs(DEFAULT_SETTINGS))}
        </h1>
        <p className="prose-read text-text-mid">
          Tavern Party is a small fantasy roleplaying game you play in a browser tab with{" "}
          {MIN_PLAYERS} to {MAX_PLAYERS} friends. You build a character, the party takes on{" "}
          {DEFAULT_SETTINGS.acts} encounters together, and exactly one of you walks out with
          the Hoard. It is free, there is nothing to download, and you do not need an account.
        </p>
      </header>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Why it is like this</h2>
        <p className="prose-read text-text-mid">
          The best part of this hobby is making a character, and the worst part is finding four
          adults who are all free on the same Tuesday. So the whole thing is built around the
          first problem and around the second one being impossible. Character creation gets
          over two of the minutes and it is competitive, because being denied the Calling you
          wanted is more interesting than filling in a form. And nothing in a run ever waits
          for a specific person to answer: every phase is on a clock, resolves whether or not
          you acted, and the default when you do not act is a real move with real consequences
          rather than a skip.
        </p>
        <p className="prose-read text-text-mid">
          The other decision worth naming is that the game never prints a total. It prints the
          named things that made the total. You needed fourteen, the die gave eleven, and then
          a line each for the ability, the piece of gear and the thing you have done before.
          Every number traces back to a word, and that list is the entire narration budget: it
          reads like prose without anybody writing prose for every possible outcome.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">What is actually in it</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="num text-3xl text-accent">{CALLINGS.length}</p>
            <p className="label-caps mt-1">Callings</p>
            <p className="mt-1 text-sm text-text-mid">
              One of each per table. The loudest choice you make.
            </p>
          </Card>
          <Card>
            <p className="num text-3xl text-accent">{HOOKS.length}</p>
            <p className="label-caps mt-1">Hooks</p>
            <p className="mt-1 text-sm text-text-mid">
              A past that edits everybody else&apos;s night, not a note on your sheet.
            </p>
          </Card>
          <Card>
            <p className="num text-3xl text-accent">{SCENES.length}</p>
            <p className="label-caps mt-1">Encounters</p>
            <p className="mt-1 text-sm text-text-mid">
              Three ways through each, on three different abilities.
            </p>
          </Card>
        </div>
        <p className="prose-read text-text-mid">
          There are also four daily puzzles. Three run the same dice as the live game, pinned to
          the date, so everybody in the world gets the same night and the score you post is
          comparable. The fourth has no dice in it at all. One of them is nothing but character creation, because for a lot
          of people that always was the game.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What it deliberately does not do
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-text-mid">
          <li>
            <strong className="text-text-hi">No free text.</strong> The one thing an app
            genuinely loses next to a real table is permission to try the idea you just had
            and have somebody adjudicate it. We cannot adjudicate free text, so we do not
            pretend to. Every choice is a real option with a real number, and the unknown lives
            in the one target number the game keeps hidden.
          </li>
          <li>
            <strong className="text-text-hi">Nothing borrowed.</strong> Every Calling, Blood,
            Hook, encounter and line of copy here was written for this game. Game rules are not
            anybody&apos;s property, and the words are ours, which is cheaper than a licence and
            better than being a reskin of something else.
          </li>
          <li>
            <strong className="text-text-hi">No advertising during play.</strong> Ads pay for
            the hosting, and they are never rendered during a live encounter or a daily puzzle
            in progress.
          </li>
          <li>
            <strong className="text-text-hi">No account required, ever.</strong> Guests are
            first class. Play as a guest and your streaks live in your own browser. An account
            only exists so you can keep a record across devices.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Who made it</h2>
        <p className="prose-read text-text-mid">
          One person, in the evenings, in the United Kingdom. It is the third small browser game
          in a short row of them, and the others are below. If something is broken, or a rule
          reads wrong, or you have an encounter you think belongs in the deck, the{" "}
          <Link href="/contact" className="text-accent underline">
            contact form
          </Link>{" "}
          reaches me directly.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {OTHER_SITES.map((site) => (
            <li key={site.id}>
              <a
                href={site.url}
                className="flex min-h-11 items-start gap-3 rounded-lg border border-border-dim bg-bg-1 p-4 hover:bg-bg-2"
              >
                <span aria-hidden className="text-xl">
                  {site.emoji}
                </span>
                <span>
                  <span className="font-display block font-bold text-text-hi">{site.name}</span>
                  <span className="block text-sm text-text-mid">{site.tagline}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap gap-3 border-t border-border-dim pt-8">
        <Link
          href="/how-it-works"
          className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
        >
          Read the rules
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
