import { CANONICAL_ORIGIN } from "../site";
/**
 * The network. A handful of small browser games that link to each other.
 *
 * Adding a site is one row here, in every repo in the network. That duplication
 * is deliberate: a few rows in a few places is cheaper than a shared package, a
 * build step and a release process to keep them in sync.
 *
 * Keep the descriptions honest and in the site's own words where it has them. A
 * row of near-identical keyword-stuffed blurbs pointing at each other is the
 * shape of a link scheme, and it reads like one to a person too.
 */
export type NetworkSite = {
  id: string;
  name: string;
  url: string;
  /** One line. What it actually is. */
  tagline: string;
  emoji: string;
};

/** Which row is us, so this site can leave itself out of its own list. */
export const THIS_SITE = "tavernparty";

export const NETWORK: NetworkSite[] = [
  {
    id: "auxwars",
    name: "Aux Wars",
    url: "https://auxwars.co.uk",
    tagline: "Daily music puzzles, and multiplayer rows about who has the best taste.",
    emoji: "🎧",
  },
  {
    id: "shareholderparty",
    name: "Shareholder Party",
    url: "https://shareholderparty.co.uk",
    tagline: "An office board game and four daily puzzles. Praise the shareholders.",
    emoji: "📈",
  },
  {
    id: "tavernparty",
    name: "Tavern Party",
    url: CANONICAL_ORIGIN,
    tagline: "Roll a character, survive five encounters, and only one of you gets the loot.",
    emoji: "🍺",
  },
  {
    id: "puzzleparty",
    name: "Puzzle Party",
    url: "https://www.puzzleparty.co.uk",
    tagline: "Daily puzzles, and a tournament two to twelve friends can join from one link.",
    emoji: "🧩",
  },
  {
    id: "carball",
    name: "Car Football",
    url: "https://carball.co.uk",
    tagline: "Four letters. Six cars. One ball.",
    emoji: "⚽",
  },
  {
    id: "kartparty",
    name: "Kart Party",
    url: "https://kartparty.co.uk",
    tagline: "Kart racing in a browser tab.",
    emoji: "🏎️",
  },
];

/** Everyone except us, in listed order. */
export const OTHER_SITES = NETWORK.filter((s) => s.id !== THIS_SITE);
