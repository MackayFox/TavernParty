import type { Metadata } from "next";
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
  return <DeepRunGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
