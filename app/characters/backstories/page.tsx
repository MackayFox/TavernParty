/**
 * The twenty Hooks, in full. The biggest piece of finished writing on the site
 * and, until this page, the piece nobody could read: HOOK_DETAIL is about
 * fourteen hundred words and was rendered by nothing.
 *
 * It is also the page with the clearest reason to exist. "Character backstory
 * ideas" is a question people genuinely type, and the honest answer to it is
 * twenty worked examples rather than a list of adjectives.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { HOOKS, HOOK_DETAIL } from "@/lib/content/hooks";
import { isTag, TAG_MEANING } from "@/lib/content/tags";
import { HOOK_TOKENS_MAX, HOOK_TOKEN_VALUE, MARK_BONUS } from "@/lib/game/rules";
import { Breadcrumb, Entry, MoreIdeas, CHARACTER_PAGES } from "../shared";

const PAGE = CHARACTER_PAGES[3];

export const metadata: Metadata = {
  title: "Twenty Fantasy Character Backstory Ideas",
  description:
    "Twenty written backstories, each one a specific thing done and what it left behind. You signed for a friend's loan, you left the lamp lit, you cut a second key.",
  alternates: { canonical: PAGE.path },
  openGraph: {
    title: "Twenty Fantasy Character Backstory Ideas",
    description:
      "Not a mysterious past. Twenty specific things done, and the person who still remembers each of them. Take any of them to your own table.",
    url: PAGE.path,
  },
};

/** `Hook.insertTag` and `callTag` are plain strings on the type. Say the word. */
const meaning = (tag: string) => (isTag(tag) ? TAG_MEANING[tag] : tag);

export default function HooksPage() {
  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-4">
        <Breadcrumb page={PAGE} />
        <p className="label-caps">The Hooks</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Twenty character backstory ideas, each one a specific thing done
        </h1>
        <p className="prose-read text-text-mid">
          Backstories die at real tables because they are social features. They only fire if
          somebody remembers them, and nobody remembers a mood. So every one of the twenty
          below is a thing that happened, with a date attached and a person who still thinks
          about it. You put your name to a friend&apos;s loan and he was over the water by
          spring. You were fifteen and you did not go back down to check the lamp, and eleven
          houses burned. You cut a second key for a client&apos;s strongroom and never asked who
          wanted it.
        </p>
        <p className="prose-read text-text-mid">
          The test each of these had to pass is simple enough to use anywhere: can four
          strangers form an opinion about the person from one line. That is what a background is
          for. If the answer is no, it is decoration, and the fix is almost always to replace
          the adjective with the incident.
        </p>
        <p className="prose-read text-text-mid">
          In this game each one also earns its keep three ways. It guarantees a matching problem
          turns up in the party&apos;s night, so your past is an edit to everybody else&apos;s
          evening. It carries {HOOK_TOKENS_MAX} tokens worth{" "}
          {HOOK_TOKEN_VALUE > 0 ? "+" : ""}
          {HOOK_TOKEN_VALUE} on a roll, and they only refill when your past is used against you,
          which puts your fuel supply in other people&apos;s hands. And when it is live the
          whole table can see it, which pays you {MARK_BONUS > 0 ? "+" : ""}
          {MARK_BONUS} Renown for going through the door and makes you the obvious volunteer.
          Take the mechanics or leave them. The twenty pasts work on their own.
        </p>
      </header>

      {HOOKS.map((h) => (
        <Entry
          key={h.id}
          name={h.name}
          blurb={h.blurb}
          detail={HOOK_DETAIL[h.id]}
          facts={[
            ["It puts into the night", meaning(h.insertTag)],
            ["It pays you when", meaning(h.callTag)],
          ]}
        />
      ))}

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Writing one of your own
        </h2>
        <p className="prose-read text-text-mid">
          Three things, and they are all in the twenty above. Name the incident rather than the
          feeling. Say what it left behind, because a past with no residue is a story rather
          than a background. And name the person who still remembers, because that person is the
          one who walks into a scene later and makes the whole thing worth having written down.
        </p>
        <p className="prose-read text-text-mid">
          Then decide what it is going to cost you. Fifteen of these twenty put one kind of
          problem into the world and get paid by a different one, so the thing you dragged in is
          not the thing that helps you. That gap is where a background stops being flattering
          and starts being a character.
        </p>
        <p className="prose-read text-text-mid">
          The rest of the sheet is{" "}
          <Link href="/characters/classes" className="text-accent underline">
            a job
          </Link>
          ,{" "}
          <Link href="/characters/origins" className="text-accent underline">
            somewhere to be from
          </Link>{" "}
          and{" "}
          <Link href="/characters/gear" className="text-accent underline">
            one thing in your hand
          </Link>
          . This is the part the other players will actually remember.
        </p>
      </section>

      <MoreIdeas current={PAGE.path} />
    </div>
  );
}
