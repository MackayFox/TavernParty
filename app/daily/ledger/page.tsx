import type { Metadata } from "next";
import { LedgerGame } from "./LedgerGame";

export const metadata: Metadata = {
  title: "THE LEDGER: Daily Logic Grid Puzzle",
  description:
    "Five drinkers, five debts and four statements that are all true. Work out who owes what. One grid a day, exactly one solution, and three checks that each cost you a mark. Free, no account.",
  alternates: { canonical: "/daily/ledger" },
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <LedgerGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
