import type { Metadata } from "next";
import { LedgerGame } from "./LedgerGame";

export const metadata: Metadata = {
  title: "The Ledger: Daily Logic Grid Puzzle, Free",
  description:
    "Five drinkers, five debts and four statements that are all true. Work out who owes what. One grid a day, exactly one solution, and no dice anywhere in it.",
  alternates: { canonical: "/daily/ledger" },
  openGraph: {
    title: "The Ledger: Today's Logic Grid Puzzle",
    description:
      "Four true statements and one solution. Three checks are allowed and each of them costs you a mark. New grid every midnight.",
    url: "/daily/ledger",
  },
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <LedgerGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
