import type { Metadata } from "next";
import Link from "next/link";
import { TavernHero } from "./TavernHero";
import { JsonLd } from "@/components/JsonLd";
import { Network } from "@/components/Network";
import { AdSlot, Card, Pill, Sheet, SheetBox } from "@/components/ui";
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES } from "@/lib/content/scenes";
import { isTag, TAG_MEANING } from "@/lib/content/tags";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";
import {
  abilityMod,
  ABILITY_LABEL,
  DEFAULT_SETTINGS,
  DREAD_DOUBLE_AT,
  estimateRunMs,
  formatDuration,
  HOOK_TOKENS_MAX,
  HOOK_TOKEN_VALUE,
  LAUREL_VALUE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMINGS,
} from "@/lib/game/rules";
import { ABILITIES, type Scores } from "@/lib/game/types";

export const metadata: Metadata = {
  // Absolute, because the root template appends "· Tavern Party" to every child
  // title and the home page already opens with the brand. Left as a plain string
  // it resolved to seventy three characters with the name in it twice.
  title: { absolute: "Tavern Party: A Free Online Roleplaying Game in Your Browser" },
  description:
    "Roll a character, survive five encounters with friends, and only one of you walks out with the loot. Free in your browser, plus four daily puzzles.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tavern Party: Roll a Character, Survive the Night",
    description:
      "Build a character, survive five encounters, and only one of you gets the loot. Free in your browser, no account.",
    url: "/",
  },
};

const RUN_LENGTH = formatDuration(estimateRunMs(DEFAULT_SETTINGS));

/** Content is keyed by id, so the page shows the real game rather than a mock-up. */
function byId<T extends { id: string }>(list: T[], id: string): T {
  return list.find((x) => x.id === id) ?? list[0];
}

/** A Failing names a scene tag. Say what the tag means rather than printing it. */
function tagMeaning(tag: string): string {
  return isTag(tag) ? TAG_MEANING[tag] : tag;
}

// ---------------------------------------------------------------------------
// The hero's character sheet. One real build, laid out with the real primitives.
// ---------------------------------------------------------------------------

const DEMO_SCORES: Scores = {
  brawn: 12,
  deft: 16,
  grit: 10,
  wits: 13,
  nerve: 14,
  charm: 8,
};
const DEMO_CALLING = byId(CALLINGS, "knife");
const DEMO_BLOOD = byId(BLOODS, "fenborn");
const DEMO_KIT = byId(KIT, "pick-roll");
const DEMO_HOOK = byId(HOOKS, "two-keys");

/** Three of the eight, chosen because they read as three different nights out. */
const SHOWN_CALLINGS = ["warden", "knife", "reckoner"].map((id) => byId(CALLINGS, id));

/** Three of the twenty. Each one is a specific thing done, with what it left. */
const SHOWN_HOOKS = ["two-keys", "the-lamp-left-lit", "left-the-column"].map((id) =>
  byId(HOOKS, id)
);

