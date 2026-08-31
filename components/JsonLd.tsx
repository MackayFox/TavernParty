import { siteUrl } from "@/lib/site";

/**
 * Structured data. Content is always developer-authored, but `<` is still
 * escaped so a future dynamic value can never close the script tag and turn
 * metadata into an injection point.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/**
 * WHO PUBLISHES THIS, in the one format a machine reads.
 *
 * There was an FAQPage on the search lander and nothing anywhere saying who the
 * site belongs to, which is a gap both Google and an AdSense reviewer look for.
 * `Organization` and `WebSite` are the two nodes that answer it, and they are a
 * `@graph` rather than two script tags so the site node can point at the
 * publisher node by id instead of restating it.
 *
 * There is deliberately NO `SearchAction`. There is no site search here, and
 * marking up a search box that does not exist is the kind of structured data
 * that gets a manual action rather than a rich result.
 *
 * The address carries a country and nothing else, because a country is the only
 * part of it that is true and checkable. Never put a street on this.
 */
export const SITE_ORG_ID = siteUrl("/#publisher");

export const SITE_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_ORG_ID,
      name: "Tavern Party",
      url: siteUrl("/"),
      description:
        "A free fantasy roleplaying game played in a browser, and four daily puzzles built on the same rules.",
      founder: { "@type": "Person", name: "Adam Mackay" },
      address: { "@type": "PostalAddress", addressCountry: "GB" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: siteUrl("/contact"),
        availableLanguage: "en-GB",
      },
    },
    {
      "@type": "WebSite",
      "@id": siteUrl("/#website"),
      name: "Tavern Party",
      url: siteUrl("/"),
      inLanguage: "en-GB",
      publisher: { "@id": SITE_ORG_ID },
    },
  ],
};

/** The publisher identity. Mounted on the pages that carry the writing. */
export function SiteJsonLd() {
  return <JsonLd data={SITE_GRAPH} />;
}
