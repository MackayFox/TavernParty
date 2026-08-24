import type { Metadata } from "next";
import { TableOfSixGame } from "./TableOfSixGame";

export const metadata: Metadata = {
  title: "TABLE OF SIX: Daily Dice Assignment Puzzle",
  description:
    "Six twenty-sided dice, thrown once for the whole world, and six obstacles with target numbers. Give each obstacle exactly one roll. One puzzle a day, with the best possible score worked out by brute force. Free, no account.",
  alternates: { canonical: "/daily/tableofsix" },
};

/**
 * Server shell: it owns the metadata and hands `?date=` down, which keeps the
 * game off `useSearchParams` and out of a Suspense boundary for one string.
 */
export default async function TableOfSixPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <TableOfSixGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
