/**
 * What crawlers are told not to fetch, in one place.
 *
 * It lives beside `robots.ts` rather than inside it because anything that LINKS
 * to one of these paths also has to mark the link `rel="nofollow"`, and a route
 * file is not somewhere other components should be importing from. Two lists
 * would drift, and the drift is silent: the lobby printed followable links to
 * /room/CODE for months of a sibling site's life while robots.txt refused every
 * one of them, which Search Console files under "blocked" and Google reads as a
 * site pointing at pages it will not let anybody see.
 */
export const DISALLOWED = [
  // Tables are ephemeral and private by obscurity, and the API is not a page.
  "/api/",
  "/room/",
  // The auth forms and one person's own record, absent from the sitemap for the
  // same reason: a form has nothing to index, and /history is signed in and
  // different for everybody who opens it.
  "/login",
  "/logout",
  "/signup",
  "/history",
];

/** True if a link to `href` must not be followed. */
export function isDisallowed(href: string): boolean {
  return DISALLOWED.some((path) => {
    // Half the list is a directory ("/room/") and half is an exact page
    // ("/login"). Appending a slash to a path that already ends in one matches
    // nothing, which is how "/room/ABC234" quietly stays followable.
    const prefix = path.endsWith("/") ? path : `${path}/`;
    return href === path || href.startsWith(prefix);
  });
}
