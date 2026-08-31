/**
 * Every indexable page, audited the way a search result and a group chat see it.
 *
 * These are the failures that never show up in a build, a smoke test or a
 * screenshot: a page silently inheriting the home page's share card, a title
 * that resolves to seventy three characters once the brand suffix is applied, a
 * description Google cuts in half, a followable link to a path robots.txt has
 * already refused. The other two sites in this network sat at zero indexed pages
 * for a while, so these checks live here rather than in somebody's memory.
 *
 * Nothing is transcribed. Every page module is imported and its real exported
 * `metadata` is read, and the sitemap is checked against the same list, so
 * adding a page without giving it a card fails here.
 */
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

// next/font reaches out at import time and has no business in a unit test. The
// root layout is imported for its metadata, not for its typefaces.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "mock", className: "mock" });
  return { Cinzel: font, EB_Garamond: font, IBM_Plex_Mono: font };
});

import { CHARACTER_PAGES } from "@/app/characters/shared";
import { DISALLOWED, isDisallowed } from "@/app/crawl";
import sitemap from "@/app/sitemap";

const BASE = "https://tavernparty.com";

/**
 * Route path to page module. Written out rather than globbed, because a glob
 * would quietly skip a page whose file had moved and call that a pass.
 */
const PAGE_MODULES: Record<string, () => Promise<{ metadata?: Metadata }>> = {
  "/": () => import("@/app/page"),
  "/tables": () => import("@/app/tables/page"),
  "/daily": () => import("@/app/daily/page"),
  "/daily/longway": () => import("@/app/daily/longway/page"),
  "/daily/deeprun": () => import("@/app/daily/deeprun/page"),
  "/daily/ledger": () => import("@/app/daily/ledger/page"),
  "/daily/muster": () => import("@/app/daily/muster/page"),
  "/daily/archive": () => import("@/app/daily/archive/page"),
  "/how-it-works": () => import("@/app/how-it-works/page"),
  "/characters": () => import("@/app/characters/page"),
  "/characters/classes": () => import("@/app/characters/classes/page"),
  "/characters/origins": () => import("@/app/characters/origins/page"),
  "/characters/gear": () => import("@/app/characters/gear/page"),
  "/characters/backstories": () => import("@/app/characters/backstories/page"),
  "/online-roleplaying-games": () => import("@/app/online-roleplaying-games/page"),
  "/leaderboard": () => import("@/app/leaderboard/page"),
  "/about": () => import("@/app/about/page"),
  "/contact": () => import("@/app/contact/page"),
  "/privacy": () => import("@/app/privacy/page"),
  "/terms": () => import("@/app/terms/page"),
};

const ROUTES = Object.keys(PAGE_MODULES);

const loaded = await Promise.all(
  ROUTES.map(async (route) => [route, (await PAGE_MODULES[route]()).metadata] as const)
);
const META = new Map<string, Metadata | undefined>(loaded);
const metaFor = (route: string): Metadata => {
  const meta = META.get(route);
  if (!meta) throw new Error(`${route} exports no metadata at all`);
  return meta;
};

/**
 * What the browser tab actually says. A page's string title is run through the
 * root layout's template, so "How It Works" is really "How It Works · Tavern
 * Party", and only `{ absolute }` escapes that. Auditing the raw string instead
 * of this is how the home page ended up carrying the brand twice.
 */
const SUFFIX = " · Tavern Party";
function resolvedTitle(title: Metadata["title"]): string {
  if (typeof title === "string") return `${title}${SUFFIX}`;
  if (title && typeof title === "object" && "absolute" in title) return String(title.absolute);
  throw new Error("no usable title");
}

/** Beyond this a search result truncates, and the end of the title is wasted. */
const TITLE_MAX = 65;
/** Below this a title is a label rather than something anybody searched for. */
const TITLE_MIN = 35;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 170;
/** An Open Graph description is read in a chat window, not a search result. */
const OG_MIN = 60;
const OG_MAX = 145;

