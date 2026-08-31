/**
 * The eight Bloods, in full, for anybody looking for somewhere to be from.
 *
 * BLOOD_DETAIL was written for the creation screen and rendered nowhere. It is
 * the best answer this site has to "my character has no background", because
 * none of the eight is a species and none of them adds a number to a roll.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BLOODS, BLOOD_DETAIL } from "@/lib/content/bloods";
import { Breadcrumb, Entry, MoreIdeas, CHARACTER_PAGES } from "../shared";

const PAGE = CHARACTER_PAGES[1];

export const metadata: Metadata = {
  title: "Character Origin Ideas: Where They Are From",
  description:
    "Eight places a character can be from, and what each one taught them to put up with. No pointed ears and no wise elders, just a high valley, a fen and a tide coast.",
  alternates: { canonical: PAGE.path },
  openGraph: {
    title: "Character Origin Ideas: Where They Are From",
    description:
      "Eight origins with no species attached. A hill farmer and a gravedigger differ in what stopped bothering them years ago.",
    url: PAGE.path,
  },
};

export default function BloodsPage() {
  return (
    /* Centred, like its three sibling lists: the reading measure is 646px inside
       a 1120px shell, and pinned left that is a third of the page left empty. */
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-4">
        <Breadcrumb page={PAGE} />
        <p className="label-caps">The Bloods</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Eight character origin ideas, and not one of them is a species
        </h1>
        {/* The one thing this page did not say, and a player found out by playing:
            you do not choose your Blood at a table, the house deals you one. It
            is presented here in exactly the browse-and-pick framing the Callings
            and the Kit use, both of which you really do choose. */}
        <p className="prose-read text-text-mid">
          <strong className="text-text-hi">The house deals you one of these.</strong> Your
          Calling you draft and your Kit you draft; your Blood arrives with the night,
          because Bloods are not scarce and there is nothing to fight over. Read them for
          the character you are handed, or take the lot to a table of your own.
        </p>
        <p className="prose-read text-text-mid">
          There are no pointed ears in this game and no long-lived wise elders. A Blood is
          where you are from and therefore what you were taught to put up with: the folk of a
          high valley, a fen, a tide coast, a burnt valley, a charcoal stack. Two of these
          differ the way a hill farmer and a gravedigger differ, which is to say in what
          stopped bothering them years ago.
        </p>
        <p className="prose-read text-text-mid">
          That is the trick worth borrowing. An origin that hands you a bonus to a stat is a
          number. An origin that tells you what the person no longer finds frightening is a
          character, and it survives being taken to a completely different game. Not one of the
          eight below adds anything to a roll. Each of them changes what a bad result costs, or
          who ends up paying for it, or what you knew before you agreed to go in.
        </p>
      </header>

      {BLOODS.map((b) => (
        <Entry
          key={b.id}
          name={b.name}
          blurb={b.blurb}
          detail={BLOOD_DETAIL[b.id]}
          facts={[["Once a run", b.powerText]]}
        />
      ))}

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Why these are dealt</h2>
        <p className="prose-read text-text-mid">
          A table does not draft its Bloods. They are dealt out, and two players can share one,
          because the game already has one exclusive choice in it and a second would turn
          creation into two arguments in a row. It also keeps{" "}
          <Link href="/characters/classes" className="text-accent underline">
            the Calling
          </Link>{" "}
          the loudest thing about you, which is what people mean when they say a character is
          mostly their class.
        </p>
        <p className="prose-read text-text-mid">
          Being handed one rather than choosing it turns out to be the better half of the deal.
          You get somewhere to be from that you would not have picked, and then you have to make
          it true. That is closer to how a person ends up from anywhere.
        </p>
      </section>

      <MoreIdeas current={PAGE.path} />
    </div>
  );
}
