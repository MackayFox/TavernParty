import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO EM-DASHES IN PLAYER-FACING COPY, enforced rather than remembered.
 *
 * It is the one typographic rule this project chose to be strict about, and in
 * a single night three em-dashes went live in new copy: two in The Deep Run's
 * score ledger, one in its glossary, and one in a Muster dropdown two lines
 * below a comment that read "Middot, not an em-dash: the house rule is no
 * em-dashes in player-facing copy". Every one of them got past a person who
 * knew the rule and was looking at the line.
 *
 * A rule nothing checks is a preference. `lib/content/tags.ts` learned this
 * already and has a test; so does `ads.txt`; so does the palette. This is the
 * same shape.
 *
 * COMMENTS AND PROSE ARE DIFFERENT THINGS. Source comments are for whoever
 * reads the code and may punctuate however they like -- half this codebase's
 * comments use them. Only strings a player can read are checked, so the scan
 * strips comments first. It is a deliberately simple stripper: it will not
 * survive an em-dash inside a regex inside a string, and if that ever happens
 * the honest fix is to not do that.
 */

const EM_DASH = "—";

/** Every .ts and .tsx under a directory, recursively. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      out.push(...sourcesUnder(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Remove block and line comments.
 *
 * Crude on purpose. A `//` inside a string literal would take the rest of the
 * line with it, which can only ever produce a false PASS, never a false fail --
 * and a false pass on one line is a much better failure mode for a lint like
 * this than a suite nobody can keep green.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const ROOTS = ["app", "components", "lib"];
const FILES = ROOTS.flatMap((root) => sourcesUnder(join(process.cwd(), root)));

describe("player-facing copy", () => {
  it("has something to check", () => {
    // A glob that silently matched nothing would make this whole file a no-op.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("contains no em-dashes outside comments", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (!code.includes(EM_DASH)) continue;
      for (const [i, line] of code.split("\n").entries()) {
        if (line.includes(EM_DASH)) {
          offenders.push(`${relative(process.cwd(), file)}:${i + 1}  ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(
      offenders,
      `em-dash in player-facing copy. Use a colon, a comma or a middot:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
