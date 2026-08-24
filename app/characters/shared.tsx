/**
 * The character pages, and the furniture the five of them share.
 *
 * Every word on these pages was already written and had nowhere to live:
 * CALLING_DETAIL, BLOOD_DETAIL, KIT_DETAIL and HOOK_DETAIL are shipped in
 * `lib/content/` and were rendered by nothing at all. So this is not copy
 * written for a search engine and then hidden from players, it is the same
 * prose the creation screen shows, given a page it can be linked to.
 *
 * Each page targets a question somebody actually types, which is the only
 * reason there are four of them rather than one long one: "character class
 * ideas", "where is my character from", "what does an adventurer carry" and
 * "character backstory ideas" are four different searches and they want four
 * different lists.
 */
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";

const BASE = "https://tavernparty.co.uk";

export type CharacterPage = {
  path: string;
  /** The breadcrumb leaf and the link label. Short. */
  label: string;
  /** What the list is, in the words somebody searching would use. */
  heading: string;
  blurb: string;
};

export const CHARACTER_PAGES: CharacterPage[] = [
  {
    path: "/characters/classes",
    label: "Classes",
    heading: "Eight character class ideas",
    blurb:
      "The Callings. Eight jobs written as verbs rather than stat spreads: hold the door, take the credit, price the unknown, take the wound for somebody else.",
  },
  {
    path: "/characters/origins",
    label: "Origins",
    heading: "Eight character origin ideas",
    blurb:
      "The Bloods. Not species. Eight places to be from, and what each one taught you to put up with. A hill farmer and a gravedigger differ in what stopped bothering them.",
  },
  {
    path: "/characters/gear",
    label: "Gear",
    heading: "Twelve pieces of adventuring gear",
    blurb:
      "The Kit. Twelve ordinary objects somebody on the road would be carrying, described by the detail that makes it that object and not the generic version.",
  },
  {
    path: "/characters/backstories",
    label: "Backstories",
    heading: "Twenty character backstory ideas",
    blurb:
      "The Hooks. Twenty specific things done, or done to you, and what each one left behind. Never a mood, and never a mysterious past.",
  },
];

/**
 * The visible trail and the structured one, from the same two strings, because a
 * breadcrumb that disagrees with its own markup is worse than neither.
 */
export function Breadcrumb({ page }: { page: CharacterPage }) {
  const crumbs: [string, string][] = [
    ["Home", "/"],
    ["Characters", "/characters"],
    [page.label, page.path],
  ];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map(([name, path], i) => ({
            "@type": "ListItem",
            position: i + 1,
            name,
            item: `${BASE}${path}`,
          })),
        }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-text-mid">
          {crumbs.map(([name, path], i) => (
            <li key={path} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-text-low">
                  ›
                </span>
              )}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="text-text-hi">
                  {name}
                </span>
              ) : (
                <Link href={path} className="inline-flex min-h-11 items-center underline">
                  {name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/**
 * One entry in one of the four lists. All four have the same shape, which is not
 * a coincidence: a Calling, a Blood, a piece of Kit and a Hook are each a name, a
 * line somebody would say about it, a paragraph, and a short row of facts.
 */
export function Entry({
  name,
  blurb,
  detail,
  facts,
}: {
  name: string;
  blurb: string;
  detail: string;
  facts: [string, React.ReactNode][];
}) {
  return (
    <article className="border-t border-border-dim pt-6">
      <h2 className="font-display text-2xl font-bold text-text-hi">{name}</h2>
      <p className="mt-1 text-lg italic text-text-mid">{blurb}</p>
      <p className="prose-read mt-3 text-text-mid">{detail}</p>
      <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[11rem_1fr]">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="label-caps sm:py-0.5">{term}</dt>
            <dd className="mb-2 text-text-hi sm:mb-0 sm:py-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/** The three lists you are not reading, plus the way back into the game. */
export function MoreIdeas({ current }: { current: string }) {
  const others = CHARACTER_PAGES.filter((p) => p.path !== current);
  return (
    <footer className="flex flex-col gap-4 border-t border-border-dim pt-8">
      <h2 className="font-display text-2xl font-bold text-text-hi">The other lists</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {others.map((p) => (
          <li key={p.path}>
            <Link
              href={p.path}
              className="flex h-full flex-col gap-1 rounded-lg border border-border-dim bg-bg-1 p-4 transition-colors hover:border-accent/50 hover:bg-bg-2"
            >
              <span className="font-display font-bold text-text-hi">{p.heading}</span>
              <span className="text-sm text-text-mid">{p.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-text-mid">
        All of it is drafted and played in the game itself.{" "}
        <Link href="/how-it-works" className="text-accent underline">
          The rules are one page
        </Link>
        , or you can skip that and{" "}
        <Link href="/tables" className="text-accent underline">
          sit down at a table
        </Link>
        . If nobody is free,{" "}
        <Link href="/daily/muster" className="text-accent underline">
          Muster
        </Link>{" "}
        is the daily puzzle that is nothing but building one of these.
      </p>
    </footer>
  );
}
