/**
 * The one hostname this site calls itself.
 *
 * It was written out by hand in fourteen files: every canonical tag, the
 * sitemap, robots.txt, the Open Graph urls, the share line at the bottom of all
 * four dailies, and the network cross-links. Changing it meant finding all
 * fourteen, and the night the domain turned out to be `.com` rather than
 * `.co.uk` three of them were regex-escaped and quietly survived the rename.
 *
 * So it is one constant, and everything else asks.
 *
 * WHICH HOST IS CANONICAL IS A DEPLOYMENT DECISION, NOT A CODE ONE. Vercel's
 * Project -> Domains screen decides which of the apex and www answers 200 and
 * which 308s to it. This constant only has to agree with that screen. Point them
 * at different hosts and you get the failure this constant was extracted during:
 * the app redirected www to the apex while Vercel redirected the apex to www, so
 * the domain served an infinite loop on every path while the vercel.app URL
 * looked perfect. `tests/unit/seo-fix.test.ts` pins agreement between this value
 * and everything derived from it; nothing can pin it to the dashboard, so if you
 * change one, change the other in the same breath.
 */
export const CANONICAL_ORIGIN = "https://www.tavernparty.com";

/** The bare hostname, for prose and for the share cards. No scheme. */
export const CANONICAL_HOST = CANONICAL_ORIGIN.replace(/^https?:\/\//, "");

/**
 * An absolute url on this site.
 *
 * Takes a root-relative path and returns it absolute. Share text has to be
 * absolute or a group chat renders it as plain text and nobody follows it, which
 * is the whole point of a share card.
 */
export const siteUrl = (path = "/") =>
  `${CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
