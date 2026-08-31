/**
 * The rules, in the order a new player needs them.
 *
 * Every number and every name on this page is read out of `lib/content/` and
 * `lib/game/rules.ts`, and the worked ledger is produced by the real
 * `ledgerFor` from `lib/game/resolve.ts`. Nothing here is transcribed, so the
 * page cannot drift away from the game: change a balance number and this page
 * changes with it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, SITE_ORG_ID } from "@/components/JsonLd";
import { Card, Pill, Sheet, SheetBox } from "@/components/ui";
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import { KIT } from "@/lib/content/kit";
import { SCENES, SCENES_BY_ID } from "@/lib/content/scenes";
import { TAG_MEANING, type Tag } from "@/lib/content/tags";
import { costMultiplier, ledgerFor, sumLedger } from "@/lib/game/resolve";
import {
  ABILITY_BLURB,
  ABILITY_LABEL,
  AFFINITY_BONUS,
  ARRAY_DICE,
  ARRAY_DROP,
  ARRAY_SIZE,
  DEFAULT_SETTINGS,
  DIE_SIDES,
  DRAFT_RANKS,
  DREAD_DOUBLE_AT,
  DREAD_TURN_AT,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HIDE_SCAR_RENOWN,
  HOOK_TOKENS_MAX,
  HOOK_TOKEN_VALUE,
  KEEP_SCAR_DREAD,
  KEPT_SCAR_VALUE,
  LAUREL_VALUE,
  MARK_BONUS,
  MARK_FLINCH_PENALTY,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NOMINATION_PENALTY,
  NOMINATION_SHARE,
  REVEAL_COST_TORCHES,
  TIMINGS,
  abilityMod,
  estimateRunMs,
  formatDuration,
  spellDuration,
} from "@/lib/game/rules";
import { ABILITIES, type Player, type Scores } from "@/lib/game/types";
import { siteUrl } from "@/lib/site";

/**
 * The page called itself four different things: "How It Works" in the title,
 * "How Tavern Party Works" in the card, "How it works" in the eyebrow, and an H1
 * about going through a door that used none of the words anybody searches for.
 * It is the rules page. It says so everywhere now.
 */
export const metadata: Metadata = {
  title: "How to Play: The Full Rules",
  description:
    "The whole rulebook on one page. Callings, Bloods, the shared array, Hooks, how an encounter resolves, keeping or hiding a Scar, and who gets paid.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How to Play Tavern Party: The Full Rules",
    description:
      "Callings, Bloods, the shared array, Hooks, Acts, Scars, Dread and the Ballad. Every number on the page is one the game uses.",
    url: "/how-it-works",
  },
};

const secs = (ms: number) => Math.round(ms / 1000);

/* ---------------------------------------------------------------------------
   The worked ledger.

   Built by calling the engine's own ledgerFor, with a die face chosen so the
   roll lands on the target number. If the content or the balance changes, the
   numbers below change too, and the prose never states a figure it has not
   been handed.
   --------------------------------------------------------------------------- */

const SCENE = SCENES_BY_ID["a01"] ?? SCENES[0];
const APPROACH =
  SCENE.approaches.find((a) => !a.reckless && a.ability === "deft") ?? SCENE.approaches[0];
const RECKLESS = SCENE.approaches.find((a) => a.reckless);
const CALLING = CALLINGS.find((c) => c.affinities.includes(APPROACH.ability)) ?? CALLINGS[0];
const ITEM = KIT.find((k) => k.bonus?.ability === APPROACH.ability) ?? KIT[0];

const SCORE = 15;

/** The number that matters is the one on the ability being rolled. */
const EXAMPLE_SCORES = ABILITIES.reduce((acc, ability) => {
  acc[ability] = ability === APPROACH.ability ? SCORE : 10;
  return acc;
}, {} as Scores);

const EXAMPLE_PLAYER: Player = {
  id: "example",
  name: "YOU",
  isHost: true,
  isBot: false,
  connected: true,
  disconnectedAt: null,
  lastSeenAt: 0,
  callingId: CALLING.id,
  bloodId: BLOODS[0].id,
  kitIds: [ITEM.id],
  hookId: HOOKS[0].id,
  scores: EXAMPLE_SCORES,
  renown: 0,
  hookTokens: HOOK_TOKENS_MAX,
  scars: [],
  torches: 0,
  rerolls: 0,
  usedSignature: false,
  usedBloodPower: false,
  laurelFor: null,
  stats: {
    actsTaken: 0,
    recklessTaken: 0,
    flinches: 0,
    scarsKept: 0,
    scarsHidden: 0,
    crits: 0,
  },
};

const CTX = {
  player: EXAMPLE_PLAYER,
  calling: CALLING,
  kit: [ITEM],
  scene: SCENE,
  approach: APPROACH,
  spendTokens: 1,
  dread: 0,
  hookCalled: false,
};