const STEPS: [string, string, string][] = [
  [
    "01",
    "Draft against each other",
    `The house rolls six numbers once and everybody gets the same six. Then you rank your Callings, all ${CALLINGS.length} of them exclusive, so two of you cannot both be the Knife. Whoever won that draft picks their gear last, which makes it a fork rather than a head start.`,
  ],
  [
    "02",
    "Build the character",
    `Place the six numbers and pick a Hook out of ${HOOKS.length} pasts. Your Blood is dealt to you, so the argument is over the numbers. You get ${Math.round(TIMINGS.assignMs / 1000)} seconds and it is the biggest decision in the run, because your Hook also puts a scene into everybody else's night.`,
  ],
  [
    "03",
    "Take on five encounters",
    `Three ways at every problem, from a pool of ${SCENES.length} scenes. One line pays most, keeps its target number hidden, and only one of you is allowed to take it. You may also put somebody else forward for the encounter, and it costs you if they do not come back.`,
  ],
  [
    "04",
    "Find out who gets paid",
    `Renown, kept scars and one secret vote each worth ${LAUREL_VALUE}. The party got through the night together. One of you leaves with the Hoard, and the rest of you find out how quickly you were volunteered.`,
  ],
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pb-8 sm:gap-24">
      {/* ---------------------------------------------------------------- hero */}
      <section className="grid items-center gap-8 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <div className="flex flex-col gap-5">
          <p className="label-caps">A fantasy roleplaying game in a browser tab</p>
          <h1
            className="font-display font-black leading-[1.05]"
            style={{ fontSize: "var(--tp-text-hero)" }}
          >
            Roll a character.
            <br />
            <span className="text-accent">Survive the night.</span>
          </h1>
          <p className="prose-read">
            Build somebody in two minutes, take on five encounters with your friends, and find out
            which of you they were prepared to sacrifice. Exactly one of you walks out with the
            loot.
          </p>
          <p className="text-sm text-text-mid">
            {MIN_PLAYERS} to {MAX_PLAYERS} players, {RUN_LENGTH}. Free, in your browser, no
            download and no account.
          </p>
          <TavernHero />
        </div>

        <div className="flex flex-col gap-3">
          <Sheet title="RUE" subtitle={`${DEMO_CALLING.name} · ${DEMO_BLOOD.name}`}>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => {
                const mod = abilityMod(DEMO_SCORES[a]);
                return (
                  <SheetBox
                    key={a}
                    label={ABILITY_LABEL[a]}
                    value={DEMO_SCORES[a]}
                    hint={mod >= 0 ? `+${mod}` : `${mod}`}
                  />
                );
              })}
            </div>
            <dl className="mt-4 flex flex-col gap-3 border-t border-paper-rule pt-3">
              {[
                ["Signature, once a night", DEMO_CALLING.signature.label],
                ["Kit", DEMO_KIT.name],
                ["Hook", DEMO_HOOK.name],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="sheet-label">{label}</dt>
                  <dd className="font-display font-bold text-paper-ink">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="sheet-label">Failing</dt>
                <dd className="text-sm text-paper-ink-mid">{DEMO_CALLING.failing.text}</dd>
              </div>
            </dl>
          </Sheet>
          <p className="text-center text-sm text-text-mid">
            Everybody at the table is handed the same six numbers. This is what one player did
            with them.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- dailies */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps">Every day at midnight, the same for everyone</p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Four daily puzzles</h2>
          </div>
          <Link
            href="/daily"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            See today&apos;s four
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DAILY_GAMES.map((g) => {
            const meta = DAILY_META[g];
            return (
              <li key={g}>
                <Link
                  href={meta.path}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border-dim bg-bg-1 p-4 transition-colors hover:border-accent/50 hover:bg-bg-2"
                >
                  <span aria-hidden className="text-2xl leading-none">
                    {meta.glyph}
                  </span>
                  <span className="font-display text-lg font-bold text-text-hi">{meta.name}</span>
                  <span className="text-sm text-text-mid">{meta.blurb}</span>
                  <span className="mt-auto pt-2 text-xs text-accent">Play today&apos;s ›</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-text-mid">
          All four are pinned to the date, so everybody in the world gets the same puzzle, and
          three of them publish a par worked out by brute force. Two under is a better thing to
          post than a number out of sixty.
        </p>
        {/*
          The single biggest missed sentence on the site, until now. The page bragged
          about the brute-forced par and never mentioned that the same machine is
          handed to anybody who wants to write a dungeon of their own.
        */}
        <p className="mt-2 text-sm text-text-mid">
          That brute force is not kept for the dailies.{" "}
          <Link href="/write" className="text-accent underline">
            Write a dungeon of your own
          </Link>{" "}
          and it runs over yours the moment you save, and tells you what par is before anybody
          else opens it.
        </p>
      </section>

      {/* ------------------------------------------------------ write your own */}
      {/*
        THE HEADLINE SLOT, and until now this page did not mention the feature at
        all: a grep for "dungeon" over this file returned nothing, across 811 words,
        seven internal links and four buttons. Adam called the Desk and the Hall the
        USPs and he is right, and they were reachable only from a footer row and the
        bottom of a dropdown labelled with a promise about something else.
      */}
      <section>
        <p className="label-caps">The third thing you can do here</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          Write a dungeon, and find out what you wrote
        </h2>
        <div className="prose-read mt-3 flex flex-col gap-3 text-text-mid">
          <p>
            Three to eight floors, and something at the bottom of them. Every floor gets two
            doors that ask for different abilities and one that always works and always costs,
            so somebody who arrives with nothing is out of pocket rather than stuck. You decide
            which Callings are allowed, what is on the shelf, and how much wind they start with.
            Six rooms off the shared shelf is a real dungeon and takes about two minutes; writing
            every floor yourself takes an evening.
          </p>
          <p>
            Then the interesting part. A solver plays{" "}
            <strong className="text-text-hi">every character your settings allow</strong>, all of
            them perfectly, and tells you the truth: what par is, how many of them get out alive,
            which floor stops the rest, and which door nobody would ever take. It refuses to
            publish a dungeon nobody can finish. So the difficulty word on the card was measured
            rather than claimed, and nobody can call a walkover brutal.
          </p>
          <p>
            One rule makes a dungeon feel like a place rather than a list. A door can leave a word
            on you, and a door further down can want it or refuse it: take the lantern on the
            first floor and the crack on the third is a squeeze instead of a gamble, or wade the
            water and the rope on the bridge will not have a wet man on it.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/write"
            className="font-display inline-flex min-h-14 items-center justify-center rounded-md bg-accent px-7 text-lg font-semibold text-ink hover:bg-accent-hover"
          >
            Write a dungeon
          </Link>
          <Link
            href="/d/LNGWLK"
            className="font-display inline-flex min-h-14 items-center justify-center rounded-md border border-border-strong bg-bg-2 px-7 text-lg font-medium text-text-hi hover:border-accent/50"
          >
            Play ours first
          </Link>
        </div>
        <p className="mt-2 text-sm text-text-low">
          Or read{" "}
          <Link href="/dungeons" className="underline">
            the ones people have written
          </Link>
          , ranked by how many of the players who actually finished them thought they were worth
          the evening.
        </p>
      </section>

      {/* --------------------------------------------------- what a character is */}
      <section>
        <p className="label-caps">Character creation is the product, not the preamble</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          What you actually build
        </h2>
        <p className="prose-read mt-3">
          A Calling, a Blood, a piece of Kit and a Hook. The Calling is the loud one: there are{" "}
          {CALLINGS.length}, one of each per table, and being denied the one you wanted is the
          point at which the draft becomes a game. All four lists are written out in full on{" "}
          <Link href="/characters" className="text-accent underline">
            the character pages
          </Link>
          , and you are welcome to take any of them to a table of your own.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {SHOWN_CALLINGS.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-2">
                <h3 className="font-display text-xl font-bold text-accent">{c.name}</h3>
                <p className="text-sm text-text-hi">{c.blurb}</p>
                <p className="flex flex-wrap gap-1">
                  {c.affinities.map((a) => (
                    <Pill key={a} tone="neutral">
                      {ABILITY_LABEL[a]} +2
                    </Pill>
                  ))}
                </p>
                <p className="mt-auto pt-2 text-sm text-text-mid">
                  <span className="label-caps mr-2">Once a night</span>
                  {c.signature.label}
                </p>
                <p className="text-sm text-text-low">
                  <span className="label-caps mr-2">No use against</span>
                  {tagMeaning(c.failing.tag)}
                </p>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h3 className="font-display text-xl font-bold text-text-hi">
              And a past that other people can use
            </h3>
            <p className="mt-2 text-text-mid">
              A Hook is not a note in the margin. It guarantees a scene of its own kind turns up in
              the party&apos;s five, so your history is an edit to everybody else&apos;s night and
              they can see whose fault it was.
            </p>
            <p className="mt-2 text-text-mid">
              It also carries {HOOK_TOKENS_MAX} tokens worth {HOOK_TOKEN_VALUE} each, and they only
              refill when your past is used against you. Your fuel is in other people&apos;s hands.
              At the top of every encounter the table sees whose Hook is live, which pays you for
              going through the door and docks you for standing still, so leaning into your worst
              trait is the play rather than the punishment.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {SHOWN_HOOKS.map((h) => (
              <li
                key={h.id}
                className="rounded-md border border-border-dim bg-bg-1 p-3 sm:flex sm:gap-3"
              >
                <span className="font-display block shrink-0 font-bold text-text-hi sm:w-40">
                  {h.name}
                </span>
                <span className="block text-sm text-text-mid">{h.blurb}</span>
              </li>
            ))}
            <li className="text-sm text-text-low">
              <Link href="/characters/backstories" className="text-accent underline">
                {HOOKS.length - SHOWN_HOOKS.length} more, written out in full
              </Link>
              , and no two of them put the same problem into the deck.
            </li>
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- how a run goes */}
      <section>
        <p className="label-caps">The shape of a night</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
          How a run goes, in {RUN_LENGTH}
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, title, body]) => (
            <li key={n}>
              <Card className="h-full">
                <p className="num text-2xl text-accent">{n}</p>
                <h3 className="font-display mt-2 text-lg font-bold text-text-hi">{title}</h3>
                <p className="mt-2 text-sm text-text-mid">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-text-mid">
          Every phase is simultaneous and runs on a clock, so nobody sits waiting for anybody and a
          table of six takes exactly as long as a table of two. Every failure leaves a scar, and you
          choose each time whether to wear it, which pays at the end and frightens the party, or
          hide it, which costs you now and nobody else anything. Let the party&apos;s Dread reach{" "}
          {DREAD_DOUBLE_AT} and every cost doubles. Somebody has to go through the door.
        </p>
      </section>

      <AdSlot zone="home-mid" className="mx-auto w-full max-w-3xl" />

      {/* ----------------------------------------------------------- playing it */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Nobody free tonight?",
            "Fill the empty chairs. They take the door the numbers point at and they never freeze on a deadline, which is more than can be said for some people. They also draft at random and they never vote, so beating them is not the same as beating a table.",
          ],
          [
            "Playing with friends",
            "Open a table, send the six-character code or the link, and you are rolling in under a minute. No lobbies and nothing to install.",
          ],
          [
            "On a phone, one handed",
            "Everything is built for a thumb, and the reading is set at a size you can read on a train. It runs on a locked-down work laptop too.",
          ],
        ].map(([title, body]) => (
          <Card key={title} className="h-full">
            <h3 className="font-display text-lg font-bold text-text-hi">{title}</h3>
            <p className="mt-2 text-sm text-text-mid">{body}</p>
          </Card>
        ))}
      </section>

      {/* ----------------------------------------------------------- SEO block */}
      <section className="rounded-lg border border-border-dim bg-bg-1 p-5 sm:p-8">
        <h2 className="font-display text-xl font-bold sm:text-2xl">
          A free online roleplaying game you can start in a minute
        </h2>
        <div className="mt-3 flex max-w-[62ch] flex-col gap-3 text-text-mid">
          <p>
            Tavern Party is a fantasy character creator with a game attached. You get a name box,
            six numbers and a draft, and about two minutes later you have somebody with a trade, a
            grudge and a bad habit. Then the five encounters start and you find out what they are
            made of. Nothing to install, nothing to buy, and no dice to lose under the sofa.
          </p>
          <p>
            Every part of that is a list you can read before you ever open a table: eight{" "}
            <Link href="/characters/classes" className="text-accent underline">
              character class ideas
            </Link>
            , eight{" "}
            <Link href="/characters/origins" className="text-accent underline">
              places to be from
            </Link>
            , twelve pieces of{" "}
            <Link href="/characters/gear" className="text-accent underline">
              adventuring gear
            </Link>{" "}
            and twenty{" "}
            <Link href="/characters/backstories" className="text-accent underline">
              character backstory ideas
            </Link>
            , all written out. Take any of them to a game that has nothing to do with this one.
          </p>
          <p>
            It is built as a one-shot: a whole story with an ending, in the time a lunch break
            allows, rather than a campaign that needs everybody free on the same evening for a
            month. If you have ever wanted to try a tabletop game with friends online but could
            not get four diaries to agree, this is the version that fits in the gap. Send a link,
            everybody gets a character, and it is over before anybody has to leave. There is more
            on the shape of{" "}
            <Link href="/online-roleplaying-games" className="text-accent underline">
              playing this sort of thing in a browser
            </Link>{" "}
            if you want it.
          </p>
          <p>
            There is no rulebook to read. The server rolls the dice, prints every modifier by name
            so you can see exactly why a roll landed, and closes each phase on a timer, which means
            a player who wanders off is a problem the rest of you can see and work around rather
            than a stalled evening. Play against{" "}
            <Link href="/tables" className="text-accent underline">
              whoever is at an open table
            </Link>{" "}
            right now, or work through today&apos;s{" "}
            <Link href="/daily" className="text-accent underline">
              four puzzles
            </Link>{" "}
            on your own, including one that is nothing but building a character to beat a named
            encounter.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- the network */}
      <Network />

      {/* ---------------------------------------------------------- final CTA */}
      <section className="rounded-lg border border-accent/30 bg-accent/5 p-6 text-center sm:p-10">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          There is a chair, and a candle, and one of you is getting paid
        </h2>
        <p className="mx-auto mt-3 max-w-md text-text-mid">
          Two of you is enough. One of you is enough, if you do not mind who else is at the table.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/tables"
            className="font-display inline-flex min-h-14 items-center rounded-md bg-accent px-7 text-lg font-bold text-ink hover:bg-accent-hover"
          >
            Find a table
          </Link>
          <Link
            href="/daily"
            className="font-display inline-flex min-h-14 items-center rounded-md border border-border-strong bg-bg-2 px-7 text-lg font-bold text-text-hi hover:bg-bg-3"
          >
            Today&apos;s puzzles
          </Link>
        </div>
      </section>

      {/* Structured data for the game itself. Through JsonLd rather than a raw
          script tag, so `<` is escaped and a future dynamic value cannot close
          the tag. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: "Tavern Party",
          url: "https://tavernparty.co.uk",
          description:
            "A free fantasy roleplaying game in the browser. Roll a character, take on five encounters with friends, and find out which of you walks out with the loot.",
          genre: ["Role-playing game", "Party game", "Puzzle"],
          gamePlatform: "Web browser",
          playMode: ["MultiPlayer", "SinglePlayer"],
          numberOfPlayers: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: MAX_PLAYERS,
          },
          applicationCategory: "Game",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
          inLanguage: "en-GB",
        }}
      />
    </div>
  );
}
