import Link from "next/link";
import { CHARACTER_PAGES } from "@/app/characters/shared";
import { isDisallowed } from "@/app/crawl";
import { OTHER_SITES } from "@/lib/content/network";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";

/**
 * One row per link. The network column is the same list the Network section on
 * the home page renders, which is the pattern the other two sites in the network
 * use: a section on the way out, plus a footer column, and never a banner.
 */
const COLUMNS: [string, [string, string][]][] = [
  [
    "Play",
    [
      ["Quick match", "/"],
      ["Open tables", "/tables"],
      ["All four dailies", "/daily"],
      ["The Hall", "/dungeons"],
      ["Write a dungeon", "/write"],
      ...DAILY_GAMES.map((g) => [DAILY_META[g].name, DAILY_META[g].path] as [string, string]),
      ["Past days", "/daily/archive"],
    ],
  ],
  [
    "Characters",
    [
      ["How to build one", "/characters"],
      ...CHARACTER_PAGES.map((p) => [p.label, p.path] as [string, string]),
    ],
  ],
  [
    "The house",
    [
      ["How to play", "/how-it-works"],
      ["Online roleplaying games", "/online-roleplaying-games"],
      ["Leaderboard", "/leaderboard"],
      // An optional account that nothing links to is an account nobody has. The
      // footer is the right place for it: never a nag, always findable.
      ["Your record", "/history"],
      ["Log in", "/login"],
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Privacy and cookies", "/privacy"],
      ["Terms of use", "/terms"],
    ],
  ],
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border-dim py-10 text-sm">
      {/* Two columns until there is room for four. Three would leave the network
          column orphaned on its own row at every width. */}
      <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
        {COLUMNS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="label-caps mb-3">{title}</p>
            {/* Every row is 44px tall: a footer is exactly where a thumb misses. */}
            <ul className="flex flex-col">
              {links.map(([label, href]) => (
                <li key={`${title}-${href}`}>
                  <Link
                    href={href}
                    // "Log in" and "Your record" are both in robots.txt. A
                    // followable link to a path we have refused to serve a
                    // crawler is a warning in Search Console and a waste of the
                    // crawl budget the real pages want.
                    rel={isDisallowed(href) ? "nofollow" : undefined}
                    className="flex min-h-11 items-center text-text-mid hover:text-text-hi"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        {/* External, so plain anchors rather than next/link. */}
        <nav aria-label="Other games">
          <p className="label-caps mb-3">Other games</p>
          <ul className="flex flex-col">
            {OTHER_SITES.map((site) => (
              <li key={site.id}>
                <a
                  href={site.url}
                  rel="noopener"
                  className="flex min-h-11 items-center gap-2 text-text-mid hover:text-text-hi"
                >
                  <span aria-hidden>{site.emoji}</span>
                  {site.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mt-8 flex flex-col gap-2 border-t border-border-dim pt-6 text-xs text-text-low">
        <p>
          Every Calling, Blood, Hook, scene and line of writing here is ours. Tavern Party is not
          affiliated with, endorsed by or based on any published tabletop roleplaying game, and it
          contains none of anybody else&apos;s text.
        </p>
        <p>© {new Date().getFullYear()} Tavern Party · tavernparty.co.uk</p>
      </div>
    </footer>
  );
}