/** Everything except the die, so the face can be chosen to land on the target. */
const BONUSES = sumLedger(ledgerFor(CTX, 0));
const FACE = Math.max(2, Math.min(DIE_SIDES - 1, APPROACH.tn - BONUSES));
const LEDGER = ledgerFor(CTX, FACE);
const TOTAL = sumLedger(LEDGER);
const MADE_IT = TOTAL >= APPROACH.tn;

/** What the same failure would have cost with the night already going badly. */
const BAD_NIGHT = costMultiplier({
  calling: CALLING,
  scene: SCENE,
  dread: DREAD_DOUBLE_AT,
  approach: APPROACH,
});

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Both places that quote a torch price wrote "1 torch" as a literal singular
 * against a constant, so raising REVEAL_COST_TORCHES would have printed
 * "2 torch" on the rules page twice.
 */
const torches = (n: number) => `${n} ${n === 1 ? "torch" : "torches"}`;

/* ---------------------------------------------------------------------------
   The questions people actually ask about the rules.

   Rules questions only, and deliberately not the ones the search lander already
   answers: two pages carrying the same FAQ is two pages competing for the same
   result. Every answer here is the rule as the engine implements it, and every
   one of them is rendered visibly on the page below as well as in the JSON-LD,
   because marking up an answer a reader cannot see is the sort of structured
   data that earns a manual action rather than a rich result.
   --------------------------------------------------------------------------- */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Can two players have the same Calling?",
    a: `No. There is one of each of the ${CALLINGS.length} per table, which is what makes the draft a draft. You submit up to ${DRAFT_RANKS} ranked choices at the same time as everybody else and the server grants each player their highest surviving pick in the published order, so being denied your first choice is a normal outcome rather than a fault.`,
  },
  {
    q: "What happens if two players go for the Reckless line in the same Act?",
    a: "Only one player per Act can take it. The quicker hand gets it, the other player is moved to the line they are best at, and the whole party takes a point of Dread for the scramble. Nobody is left without a move, and the cost of the argument lands on everybody.",
  },
  {
    q: "Can I see the hidden target number before I commit?",
    a: `Yes, and it costs you. The Reckless line is the only one whose target number is hidden, and ${torches(REVEAL_COST_TORCHES)} buys a look at it. That is the whole information economy in the game: you can always find out, and finding out is never free.`,
  },
  {
    q: "Do kept Scars always pay at the end?",
    a: `No, and the gate is the point. A kept Scar is worth ${KEPT_SCAR_VALUE} Renown at the Ballad only if your Renown is at or above the table median. Without that, the winning line would be to take no risks, collect cheap Scars and wear all of them. Wearing your wounds has to mean you were in the fight.`,
  },
  {
    q: "What happens if somebody stops answering halfway through?",
    a: `Nothing hangs. Every phase ends on its deadline whether or not everybody acted, and the default when you do not act is not a skip and not a bot playing your character: it is a real move called Flinch, worth ${signed(FLINCH_RENOWN)} Renown to you and ${signed(FLINCH_DREAD)} Dread to the whole party. An absent player becomes something the table can see and argue about.`,
  },
  {
    q: "Does failing a roll get harder as the night goes badly?",
    a: `The roll never gets harder. The costs get bigger. At ${DREAD_DOUBLE_AT} Dread every cost doubles, and at ${DREAD_TURN_AT} the last Act is drawn from a worse deck. Being told the situation is worse is the same arithmetic as being told you are worse at something, and it is a great deal easier to live with.`,
  },
  {
    q: "Do I need to know a tabletop roleplaying game to follow this?",
    a: "No. The dice work in a way anybody who has played one will recognise, but every term is explained where you meet it and the server does all the arithmetic and all the adjudicating. There is nobody to be the game master, because nothing here needs one.",
  },
];

/* ------------------------------------------------------------------ page bits */

