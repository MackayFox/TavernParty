import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunTable } from "@/components/RunTable";
import { Sheet, SheetBox } from "@/components/ui";
import { CALLINGS } from "@/lib/content/callings";
import { getPlayerRecord, getRunHistory, getUserByUsername } from "@/lib/stats";

const CALLING_NAME = new Map(CALLINGS.map((c) => [c.id, c.name]));

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return { title: "No such name", robots: { index: false, follow: false } };
  return {
    title: `${user.username} at the table`,
    description: `Runs, Hoards and Scars for ${user.username} on Tavern Party.`,
    alternates: { canonical: `/player/${user.username}` },
  };
}

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: Props) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const [record, rows] = await Promise.all([getPlayerRecord(user.id), getRunHistory(user.id)]);

  return (
    <div className="mx-auto w-full max-w-4xl py-8">
      <p className="label-caps">The ledger</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {user.username}
      </h1>

      <Sheet className="mt-6" title="Standing" subtitle={`${user.username} at the table`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SheetBox label="Runs" value={record.runs} />
          <SheetBox label="Hoards" value={record.hoards} />
          <SheetBox label="Best night" value={record.bestTotal} />
          <SheetBox label="Scars kept" value={record.scarsKept} />
        </div>
        {record.favouriteCalling && (
          <p className="mt-4 border-t border-paper-rule pt-3 text-sm text-paper-ink">
            Usually the{" "}
            <strong>{CALLING_NAME.get(record.favouriteCalling) ?? record.favouriteCalling}</strong>.
          </p>
        )}
      </Sheet>

      <h2 className="mt-8 font-display text-2xl font-bold">Recent runs</h2>
      <div className="mt-3">
        <RunTable rows={rows} />
      </div>
    </div>
  );
}
