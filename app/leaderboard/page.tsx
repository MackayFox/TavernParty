import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Leaderboard: Who Has Taken the Most Hoards",
  description:
    "Who has walked out with the Hoard most often on Tavern Party, ranked by wins rather than by hours played. Turning up is deliberately worth nothing here.",
  alternates: { canonical: "/leaderboard" },
  /**
   * OUT OF THE INDEX UNTIL THERE IS SOMETHING ON IT.
   *
   * It renders "Nobody with an account has finished a run yet" and, unlike the
   * Hall, there is no editorial layer that would honestly belong on it: it is a
   * scoreboard, and a scoreboard with nobody on it is thin content by
   * definition. An empty page in the index on a brand new site is one of the
   * things an AdSense reviewer reads as "under construction".
   *
   * `follow` so the links off it still carry weight. Take this out, and put the
   * page back in app/sitemap.ts, the day there are names on it.
   */
  robots: { index: false, follow: true },
  openGraph: {
    title: "Leaderboard: Who Has Taken the Most Hoards",
    description:
      "Ranked by Hoards taken, then by best single night. Not by Renown piled up over time, because that would only reward turning up.",
    url: "/leaderboard",
  },
};

export const revalidate = 300;

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();

  return (
    <div className="mx-auto w-full max-w-3xl py-8">
      <p className="label-caps">The ledger</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        The board of Hoards
      </h1>
      <p className="mt-3 text-text-mid">
        Ranked by Hoards taken, then by best single night. Deliberately not by Renown piled up over
        time: that would reward turning up, and turning up is not the game.
      </p>

      {rows.length === 0 ? (
        /* An empty state with nothing to press is a dead end, and this one is the
           easiest board on the site to get onto, so it says where to go. Both
           halves are needed: a guest can finish a run all night and the board
           will still be empty, because a guest run is written down under a name
           with nothing attached to it. */
        <div className="mt-6 rounded-lg border border-border-dim bg-bg-1 p-4">
          <p className="text-text-mid">
            Nobody with an account has finished a run yet. Guests are not listed here, which is
            the trade for not needing one.
          </p>
          <p className="mt-3 text-text-mid">
            It is a short queue to join.{" "}
            <Link href="/tables" className="text-accent underline">
              Find a table
            </Link>{" "}
            and see the night through, with{" "}
            <Link href="/signup" className="text-accent underline">
              a name in the book
            </Link>
            , and yours is the only line on it.
          </p>
        </div>
      ) : (
        <div
          className="mt-6 overflow-x-auto rounded-lg border border-border-dim"
          role="region"
          aria-label="The board of Hoards, scrollable sideways"
          /* Focusable on purpose. The table is wider than a phone, and without
             this a keyboard user can tab the names and never reach the figures
             to the right of them: nothing else in the region scrolls it. */
          tabIndex={0}
        >
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <caption className="sr-only">Players ranked by Hoards taken</caption>
            <thead>
              <tr className="bg-bg-1 text-left">
                <th scope="col" className="px-3 py-2 font-normal label-caps">#</th>
                <th scope="col" className="px-3 py-2 font-normal label-caps">Name</th>
                <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Hoards</th>
                <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Runs</th>
                <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Best night</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.username} className="border-t border-border-dim">
                  <td className="px-3 py-2 num text-text-low">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/player/${r.username}`} className="text-accent underline">
                      {r.username}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right num text-text-hi">{r.hoards}</td>
                  <td className="px-3 py-2 text-right num text-text-mid">{r.runs}</td>
                  <td className="px-3 py-2 text-right num text-text-mid">{r.bestTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
