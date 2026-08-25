import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDungeon } from "@/lib/campaign/store";
import { doorFor } from "@/lib/campaign/puzzle";
import { Door } from "./Door";

type Props = { params: Promise<{ code: string }> };

/**
 * The URL that goes in the group chat, so the card matters more here than
 * anywhere else on the site.
 *
 * The description is built from what the solver worked out rather than from
 * anything the author typed, which means it is true and it is interesting:
 * "Stiff. Nine of thirty-six get out." is a better hook than a title.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const row = await getDungeon(code);
  if (!row || !row.publishedAt || row.visibility === "banned") {
    return { title: "No dungeon by that name", robots: { index: false, follow: false } };
  }
  const stat =
    row.difficulty && row.par
      ? `${row.difficulty}. Par is ${row.par} over ${row.rooms.length} floors.`
      : `${row.rooms.length} floors.`;
  const description = `${row.intro || `A dungeon by ${row.authorName}.`} ${stat}`.slice(0, 160);
  return {
    title: `${row.title}: A Dungeon by ${row.authorName}`,
    description,
    // Unlisted by default, so it is reachable by link and not by search. A
    // person decides what goes in the Hall, and the Hall is what gets indexed.
    robots: row.visibility === "listed" ? undefined : { index: false, follow: true },
    alternates: row.visibility === "listed" ? { canonical: `/d/${row.code}` } : undefined,
    openGraph: {
      title: `${row.title}, by ${row.authorName}`,
      description,
      url: `/d/${row.code}`,
    },
  };
}

export default async function DoorPage({ params }: Props) {
  const { code } = await params;
  const row = await getDungeon(code);
  if (!row || row.visibility === "banned") notFound();
  // A draft is visible to nobody but its author, and the desk is where they see
  // it. Anybody else gets the same answer as a code that never existed.
  if (!row.publishedAt) notFound();
  return <Door door={doorFor(row)} />;
}
