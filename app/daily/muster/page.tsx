import type { Metadata } from "next";
import { MusterGame } from "./MusterGame";

export const metadata: Metadata = {
  title: "Muster: Daily Character Creation Puzzle",
  description:
    "Six numbers rolled once for the whole world, one Calling, one piece of Kit, and five doors with the dice already thrown. Build the character that clears the most.",
  alternates: { canonical: "/daily/muster" },
  openGraph: {
    title: "Muster: Today's Character Creation Puzzle",
    description:
      "Character creation as the whole game. Place tonight's six numbers, pick a Calling and one piece of Kit, then face the night.",
    url: "/daily/muster",
  },
};

export default async function MusterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  return <MusterGame date={(Array.isArray(date) ? date[0] : date) ?? null} />;
}
