import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard } from "@/lib/stats";

export const metadata: Metadata = {
  title: "The board of Hoards",
  description:
    "Who has walked out with the Hoard most often on Tavern Party. Ranked by wins, not by hours played.",
  alternates: { canonical: "/leaderboard" },
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
        <p className="mt-6 rounded-lg border border-border-dim bg-bg-1 p-4 text-text-mid">
          Nobody with an account has finished a run yet. Guests are not listed here, which is the
          trade for not needing one.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border-dim">
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
