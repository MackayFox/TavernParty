import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://tavernparty.co.uk"),
  title: {
    default: "Tavern Party: Roll a Character, Survive the Night",
    template: "%s · Tavern Party",
  },
  description:
    "A free fantasy roleplaying game in your browser. Roll a character, take on five encounters with friends, and find out which of you walks out with the loot. Plus four daily puzzles. No downloads, no account needed.",
  openGraph: {
    title: "Tavern Party: Roll a Character, Survive the Night",
    description:
      "Build a character, survive five encounters, and only one of you gets the loot. Free in your browser.",
    type: "website",
    locale: "en_GB",
  },
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
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4">
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
