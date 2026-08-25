/**
 * The eight Callings, in full, for anybody looking for class ideas.
 *
 * Built from CALLING_DETAIL, the same writing the draft screen shows a player mid-run.
 * It is published here as a page in its own right because the eight Callings are
 * something people search for, and a paragraph only reachable by being
 * in a live game is a paragraph no search engine will ever see.
 * how-it-works page shows the mechanical facts, this one shows the writing, and
 * nothing here is transcribed: change a Calling and the page changes with it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CALLINGS, CALLING_DETAIL } from "@/lib/content/callings";
import { isTag, TAG_MEANING } from "@/lib/content/tags";
import { ABILITY_LABEL, AFFINITY_BONUS } from "@/lib/game/rules";
import { Breadcrumb, Entry, MoreIdeas, CHARACTER_PAGES } from "../shared";

const PAGE = CHARACTER_PAGES[0];

/** `Calling.failing.tag` is typed as a plain string, so say the word either way. */
const meaning = (tag: string) => (isTag(tag) ? TAG_MEANING[tag] : tag);

export const metadata: Metadata = {
  title: "Eight Fantasy Character Class Ideas",
  description:
    "Eight classes written as verbs rather than stat spreads: hold the door, take the credit, price the unknown, take the wound for somebody else. Free to borrow.",
  alternates: { canonical: PAGE.path },
  openGraph: {
    title: "Eight Fantasy Character Class Ideas",
    description:
      "Warden, Knife, Hedge-Witch, Chanter, Reckoner, Houndmaster, Sapper, Oathbound. What each one does, and what makes it useless.",
    url: PAGE.path,
  },
};

export default function CallingsPage() {
  return (
    /* Centred. The reading measure is 646px and the shell is 1120px, so left-
       aligned it left a third of the page empty on the right and read as a
       layout that had broken rather than one that had been decided. */
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-4">
        <Breadcrumb page={PAGE} />
        <p className="label-caps">The Callings</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Eight fantasy character class ideas, written as verbs
        </h1>
        <p className="prose-read text-text-mid">
          Most class lists are eight stat spreads with different hats on. These are eight
          things a person does when the room goes wrong: hold the door, take the credit, calm
          everybody down, lift the room, price the unknown, try again, come at it another way,
          take the wound for somebody else. Read the eight of those in order and you have read
          the whole design.
        </p>
        <p className="prose-read text-text-mid">
          Each one also names the thing it is no use against, which is the part worth stealing
          if you take nothing else. A weakness that hurts you is a tax. A weakness that makes
          you irrelevant is a scene. None of these Failings names a monster: they name a crowd
          with no doorway in it, a ledger that will not balance, a fire no dog will walk
          towards.
        </p>
      </header>

      {CALLINGS.map((c) => (
        <Entry
          key={c.id}
          name={c.name}
          blurb={c.blurb}
          detail={CALLING_DETAIL[c.id]}
          facts={[
            [
              "Trained in",
              `${c.affinities.map((a) => ABILITY_LABEL[a]).join(" and ")}, worth ${AFFINITY_BONUS > 0 ? "+" : ""}${AFFINITY_BONUS} on a roll`,
            ],
            ["Once a night", c.signature.label],
            ["No use against", `${meaning(c.failing.tag)}. ${c.failing.text}`],
          ]}
        />
      ))}

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          How to pick one, if you are picking
        </h2>
        <p className="prose-read text-text-mid">
          Only one player at a table can be each of these, so the choice is made against
          everybody else at once and being denied the one you wanted is the point rather than
          the bug. If you are going to lose that argument, lose it towards the Calling whose
          Failing you can live with. Being hurt is recoverable. Being irrelevant for a whole
          scene, in front of four people who can all see it, is the thing you will remember.
        </p>
        <p className="prose-read text-text-mid">
          The rest of the character comes after.{" "}
          <Link href="/characters/origins" className="text-accent underline">
            Where you are from
          </Link>{" "}
          decides what a failure costs you,{" "}
          <Link href="/characters/gear" className="text-accent underline">
            one piece of gear
          </Link>{" "}
          decides what you can do twice, and{" "}
          <Link href="/characters/backstories" className="text-accent underline">
            what you did before this
          </Link>{" "}
          decides what turns up in everybody else&apos;s night.
        </p>
      </section>

      <MoreIdeas current={PAGE.path} />
    </div>
  );
}
