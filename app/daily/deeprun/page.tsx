import type { Metadata } from "next";
import { DeepRunGame } from "./DeepRunGame";

export const metadata: Metadata = {
  title: "THE DEEP RUN: A Daily Dungeon Crawl You Play Blind",
  description:
    "Build a character on tonight's six numbers, take them down six floors, and find out what is in each room when you open it. The same dungeon and the same dice for everybody in the world, but you only see a room's number once you are in it. One run a day, par worked out exactly. Free, no account, nothing to download.",
  alternates: { canonical: "/daily/deeprun" },
};

export default async function DeepRunPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <DeepRunGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
