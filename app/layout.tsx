import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--tp-font-display-next",
  display: "swap",
});
const body = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--tp-font-body-next",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--tp-font-mono-next",
  display: "swap",
});

/**
 * Site-wide metadata.
 *
 * `siteName` lives here so every card in every group chat carries the brand,
 * whether or not the page that produced it remembered to. Everything else in
 * `openGraph` is only a fallback: a page that does not declare its own title,
 * description and url inherits this one, and fourteen pages sharing the home
 * page's card is the state this was in. `tests/unit/seo-fix.test.ts` walks every
 * route and fails if a page is riding on these defaults, or if a resolved title
 * or description is outside the length a search result will actually show.
 *
 * The share image is `app/opengraph-image.tsx`, picked up by file convention.
 * Naming it here would pin every page to the same picture forever.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://tavernparty.co.uk"),
  title: {
    default: "Tavern Party: Roll a Character, Survive the Night",
    template: "%s · Tavern Party",
  },
  description:
    "A free fantasy roleplaying game in your browser. Roll a character, survive five encounters with friends, and one of you walks out with the loot.",
  openGraph: {
    title: "Tavern Party: Roll a Character, Survive the Night",
    description:
      "Build a character, survive five encounters, and only one of you gets the loot. Free in your browser.",
    siteName: "Tavern Party",
    url: "/",
    type: "website",
    locale: "en_GB",
  },
  // Without this X renders the small square card and ignores the 1200x630 one.
  // Everything else it needs it takes from the Open Graph tags above.
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#120E0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return (
    <html
      lang="en-GB"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      style={
        {
          "--tp-font-display": "var(--tp-font-display-next), Georgia, serif",
          "--tp-font-body": "var(--tp-font-body-next), Georgia, serif",
          "--tp-font-mono": "var(--tp-font-mono-next), ui-monospace, monospace",
        } as React.CSSProperties
      }
    >
      <body>
        {/* A plain script tag rather than next/script, so the literal src appears
            in the server-rendered HTML: Google's site-verification crawler does
            not execute JavaScript. Renders nothing until a client id is set. */}
        {adsense ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        {/* Renders nothing and sends nothing without a PostHog token, but it has
            to be mounted or the whole site is unmeasurable. It was written and
            never placed. */}
        <AnalyticsProvider />
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4">
          <Nav />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
