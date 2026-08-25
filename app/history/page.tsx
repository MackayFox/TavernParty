import type { Metadata } from "next";
import Link from "next/link";
import { RunTable } from "@/components/RunTable";
import { Sheet, SheetBox } from "@/components/ui";
import { CALLINGS } from "@/lib/content/callings";
import { getIdentity } from "@/lib/identity";
import { getPlayerRecord, getRunHistory } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Your record",
  description: "Every run you have played, and what you walked out with.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const CALLING_NAME = new Map(CALLINGS.map((c) => [c.id, c.name]));

export default async function HistoryPage() {
  const identity = await getIdentity();

  if (identity?.kind !== "user") {
    return (
      <div className="mx-auto w-full max-w-xl py-8">
        {/*
          This said "nothing is kept past the run itself", which was not true.
          Two localStorage stores hold a guest's whole history: `lib/daily/local.ts`
          keeps the days played, the scores and the streak, and `lib/daily/hero.ts`
          keeps the runner, their nights and their scars. Telling somebody their
          record is not kept, on the page whose job is their record, is how they
          find out otherwise by losing it. So: what is kept, where it is, and what
          takes it away.
        */}
        <Sheet title="Kept in this browser" subtitle="Your record">
          <p className="text-paper-ink">
            You are playing as a guest, so the ledger has nothing for you. A night at a
            table is written down under the name you used and nothing else, so there is no
            thread from it back to you. That is the trade for not needing an account, and it is
            not going to change.
          </p>
          <p className="mt-3 text-paper-ink">
            Two things are kept anyway, and both of them are in this browser rather than on the
            server:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-paper-ink">
            <li>
              <strong>The dailies.</strong> Every day you have finished and the score it came
              to, and the streak that follows from it, which only counts a puzzle played on its
              own date. A half-finished puzzle is held as well, so a reload does not cost you
              one.
            </li>
            <li>
              <strong>Your runner.</strong> The name you gave them, the Blood they were dealt,
              what they did before this, their last sixty nights and their last forty scars.
              They are at the top of{" "}
              <Link href="/daily/deeprun" className="underline">
                the Deep Run
              </Link>
              .
            </li>
          </ul>
          <p className="mt-4 border-t border-paper-rule pt-3 text-paper-ink">
            Which is also all of what there is to lose. Clearing your site data takes it, so
            does closing a private window, and none of it follows you to another phone or
            another browser. Safari throws away what a site has stored once you have been away
            for a week. The runner keeps its last sixty nights and forty scars, so the oldest
            fall off the bottom as new ones arrive.
          </p>
          <p className="mt-3 text-paper-ink">
            <Link href="/signup" className="underline">
              A name in the book
            </Link>{" "}
            keeps your runs and your streaks on the server from the night you take it. It does
            not go back for any of the above.
          </p>
        </Sheet>
      </div>
    );
  }

  const [record, rows] = await Promise.all([
    getPlayerRecord(identity.id),
    getRunHistory(identity.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl py-8">
      <p className="label-caps">The ledger</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {identity.username ?? "Your record"}
      </h1>

      <Sheet className="mt-6" title="What you have to show for it" subtitle="Standing">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SheetBox label="Runs" value={record.runs} />
          <SheetBox label="Hoards" value={record.hoards} />
          <SheetBox label="Best night" value={record.bestTotal} />
          <SheetBox label="Scars kept" value={record.scarsKept} />
        </div>
        {record.favouriteCalling && (
          <p className="mt-4 border-t border-paper-rule pt-3 text-sm text-paper-ink">
            You keep reaching for the{" "}
            <strong>{CALLING_NAME.get(record.favouriteCalling) ?? record.favouriteCalling}</strong>:{" "}
            {record.favouriteCallingRuns} of {record.runs}{" "}
            {record.runs === 1 ? "run" : "runs"}.
          </p>
        )}
      </Sheet>

      <h2 className="mt-8 font-display text-2xl font-bold">Every run</h2>
      <div className="mt-3">
        <RunTable rows={rows} />
      </div>

      <p className="mt-6 text-sm text-text-mid">
        <Link href="/leaderboard" className="text-accent underline">
          See where that puts you
        </Link>
        .
      </p>
    </div>
  );
}