function Section({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border-dim pt-8">
      <p className="label-caps mb-1">{step}</p>
      <h2 className="font-display mb-4 text-2xl font-bold text-text-hi sm:text-3xl">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

const CONTENTS: [string, string][] = [
  ["the-table", "The table"],
  ["calling", "Your Calling"],
  ["blood", "Your Blood"],
  ["array", "The house array"],
  ["kit", "The Kit"],
  ["hook", "Your Hook"],
  ["act", "An Act"],
  ["ledger", "The ledger"],
  ["scar", "Scars"],
  ["dread", "Dread"],
  ["ballad", "The Ballad"],
  ["questions", "Questions"],
];

/**
 * The sections, listed twice: a row of chips under the intro, and a
 * sticky rail in the margin from `xl` up, which is what the shell's spare width
 * is for on the longest page in the product.
 *
 * Whichever one the breakpoint does not want is `display: none` rather than
 * merely invisible, so exactly one "On this page" is in the accessibility tree
 * at a time and there is never a second copy of the whole list to tab past.
 */
function Contents({ rail = false }: { rail?: boolean }) {
  const items = CONTENTS.map(([id, label]) => (
    <li key={id}>
      <a
        href={`#${id}`}
        className={`font-mono inline-flex min-h-11 items-center rounded-md px-3 text-xs uppercase tracking-[0.1em] text-text-mid hover:bg-bg-2 hover:text-text-hi ${
          rail ? "w-full" : "border border-border-strong bg-bg-1"
        }`}
      >
        {label}
      </a>
    </li>
  ));
  if (!rail) {
    return (
      <nav aria-label="On this page" className="xl:hidden">
        <ul className="flex flex-wrap gap-2">{items}</ul>
      </nav>
    );
  }
  return (
    <nav aria-label="On this page" className="hidden shrink-0 xl:block xl:w-56">
      <div className="sticky top-8 rounded-lg border border-border-dim bg-bg-1 p-2">
        <p className="label-caps px-3 pb-1 pt-2">On this page</p>
        <ul className="flex flex-col">{items}</ul>
      </div>
    </nav>
  );
}

export default function HowItWorksPage() {
  // In a sentence, so the spelled form. The table below keeps the short one.
  const runLength = spellDuration(estimateRunMs(DEFAULT_SETTINGS));
  const acts = DEFAULT_SETTINGS.acts;

  /**
   * The longest page on the site, so it is the one that carries the Article
   * node. No `datePublished` and no `dateModified`: the file has them in git and
   * nothing on the page states one, and stamping a date on a page to look fresh
   * is the one structured-data lie that is trivially caught.
   *
   * The publisher is referenced by id and `SiteJsonLd` below supplies that node,
   * so the reference resolves inside this document rather than pointing at
   * nothing.
   */
  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": siteUrl("/how-it-works#article"),
        mainEntityOfPage: siteUrl("/how-it-works"),
        headline: "How to play Tavern Party: the whole rulebook on one page",
        description:
          "The full rules: Callings, Bloods, the shared array, Kit, Hooks, an Act, the itemised ledger, Scars, Dread and the Ballad.",
        inLanguage: "en-GB",
        author: { "@type": "Person", name: "Adam Mackay" },
        publisher: { "@id": SITE_ORG_ID },
      },
      {
        "@type": "FAQPage",
        "@id": siteUrl("/how-it-works#faq"),
        mainEntity: FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  const phases: [string, number, string][] = [
    ["Muster", secs(TIMINGS.musterMs), "The array is rolled and the pick order is published."],
    [
      "Draft: Callings",
      secs(TIMINGS.draftCallingMs),
      `Rank up to ${DRAFT_RANKS} of the ${CALLINGS.length}. One of each per table.`,
    ],
    [
      "Draft: Kit",
      secs(TIMINGS.draftKitMs),
      `Rank up to ${DRAFT_RANKS} of the ${KIT.length}, in reverse pick order.`,
    ],
    ["Assign", secs(TIMINGS.assignMs), "Place the six numbers, choose a Hook."],
    ["Act", secs(TIMINGS.actMs), `Commit an Approach. Happens ${acts} times.`],
    ["The reveal", secs(TIMINGS.actResultMs), "The ledger, what nobody took, keep or hide."],
    ["The Ballad", secs(TIMINGS.balladMs), "Laurels are cast and the Hoard is awarded."],
  ];

  return (
    /* The reading column is centred in the shell rather than pinned to its left
       edge, which is what made 474px of empty right-hand margin read as a
       broken layout. From xl the width that is left over carries the contents
       rail, so the page is a column plus a margin doing a job rather than a
       column plus a gap. */
    <div className="py-8 sm:py-12 xl:flex xl:justify-center xl:gap-10">
      <JsonLd data={pageLd} />
      <Contents rail />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <p className="label-caps">How to play</p>
          <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
            How to play Tavern Party: the whole rulebook on one page
          </h1>
          <p className="prose-read text-text-mid">
            Roll a character, survive the night, and find out who the rest of them were prepared
            to send through the door. {MIN_PLAYERS} to {MAX_PLAYERS} of you, {runLength}, no
            downloads and no account.
            Everybody builds a character out of the same six numbers, the party takes on{" "}
            {acts} encounters together, and exactly one of you walks out with the Hoard. Every
            phase is simultaneous, so nothing ever waits on one person and a table of six takes
            the same time as a table of two.
          </p>
          <Contents />
        </header>

        {/* ---------------------------------------------------------------- table */}
        <Section id="the-table" step="First" title="The table, and the clock">
          <p className="prose-read text-text-mid">
            A run is a fixed sequence of timed beats. Each one ends on its deadline whether or
            not everybody acted, and the deadline default is always a real move rather than a
            skip, so a closed tab is a problem the table can see instead of a phase that hangs.
          </p>
          {/* A scroll container a keyboard can reach. Without tabindex a narrow
              screen could see the first two columns of this table and had no way
              to get at the third: there is nothing focusable inside it to arrow
              from. The name is what makes the stop worth landing on. */}
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="The beats of a run, scrollable sideways"
          >
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                The phases of a run, in order, with the seconds each one lasts
              </caption>
              <thead>
                <tr className="border-b border-border-strong">
                  <th scope="col" className="label-caps py-2 pr-4">
                    Beat
                  </th>
                  <th scope="col" className="label-caps py-2 pr-4 text-right">
                    Seconds
                  </th>
                  <th scope="col" className="label-caps py-2">
                    What you do
                  </th>
                </tr>
              </thead>
              <tbody>
                {phases.map(([name, seconds, what]) => (
                  <tr key={name} className="border-b border-border-dim align-top">
                    <th scope="row" className="py-2 pr-4 font-semibold text-text-hi">
                      {name}
                    </th>
                    <td className="num py-2 pr-4 text-right text-text-hi">{seconds}</td>
                    <td className="py-2 text-text-mid">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* -------------------------------------------------------------- calling */}
        <Section id="calling" step="Then" title="Your Calling: what you do">
          <p className="prose-read text-text-mid">
            The Calling is the loudest choice in the game and the first one you make. There are{" "}
            {CALLINGS.length}, and only one of each per table, so two of you cannot both be the
            Knife. You submit up to {DRAFT_RANKS} ranked choices at the same time as everybody
            else, and the server grants each player their highest surviving pick in the
            published order. Being denied your first choice is the point. That is the moment a
            draft becomes a game instead of a form.
          </p>
          <p className="prose-read text-text-mid">
            A Calling gives you three things. Two ability affinities, meaning the two things
            your sort of person is trained at, worth {signed(AFFINITY_BONUS)} to the total
            whenever you roll one of them. One Signature: a special move you may use once in
            the whole run and never again. And one Failing, which is the situation your
            character is worst in. Every encounter is labelled with a word or two saying what
            sort of trouble it is, and when one of those labels matches your Failing, everything
            that goes wrong in it costs you double.
          </p>
          <p className="prose-read text-text-mid">
            The Failings deliberately do not name the frightening situations. A Failing on the
            dark, or on something with teeth, would just be a tax on the encounters everybody
            already dreads. They name the situation that makes you irrelevant instead: a crowd
            with no doorway in it to hold, a ledger that will not balance, a fire no dog will
            walk towards. Being useless is a more interesting problem than being hurt. There is
            a{" "}
            <Link href="/characters/classes" className="text-accent underline">
              longer write-up of all {CALLINGS.length}
            </Link>{" "}
            if you would rather read them properly before you have to rank them under a clock.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CALLINGS.map((c) => (
              <li key={c.id}>
                <Card className="h-full">
                  <h3 className="font-display text-lg font-bold text-text-hi">{c.name}</h3>
                  <p className="mt-1 text-sm italic text-text-mid">{c.blurb}</p>
                  <dl className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="label-caps">Good at</dt>
                      <dd className="text-text-hi">
                        {c.affinities.map((a) => ABILITY_LABEL[a]).join(" and ")}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="label-caps">Signature</dt>
                      <dd className="text-text-hi">{c.signature.label}</dd>
                    </div>
                    {/*
                      This printed `c.failing.tag` and nothing else, so the most
                      important line about each Calling rendered as a one-word
                      database key in monospace: "FAILING: CORPSE". The prose was
                      already written and already good, and the home page was
                      using it. The tag stays, because it is real information to
                      a rules reader (it is what matches a Calling to a scene,
                      and scenes carry the same words), but it is a parenthetical
                      now rather than the whole answer.
                    */}
                    <div className="flex flex-col gap-0.5">
                      <dt className="label-caps">Failing</dt>
                      <dd className="text-text-hi">
                        {c.failing.text}{" "}
                        <span className="text-text-mid">
                          (encounters tagged{" "}
                          <span className="font-mono uppercase">{c.failing.tag}</span>)
                        </span>
                      </dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- blood */}
        <Section id="blood" step="Dealt to you" title="Your Blood: where you are from">
          <p className="prose-read text-text-mid">
            There are {BLOODS.length} Bloods and they are not scarce, so they are dealt rather
            than drafted. A Blood is not a bag of stat bonuses. Not one of these adds to a roll.
            They bend what a result costs, who it costs, or what you knew before you committed,
            so your Blood changes the shape of your night rather than the size of your numbers.
            Each one may be used once in a run, and{" "}
            <Link href="/characters/origins" className="text-accent underline">
              all {BLOODS.length} are written out at length
            </Link>{" "}
            elsewhere.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BLOODS.map((b) => (
              <li key={b.id}>
                <Card className="h-full">
                  <h3 className="font-display text-lg font-bold text-text-hi">{b.name}</h3>
                  <p className="mt-1 text-sm italic text-text-mid">{b.blurb}</p>
                  <p className="mt-2 text-sm text-text-hi">{b.powerText}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- array */}
        <Section id="array" step="The bit that ends an old argument" title="The house array">
          <p className="prose-read text-text-mid">
            The server rolls {ARRAY_SIZE} numbers once, for the whole room, by throwing{" "}
            {/* "six-sided" is the one transcribed word on the page. rollScore in
                lib/game/random.ts hardcodes d6 and exports no constant for it, so
                there is nothing to read. The number of dice and the drop are real. */}
            {ARRAY_DICE} six-sided dice and dropping the lowest{" "}
            {ARRAY_DROP === 1 ? "one" : ARRAY_DROP}. Every player at the table then assigns
            those same {ARRAY_SIZE} numbers to their own six abilities.
          </p>
          <p className="prose-read text-text-mid">
            This is deliberate. The old argument about rolling against buying points is a fight
            between two different kinds of fairness, real dice on one side and an equal start on
            the other, and it is unwinnable because each side is defending something else. One
            shared rolled array gives you both, and it moves the whole decision to the
            interesting place: where the highest number goes, and who is prepared to live with
            the lowest.
          </p>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              What a score is worth on a roll
            </h3>
            <p className="mt-1 text-sm text-text-mid">
              The familiar curve. A score of 10 or 11 adds nothing, and every two points either
              side of that moves the modifier by one.
            </p>
            <div
              className="mt-3 overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Ability score against roll modifier, scrollable sideways"
            >
              <table className="w-full min-w-[30rem] border-collapse text-center text-sm">
                <caption className="sr-only">Ability score to roll modifier</caption>
                <tbody>
                  <tr className="border-b border-border-dim">
                    <th scope="row" className="label-caps py-2 pr-3 text-left">
                      Score
                    </th>
                    {[6, 8, 10, 12, 14, 16, 18].map((s) => (
                      <td key={s} className="num py-2 text-text-mid">
                        {s}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className="label-caps py-2 pr-3 text-left">
                      On a roll
                    </th>
                    {[6, 8, 10, 12, 14, 16, 18].map((s) => (
                      <td key={s} className="num py-2 text-text-hi">
                        {signed(abilityMod(s))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ABILITIES.map((a) => (
              <li key={a}>
                <Card className="h-full">
                  <h3 className="font-display text-base font-bold uppercase text-text-hi">
                    {ABILITY_LABEL[a]}
                  </h3>
                  <p className="mt-1 text-sm text-text-mid">{ABILITY_BLURB[a]}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* ------------------------------------------------------------------ kit */}
        <Section id="kit" step="And a second draft" title="The Kit, in reverse">
          <p className="prose-read text-text-mid">
            {KIT.length} pieces of gear, one of each per table, drafted exactly like the
            Callings with one change: the order is reversed. Whoever got first crack at the
            Callings picks last on the Kit. One reversed list, and a draft position that would
            otherwise be strictly better becomes a real fork. The best Calling or the best gear,
            not both.
          </p>
          <p className="prose-read text-text-mid">
            Nothing in the Kit is enchanted. Some of it is a flat bonus to one ability, which
            helps in every encounter and never runs out. The rest is a charge, a small number of
            uses of something that fires when you choose: a reroll, a look at a hidden number,
            or a torch. A torch is what you burn to see what the Reckless line actually needs,
            at {torches(REVEAL_COST_TORCHES)} per look.{" "}
            <Link href="/characters/gear" className="text-accent underline">
              All {KIT.length} pieces
            </Link>{" "}
            are listed with what each one is actually for.
          </p>
        </Section>

        {/* ----------------------------------------------------------------- hook */}
        <Section id="hook" step="The important one" title="Your Hook does three things">
          <p className="prose-read text-text-mid">
            A Hook is one specific thing you did, or that was done to you, and what it left
            behind. There are {HOOKS.length} and they are not exclusive. Backgrounds usually die
            in games like this because they are social features that only fire if somebody
            remembers them. This one is currency, and it is spent three different ways.{" "}
            <Link href="/characters/backstories" className="text-accent underline">
              Every one of the {HOOKS.length} is written out in full
            </Link>
            , which is worth a look before you have to pick one in seconds.
          </p>
          <ol className="flex flex-col gap-3">
            <li>
              <Card>
                <p className="label-caps mb-1">One</p>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  It puts an encounter into everybody&apos;s night
                </h3>
                <p className="mt-1 text-text-mid">
                  Every Hook names a tag the server guarantees to place in the deck. Take the
                  one about the second key you cut and there is a lock in somebody&apos;s Act.
                  Take the one about walking away from the column and there is a patrol. Your
                  background is not a note on your sheet, it is an edit to the adventure the
                  other four have to play, and they can all see whose fault it was.
                </p>
              </Card>
            </li>
            <li>
              <Card>
                <p className="label-caps mb-1">Two</p>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  It is a fuel supply your opponents control
                </h3>
                <p className="mt-1 text-text-mid">
                  Each Hook carries {HOOK_TOKENS_MAX} tokens, worth{" "}
                  {signed(HOOK_TOKEN_VALUE)} on a roll each. They refill only when your Hook tag
                  is called against you. Being singled out stops being something that happens to
                  you and becomes the thing you were hoping for, and leaning into your own worst
                  trait is rewarded instead of quietly punished.
                </p>
              </Card>
            </li>
            <li>
              <Card>
                <p className="label-caps mb-1">Three</p>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  It makes you the cheapest volunteer, in public
                </h3>
                <p className="mt-1 text-text-mid">
                  At the top of every Act the server prints whose Hook tags are live. Being
                  Marked pays {signed(MARK_BONUS)} Renown for taking the Act at all, and costs
                  you {signed(-MARK_FLINCH_PENALTY)} Renown more for flinching from it. The whole
                  table sees the Mark, so it is a target as well as a wage. Everybody knows who
                  ought to be going through that door, and everybody knows what it is worth to
                  them.
                </p>
              </Card>
            </li>
          </ol>
          <details className="rounded-lg border border-border-dim bg-bg-1 p-4">
            <summary className="font-display cursor-pointer text-base font-semibold text-text-hi">
              The tag vocabulary, all {Object.keys(TAG_MEANING).length} of it
            </summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.entries(TAG_MEANING) as [Tag, string][]).map(([tag, meaning]) => (
                <div key={tag} className="flex flex-wrap gap-x-2 text-sm">
                  <dt className="font-mono uppercase tracking-[0.1em] text-accent">{tag}</dt>
                  <dd className="text-text-mid">{meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Section>

        {/* ------------------------------------------------------------------ act */}
        <Section id="act" step="Then, five times" title="An Act">
          <p className="prose-read text-text-mid">
            An encounter is put in front of the whole party, with exactly three ways through it.
            Each one names an ability, a target number, what it pays if you make it and what it
            costs if you do not. You have {secs(TIMINGS.actMs)} seconds. Everybody commits at
            the same time and nobody sees anybody else&apos;s choice until the Act resolves.
          </p>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              One of the three is the Reckless line
            </h3>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-text-mid">
              <li>It pays the most and it costs the most.</li>
              <li>
                Its target number is hidden. You can burn {torches(REVEAL_COST_TORCHES)} to see
                it, which makes information something you buy rather than something you are
                given.
              </li>
              <li>
                Only one player per Act may take it. It is one door. If two of you reach for it,
                the quicker hand takes it, the other is moved to the door they are best at, and
                the party takes a point of Dread for the scramble.
              </li>
            </ul>
            <p className="mt-3 text-text-mid">
              It is deliberately a bad bet for a player with no claim on it. Measured across
              every encounter in the pool, an ordinarily trained character does better on the
              best safe line. The same character, Marked for that Act or spending a single Hook
              token, does better on the Reckless one. So the door has a natural claimant each
              time, the Mark says publicly who that is, and it is never a free lunch.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">Nomination</h3>
            <p className="mt-1 text-text-mid">
              Before you commit you may nominate somebody else for the Reckless line. If they
              pull it off you take {Math.round(NOMINATION_SHARE * 100)} per cent of their prize.
              If they do not, you lose {NOMINATION_PENALTY} Renown. You can shove somebody
              through a door, and it costs you when they do not come back. Nominating the player
              who was never the claimant is the hostile version, and everybody can see you do
              it.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Flinch: what happens when somebody closes the tab
            </h3>
            <p className="mt-1 text-text-mid">
              The deadline default is not a skip and not a bot playing your character. It is a
              real move called Flinch, narrated as hesitating: {signed(FLINCH_RENOWN)} Renown
              and {signed(FLINCH_DREAD)} Dread on the whole party, and{" "}
              {signed(-MARK_FLINCH_PENALTY)} Renown more if you were Marked for that Act. It scores
              badly and it taxes everyone, which makes an absent player something the table can
              see and argue about. Flinching scales with Dread like every other cost, because a
              game that needs somebody to go through the door cannot make standing still the
              cheapest option once things go wrong.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              Afterwards, you see the doors nobody took
            </h3>
            <p className="mt-1 text-text-mid">
              The reveal shows all three lines, including the ones the party left alone, and
              what they would have paid or cost. That is where the regret lives, and it is the
              only honest way to find out whether the argument you lost was the right argument.
            </p>
          </Card>
        </Section>

        {/* --------------------------------------------------------------- ledger */}
        <Section id="ledger" step="The thing nobody expects" title="The itemised ledger">
          <p className="prose-read text-text-mid">
            The game never prints a total. It prints the named sources that made the total, in
            the order you would read them out. Every number you see can be traced back to a
            word, which means a roll is a sentence rather than a sum, and you always know
            exactly which of your choices did the work.
          </p>
          <p className="prose-read text-text-mid">
            Here is a real one. You are the {CALLING.name}, carrying the{" "}
            {ITEM.name.toLowerCase()}, with {SCORE} in {ABILITY_LABEL[APPROACH.ability]}, and you
            spend one Hook token. The encounter is {SCENE.title} and you have taken the line
            called {APPROACH.label.toLowerCase()}.
          </p>
          {/* max-w-none, because Sheet's own default is 576px and mx-auto centres
              it: the worked example sat as a narrow island between two paragraphs
              that both start at the column's left edge. It is a figure in the
              reading column now and shares its edges. */}
          <Sheet
            className="max-w-none"
            title={`${SCENE.title}: ${APPROACH.label}`}
            subtitle={`Needed ${APPROACH.tn} on ${ABILITY_LABEL[APPROACH.ability]}`}
          >
            <p className="mb-4 text-paper-ink">{SCENE.setup}</p>
            <table className="w-full border-collapse text-left">
              <caption className="sheet-label mb-2 text-left">
                What went into the roll, in the order it is read out
              </caption>
              <tbody>
                {LEDGER.map((mod, i) => (
                  <tr key={`${mod.label}-${i}`} className="border-b border-paper-rule">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-normal text-paper-ink"
                    >
                      {i === 0 ? `The die: ${mod.label}` : mod.label}
                    </th>
                    <td className="num py-2 text-right text-paper-ink">
                      {i === 0 ? mod.value : signed(mod.value)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="py-2 pr-3 text-left font-bold text-paper-ink">
                    Total
                  </th>
                  <td className="num py-2 text-right text-lg text-paper-ink">{TOTAL}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {/* Three boxes, three different units. Two of them printed a bare
                  number, so nothing said that one was a face and the other a
                  total with every bonus already in it. */}
              <SheetBox label="Rolled" value={FACE} hint={`d${DIE_SIDES}`} />
              <SheetBox label="Needed" value={APPROACH.tn} hint="total" />
              <SheetBox
                label={MADE_IT ? "Paid" : "Cost"}
                value={MADE_IT ? signed(APPROACH.deed) : signed(-APPROACH.cost.renown)}
                hint="Renown"
              />
            </div>
            <p className="mt-4 border-t border-paper-rule pt-3 text-paper-ink">
              {MADE_IT ? APPROACH.win : APPROACH.lose}
            </p>
          </Sheet>
          <p className="prose-read text-text-mid">
            Read that list again and notice what is doing the work. The die gave you {FACE}. The
            reason it was enough is that you drafted a Calling trained in{" "}
            {ABILITY_LABEL[APPROACH.ability]}, put a high number there, took the piece of Kit
            that suits it, and spent a token you had been saving. Four decisions, each worth a
            line, all of them yours.
          </p>
          <Card>
            <h3 className="font-display text-lg font-bold text-text-hi">
              And what the same failure costs later on
            </h3>
            <p className="mt-1 text-text-mid">
              Missing that line costs {APPROACH.cost.renown} Renown and puts{" "}
              {APPROACH.cost.dread} Dread on the party. With Dread already at{" "}
              {DREAD_DOUBLE_AT} Dread it costs {APPROACH.cost.renown * BAD_NIGHT} Renown and{" "}
              {APPROACH.cost.dread * BAD_NIGHT} Dread instead. Costs double, never the roll. Being
              told the situation is worse is the same arithmetic as being told you are worse at
              something, and it is a great deal easier to live with.
              {RECKLESS
                ? ` The Reckless line is the one exception, because it already carries the worst
                   cost in the encounter against a fixed reward.`
                : ""}
            </p>
          </Card>
        </Section>

        {/* ----------------------------------------------------------------- scar */}
        <Section id="scar" step="Every failure" title="A Scar, and the decision it comes with">
          <p className="prose-read text-text-mid">
            Every failed roll leaves a Scar. A Scar is a wound and an asset at the same time,
            and it hands you one dice-free decision after every Act, with{" "}
            {secs(TIMINGS.actResultMs)} seconds to make it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2">
                <Pill tone="accent">Keep it</Pill>
              </div>
              <h3 className="font-display mt-2 text-lg font-bold text-text-hi">
                Public, and it pays
              </h3>
              <p className="mt-1 text-text-mid">
                Everyone sees it. It is worth {KEPT_SCAR_VALUE} Renown at the Ballad, and it
                puts{" "}
                {signed(KEEP_SCAR_DREAD)} Dread on the party. A personal gain funded by a tax on
                everybody, which is exactly why the table will have an opinion.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Pill tone="neutral">Hide it</Pill>
              </div>
              <h3 className="font-display mt-2 text-lg font-bold text-text-hi">
                Private, and it costs
              </h3>
              <p className="mt-1 text-text-mid">
                Nobody is told what it was, only that you have one. It costs you{" "}
                {HIDE_SCAR_RENOWN} Renown now, and the party nothing. Say nothing about it and
                the night stays survivable for everybody else.
              </p>
            </Card>
          </div>
          <p className="prose-read text-text-mid">
            If you do not decide, it is hidden rather than kept, so an absent player pays for
            their own closed tab instead of taxing the table with it.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- dread */}
        <Section id="dread" step="Shared, and it only goes up" title="Dread, and its two thresholds">
          <p className="prose-read text-text-mid">
            Dread is one number belonging to the whole party. Failures add to it, kept Scars add
            to it, flinching adds to it, and two people grabbing the same door adds to it. The
            thresholds are published rather than hidden, because a number nobody can see is not
            frightening.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="label-caps">Threshold one</p>
              {/* The threshold was a bare 4xl numeral. On the one page that has to
                  teach the vocabulary, a figure that large needs to say what it
                  counts, and the word is also what tells the two cards apart if
                  gold and red do not arrive. */}
              <p className="mt-1 flex items-baseline gap-2">
                <span className="num text-4xl text-accent">{DREAD_DOUBLE_AT}</span>
                <span className="label-caps">Dread</span>
              </p>
              <h3 className="font-display mt-1 text-lg font-bold text-text-hi">
                Everything costs more
              </h3>
              <p className="mt-1 text-text-mid">
                Every cost doubles, including flinching, and including your own Failing on top
                of it. The Reckless line is exempt, because it was already the worst bet in the
                encounter.
              </p>
            </Card>
            <Card>
              <p className="label-caps">Threshold two</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="num text-4xl text-danger">{DREAD_TURN_AT}</span>
                <span className="label-caps">Dread</span>
              </p>
              <h3 className="font-display mt-1 text-lg font-bold text-text-hi">
                The night turns
              </h3>
              <p className="mt-1 text-text-mid">
                The last Act is drawn from a worse deck: the hardest encounter in the pool that
                the party has not already faced. There is no way to draw it back down at that
                point except one Calling and one Blood, and only one of you has each.
              </p>
            </Card>
          </div>
          <p className="prose-read text-text-mid">
            Dread is what makes everybody flinching an unstable position. If nobody moves, the
            whole party pays, and it keeps paying. Somebody has to go through the door, and the
            argument about which of you it is going to be is the game.
          </p>
        </Section>

        {/* --------------------------------------------------------------- ballad */}
        <Section id="ballad" step="Last" title="The Ballad decides it">
          <p className="prose-read text-text-mid">
            {secs(TIMINGS.balladMs)} seconds at the end, and four things are added up.
          </p>
          <ol className="flex flex-col gap-3">
            <li>
              <Card>
                <h3 className="font-display text-lg font-bold text-text-hi">Renown</h3>
                <p className="mt-1 text-text-mid">
                  Everything you earned, less everything you paid, accumulated across the whole
                  run.
                </p>
              </Card>
            </li>
            <li>
              <Card>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  Kept Scars, {KEPT_SCAR_VALUE} Renown each, gated
                </h3>
                <p className="mt-1 text-text-mid">
                  They pay only if your Renown is at or above the table median. Without that
                  gate the winning line is to never take a risk, collect cheap Scars and keep
                  all of them, which is the failure every game like this has to clamp. Wearing
                  your wounds has to mean you were in the fight.
                </p>
              </Card>
            </li>
            <li>
              <Card>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  Laurels, {LAUREL_VALUE} Renown each
                </h3>
                <p className="mt-1 text-text-mid">
                  One secret vote each, never for yourself, cast in the last{" "}
                  {secs(TIMINGS.balladMs)} seconds. It means the player who was out of
                  contention two Acts ago still holds something the leaders want, right up to
                  the end.
                </p>
              </Card>
            </li>
            <li>
              <Card>
                <h3 className="font-display text-lg font-bold text-text-hi">The Hoard</h3>
                <p className="mt-1 text-text-mid">
                  It goes to exactly one player, even on a tie, broken by Renown and then by how
                  little you hid. The party survived together. One of you got paid.
                </p>
              </Card>
            </li>
          </ol>
        </Section>

        {/* --------------------------------------------------------------- faq */}
        <Section id="questions" step="And the ones that come up" title="Questions about the rules">
          <dl className="flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="rounded-lg border border-border-dim bg-bg-1 p-4">
                <dt className="font-display text-lg font-bold text-text-hi">{q}</dt>
                <dd className="mt-2 text-text-mid">{a}</dd>
              </div>
            ))}
          </dl>
          <p className="prose-read text-text-mid">
            If you have never played anything like this before, the rules above are the
            reference rather than the introduction. There is{" "}
            <Link href="/roleplaying-games-for-beginners" className="text-accent underline">
              a shorter piece written for a first night
            </Link>{" "}
            that translates the vocabulary and walks through what the first ten minutes
            actually feel like.
          </p>
        </Section>

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
            Today&apos;s puzzles
          </Link>
          <Link
            href="/characters"
            className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
          >
            Read the character lists
          </Link>
        </footer>
      </div>
    </div>
  );
}