describe("every page carries its own metadata", () => {
  it.each(ROUTES)("%s declares a title and a description", (route) => {
    const meta = metaFor(route);
    expect(meta.title, `${route} has no title`).toBeDefined();
    expect(typeof meta.description, `${route} has no description`).toBe("string");
  });

  it.each(ROUTES)("%s resolves to a title a search result will show whole", (route) => {
    const title = resolvedTitle(metaFor(route).title);
    const where = `${route}: "${title}" is ${title.length} characters`;
    expect(title.length, where).toBeGreaterThanOrEqual(TITLE_MIN);
    expect(title.length, where).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(ROUTES)("%s has a description of a length Google will show whole", (route) => {
    const d = metaFor(route).description as string;
    const where = `${route}: description is ${d.length} characters`;
    expect(d.length, where).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    expect(d.length, where).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it.each(ROUTES)("%s declares its own canonical", (route) => {
    expect(metaFor(route).alternates?.canonical, `${route} has no canonical`).toBe(route);
  });

  it("gives every page a distinct title", () => {
    const titles = ROUTES.map((r) => resolvedTitle(metaFor(r).title));
    expect(new Set(titles).size, "two pages share a title").toBe(titles.length);
  });
});

describe("every page carries its own share card", () => {
  /**
   * The blocker this file was written for. Fourteen pages inherited the home
   * page's card, the four dailies among them, and those are exactly the pages
   * the share loop pastes into a group chat.
   */
  it.each(ROUTES)("%s sets its own openGraph title, description and url", (route) => {
    const og = metaFor(route).openGraph;
    expect(og, `${route} inherits the home page's card`).toBeDefined();
    expect(typeof og!.title, `${route} has no openGraph title`).toBe("string");
    expect(typeof og!.description, `${route} has no openGraph description`).toBe("string");
    expect(og!.url, `${route} has no openGraph url`).toBe(route);
  });

  it.each(ROUTES)("%s has an openGraph description sized for a chat window", (route) => {
    const d = metaFor(route).openGraph!.description as string;
    const where = `${route}: openGraph description is ${d.length} characters`;
    expect(d.length, where).toBeGreaterThanOrEqual(OG_MIN);
    expect(d.length, where).toBeLessThanOrEqual(OG_MAX);
  });

  it("gives every card a distinct title", () => {
    const titles = ROUTES.map((r) => metaFor(r).openGraph!.title);
    expect(new Set(titles).size, "two pages share a card title").toBe(titles.length);
  });

  it("names the brand once, site-wide, so every card carries it", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.openGraph?.siteName).toBe("Tavern Party");
    // Without this, X ignores the 1200x630 image and renders the small card.
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

describe("no metadata copy uses an em-dash", () => {
  it.each(ROUTES)("%s", (route) => {
    const meta = metaFor(route);
    const copy = [
      resolvedTitle(meta.title),
      meta.description,
      meta.openGraph?.title,
      meta.openGraph?.description,
    ].join(" ");
    expect(copy).not.toContain("—");
  });
});

describe("the sitemap and the pages agree", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists every page that has metadata", () => {
    for (const route of ROUTES) {
      const url = route === "/" ? `${BASE}/` : `${BASE}${route}`;
      expect(urls, `${route} is missing from the sitemap`).toContain(url);
    }
  });

  it("lists the four idea lists and their hub", () => {
    expect(urls).toContain(`${BASE}/characters`);
    for (const page of CHARACTER_PAGES) expect(urls).toContain(`${BASE}${page.path}`);
  });

  it("never lists a path robots.txt refuses", () => {
    for (const url of urls) {
      expect(isDisallowed(url.slice(BASE.length)), `${url} is disallowed`).toBe(false);
    }
  });
});

describe("robots.txt and the links on the page agree", () => {
  /**
   * The lobby printed a followable link to /room/CODE, which robots.txt refuses
   * and which will not exist by the time a crawler asks. Half the disallow list
   * is a directory ("/room/") and half is an exact page ("/login"), and getting
   * that distinction wrong fails silently in the direction of doing nothing.
   */
  it("catches a live table url", () => {
    expect(isDisallowed("/room/ABC234")).toBe(true);
  });

  it("catches every path it lists, exactly", () => {
    for (const path of DISALLOWED) expect(isDisallowed(path), path).toBe(true);
  });

  it("leaves the pages we want indexed alone", () => {
    for (const route of ROUTES) expect(isDisallowed(route), route).toBe(false);
    // Near misses, because a prefix match is easy to write too loosely.
    expect(isDisallowed("/loginary")).toBe(false);
    expect(isDisallowed("/rooms")).toBe(false);
  });
});

describe("analytics is mounted, and silent without a token", () => {
  /**
   * PostHog was written, wired and never placed in the tree, so nothing on the
   * site was measurable. There is no runtime signal for "a component is in the
   * layout" without rendering the whole document, so this reads the file. Crude,
   * but it fails the moment somebody deletes the line, which is the job.
   */
  it("is mounted in the root layout", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(layout).toContain("<AnalyticsProvider />");
    expect(layout).toContain('from "@/components/AnalyticsProvider"');
  });

  it("counts a route change, not just a document load", async () => {
    // On the App Router every navigation after the first is a history push. With
    // `capture_pageview: true` the dailies, the tables and the rooms would all
    // read as unvisited.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const provider = readFileSync(
      join(process.cwd(), "components", "AnalyticsProvider.tsx"),
      "utf8"
    );
    expect(provider).toContain('capture_pageview: "history_change"');
  });

  it("sends nothing and renders nothing when the token is absent", async () => {
    expect(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN).toBeUndefined();
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { AnalyticsProvider, track } = await import("@/components/AnalyticsProvider");
    expect(renderToStaticMarkup(createElement(AnalyticsProvider))).toBe("");
    expect(() => track("run_started", { players: 3 })).not.toThrow();
  });
});

describe("the idea lists publish the writing that had no page", () => {
  /**
   * CALLING_DETAIL, BLOOD_DETAIL, KIT_DETAIL and HOOK_DETAIL are roughly four
   * thousand words that shipped in lib/content/ and were rendered by nothing at
   * all. One page each, and each one targets a different question.
   */
  it("has a page for each of the four datasets", () => {
    expect(CHARACTER_PAGES.map((p) => p.path)).toEqual([
      "/characters/classes",
      "/characters/origins",
      "/characters/gear",
      "/characters/backstories",
    ]);
  });

  it.each(CHARACTER_PAGES)("$path says what it is, in words worth linking", (page) => {
    expect(page.heading.length).toBeGreaterThan(10);
    expect(page.blurb.length).toBeGreaterThan(60);
  });
});
