import type { Metadata } from "next";
import { Hall } from "./Hall";

export const metadata: Metadata = {
  title: "The Hall: Dungeons People Wrote",
  description:
    "Player-made dungeon crawls, every one of them checked by the same solver that sets the daily's par. Ranked by what the people who finished them thought, not by how many played.",
  alternates: { canonical: "/dungeons" },
  openGraph: {
    title: "The Hall: dungeons people wrote",
    description:
      "Player-made dungeon crawls, measured rather than claimed. Ranked by what the people who finished them thought.",
    url: "/dungeons",
  },
};

export default function DungeonsPage() {
  return <Hall />;
}
