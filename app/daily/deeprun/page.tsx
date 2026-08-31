import type { Metadata } from "next";
import Link from "next/link";
import { chosenDungeon } from "@/lib/campaign/store";
import { DeepRunGame } from "./DeepRunGame";

export const metadata: Metadata = {
  title: "The Deep Run: A Daily Blind Dungeon Crawl",
  description:
    "Build a character on tonight's six numbers, take them down six floors, and find out what is in each room only once you have opened it. Same dungeon for everybody.",
  alternates: { canonical: "/daily/deeprun" },
  openGraph: {
    title: "The Deep Run: Today's Blind Dungeon Crawl",
    description:
      "Every room owns its die, and you only see the number once you are in the room. One run a day, and you will not all come back.",
    url: "/daily/deeprun",
  },
};

export default async function DeepRunPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  /**
   * The chosen dungeon, as a LINK beside tonight's puzzle.
   *
   * Not a rotation, and this page is where that decision is visible: the daily is
   * still `puzzleFor(date)` with no I/O in it, and this is one row read by a page
   * that was already server-rendered. If this ever became "the daily IS the
   * chosen dungeon", every finish would pay for a query on the way to an answer
   * that used to be arithmetic.
   */
  /**
   * AND IT MUST NEVER TAKE THE PUZZLE DOWN WITH IT.
   *
   * The reads in `lib/campaign/store.ts` were changed to throw rather than
   * return an empty result, because a database that was refusing to answer had
   * been rendering as "Nothing here yet" in the site's own voice. That is right
   * for the Hall, where the list IS the page. It is wrong here, where this is a
   * decoration beside a puzzle that needs no database at all: the throw escaped
   * the server render and 500'd the whole of The Deep Run during an outage, so a
   * fix for a silent failure took a working daily off the air.
   *
   * `catch` and carry on. The aside below is already conditional, the puzzle is
   * arithmetic, and one of four dailies going dark because an unrelated table
   * would not answer is a far worse bargain than a missing link.
   */
  const chosen = await chosenDungeon().catch((err: unknown) => {
    console.warn("[deeprun] chosen dungeon unavailable, carrying on", err);
    return null;
  });
  return (
    <>
      <DeepRunGame date={(Array.isArray(date) ? date[0] : date) ?? null} />
      {chosen && (
        <aside className="mx-auto mt-8 w-full max-w-2xl rounded-lg border border-border-dim bg-bg-1 p-4">
          <p className="label-caps">
            <span aria-hidden>&#9733; </span>
            Chosen
          </p>
          <p className="mt-1 text-text-hi">
            <Link href={`/d/${chosen.code}`} className="text-accent underline">
              {chosen.title}
            </Link>{" "}
            by {chosen.authorName}
            {chosen.difficulty ? `. ${chosen.difficulty}.` : "."} Somebody wrote it, somebody read
            it, and it is worth an evening.
          </p>
          <p className="mt-1 text-sm text-text-mid">
            It does not replace tonight&rsquo;s, and it will still be there tomorrow.{" "}
            <Link href="/dungeons" className="underline">
              The rest of the Hall
            </Link>{" "}
            is this way.
          </p>
        </aside>
      )}
    </>
  );
}
