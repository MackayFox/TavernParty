import type { Metadata } from "next";
import { WriteIndex } from "./WriteIndex";

export const metadata: Metadata = {
  title: "Write a Dungeon: Build One People Can Play",
  description:
    "Build a small dungeon crawl, and a solver tells you the truth about it before you publish: whether anybody gets out, what par is, and which door nobody would ever take.",
  alternates: { canonical: "/write" },
  openGraph: {
    title: "Write a Dungeon Other People Can Play",
    description:
      "Pick some floors, set what they may bring, and a solver tells you whether it is a dungeon or a lock before anybody else sees it.",
    url: "/write",
  },
};

export default function Page() {
  return <WriteIndex />;
}
