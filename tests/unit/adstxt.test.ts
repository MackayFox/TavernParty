import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ads.txt has to exist, be served from the domain root, and name the same
 * publisher the site actually serves ads for.
 *
 * Added on day one rather than after AdSense complains, which is how the other
 * two sites in the network found out they needed it. It fails silently -- the site
 * looks fine, the ads just do not earn -- which is exactly the sort of thing
 * worth a test rather than a memory.
 *
 * `public/` is served at the root by Next, so `public/ads.txt` answers
 * `/ads.txt`. Keep it there rather than behind a route handler: a static file
 * cannot be broken by a redirect, a middleware or a rendering error.
 */
const PUBLISHER = /^google\.com, (pub-\d{10,}), DIRECT, f08c47fec0942fa0$/;

describe("ads.txt", () => {
  const raw = readFileSync(join(process.cwd(), "public", "ads.txt"), "utf8");

  it("is a single well-formed AdSense record", () => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(PUBLISHER);
  });

  it("ends with a newline and carries no byte order mark", () => {
    // Both have been known to upset strict ads.txt parsers.
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    // And no carriage returns. .gitattributes pins this file to LF, because a
    // CLI deploy ships the working copy rather than the committed bytes, and on
    // Windows that would otherwise be CRLF.
    expect(raw).not.toContain("\r");
  });

  it("names the publisher the site serves ads for", () => {
    // The id is an env var here, so this only asserts when it is configured --
    // which is the case that matters, because a mismatch is unauthorised
    // inventory rather than a build error.
    const configured = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    if (!configured) return;
    const inFile = PUBLISHER.exec(raw.trim())?.[1];
    expect(inFile, "ads.txt publisher must match NEXT_PUBLIC_ADSENSE_CLIENT").toBe(
      configured.replace(/^ca-/, "")
    );
  });
});
