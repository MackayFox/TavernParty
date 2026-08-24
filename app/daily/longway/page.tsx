import type { Metadata } from "next";
import { LongwayGame } from "./LongwayGame";

export const metadata: Metadata = {
  title: "THE LONG WAY DOWN: Daily Solo Adventure Puzzle",
  description:
    "Five scenes, three ways through each, and five dice you can see before you throw them. One character, already made, and a par worked out by brute force. A new night every day, the same night for everybody. Free, no account.",
  alternates: { canonical: "/daily/longway" },
};

export default async function LongwayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <LongwayGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
