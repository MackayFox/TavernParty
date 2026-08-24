/**
 * The twelve pieces of Kit, in full.
 *
 * Built from KIT_DETAIL, the same writing the draft screen shows a player mid-run.
 * It is published here as a page in its own right because the twelve pieces of Kit are
 * something people search for, and a paragraph only reachable by being
 * in a live game is a paragraph no search engine will ever see.
 * closest thing this site has to a starting equipment list, and the whole reason
 * it is worth publishing is that every entry is an ordinary object described by
 * the detail that makes it that object: the knot every arm's length, the pick
 * that is bent on purpose, the two mouthfuls left.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { KIT, KIT_DETAIL } from "@/lib/content/kit";
import { ABILITY_LABEL, REVEAL_COST_TORCHES } from "@/lib/game/rules";
import type { KitItem } from "@/lib/game/types";
import { Breadcrumb, Entry, MoreIdeas, CHARACTER_PAGES } from "../shared";

const PAGE = CHARACTER_PAGES[2];

export const metadata: Metadata = {
  title: "Adventuring Gear: Twelve Things Worth Carrying",
  description:
    "A starting equipment list with nothing enchanted in it. Forty foot of tarred rope, a roll of picks, somebody else's map, and a flask with two mouthfuls left in it.",
  alternates: { canonical: PAGE.path },
  openGraph: {
    title: "Adventuring Gear: Twelve Things Worth Carrying",
    description:
      "Twelve ordinary objects somebody on the road would actually have on them, and what each one is for. Nothing here glows.",
    url: PAGE.path,
  },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the item does in a run, in the words the game would use for it. */
function whatItDoes(item: KitItem): string[] {
  const out: string[] = [];
  if (item.bonus) {
    out.push(
      `+${item.bonus.value} to ${ABILITY_LABEL[item.bonus.ability]}, on every roll, all night`
    );
  }
  if (item.charge) {
    const { kind, uses } = item.charge;
    if (kind === "torch") {
      out.push(
        `${plural(uses, "torch", "torches")} to burn, at ${REVEAL_COST_TORCHES} for a look at a number the night is keeping back`
      );
    } else if (kind === "reroll") {
      out.push(`${plural(uses, "reroll", "rerolls")} of your own die, taken when you choose`);
    } else {
      out.push(
        `${plural(uses, "look", "looks")} at a hidden target number, without burning anything for it`
      );
    }
  }
  return out;
}

export default function KitPage() {
  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-4">
        <Breadcrumb page={PAGE} />
        <p className="label-caps">The Kit</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Twelve pieces of adventuring gear, and not one of them glows
        </h1>
        <p className="prose-read text-text-mid">
          Everything on this list is an object somebody walking a road would genuinely be
          carrying, and every one of them is written down by the detail that makes it that
          object rather than the generic version of it. The rope is knotted every arm&apos;s
          length so there is always something to put a hand on. The seventh pick in the roll is
          bent on purpose. The flask has two mouthfuls left, which makes it a decision about
          when rather than whether.
        </p>
        <p className="prose-read text-text-mid">
          The set splits rather than scales, which is the part worth taking to another game.
          Five of these are a flat bonus that helps in every scene and never runs out. Five are
          a charge, two uses of something that fires when you say so, worth more than a bonus in
          the moment you spend it and worth nothing at all in the scene after. Two carry a
          little of both at reduced strength, for people who would rather not commit. There is
          no dud at the bottom of the list, because the player who won the argument about{" "}
          <Link href="/characters/classes" className="text-accent underline">
            which job they were doing
          </Link>{" "}
          picks from this one last.
        </p>
      </header>

      {KIT.map((item) => (
        <Entry
          key={item.id}
          name={item.name}
          blurb={item.blurb}
          detail={KIT_DETAIL[item.id]}
          facts={whatItDoes(item).map(
            (line, i): [string, React.ReactNode] => [i === 0 ? "What it does" : "And", line]
          )}
        />
      ))}

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Why nothing here is magic
        </h2>
        <p className="prose-read text-text-mid">
          A magic item is a promise that the interesting thing is in the object. A whetstone in
          an oiled rag is a promise that the interesting thing is in the person who has kept it
          dry for two years. The second one is cheaper to write, harder to run out of, and it
          survives being handed to somebody at a table with completely different rules.
        </p>
        <p className="prose-read text-text-mid">
          It also keeps the gear from being the reason you won.{" "}
          <Link href="/how-it-works" className="text-accent underline">
            Every roll here is itemised
          </Link>
          , printed as the named things that made it rather than as a total, and a piece of Kit
          is one line in that list. Usually the shortest one.
        </p>
      </section>

      <MoreIdeas current={PAGE.path} />
    </div>
  );
}
