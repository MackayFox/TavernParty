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
        <Sheet title="Nothing written down" subtitle="Your record">
          <p className="text-paper-ink">
            You are playing as a guest, so nothing is kept past the run itself. That is by design and
            it is not going to change: the whole site works without an account.
          </p>
          <p className="mt-3 text-paper-ink">
            If you want a record that follows you between devices,{" "}
            <Link href="/signup" className="underline">
              get a name in the book
            </Link>
            .
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
