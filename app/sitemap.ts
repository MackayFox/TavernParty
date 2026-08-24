import type { MetadataRoute } from "next";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";

const BASE = "https://tavernparty.co.uk";

/**
 * Every public page, and nothing else. A sitemap is a list of pages you want in
 * the index, so the auth forms and the live tables are deliberately absent: a
 * form has no content to index, and a room is gone by the time a crawler asks.
 *
 * Adding a page means adding a row here. There is no crawl of the app directory,
 * because a generated list is exactly how /login ends up in it again.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const dailies: MetadataRoute.Sitemap = DAILY_GAMES.map((g) => ({
    url: `${BASE}${DAILY_META[g].path}`,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/tables`, changeFrequency: "always", priority: 0.9 },
    { url: `${BASE}/daily`, changeFrequency: "daily", priority: 0.9 },
    ...dailies,
    { url: `${BASE}/daily/archive`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/online-roleplaying-games`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/leaderboard`, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
