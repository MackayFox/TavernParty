import type { Metadata } from "next";
import { MusterGame } from "./MusterGame";

export const metadata: Metadata = {
  title: "MUSTER: Daily Character Building Puzzle",
  description:
    "Six numbers rolled once for the whole world, one Calling, one piece of kit, and five doors with the dice already thrown. Build the character that clears the most of them. One encounter a day, with par worked out by brute force. Free, no account.",
  alternates: { canonical: "/daily/muster" },
};

export default async function MusterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <MusterGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
