import type { Metadata } from "next";
import { LongwayGame } from "./LongwayGame";

/**
 * Title-cased rather than shouted. The daily is called THE LONG WAY DOWN on the
 * page and in the share line, but an all-capitals <title> is the sort of thing
 * Google rewrites for you, and a rewritten title is one you no longer control.
 */
export const metadata: Metadata = {
  title: "The Long Way Down: Daily Solo Adventure Puzzle",
  description:
    "Five scenes, three ways through each, and five dice you can see before you throw them. One character, already made, and a par worked out by brute force.",
  alternates: { canonical: "/daily/longway" },
  openGraph: {
    title: "The Long Way Down: Today's Adventure Puzzle",
    description:
      "You know every roll before you make it. Choose which door each one goes through. The same night for everybody in the world.",
    url: "/daily/longway",
  },
};

export default async function LongwayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <LongwayGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
