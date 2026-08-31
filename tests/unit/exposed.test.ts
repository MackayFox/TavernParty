import { describe, expect, it } from "vitest";
// A plain .mjs helper shared with scripts/db.mjs.
import { exposedList, mergeExposed } from "../../scripts/exposed.mjs";

/**
 * `npm run db:expose` WRITES TO A SHARED PRODUCTION DATABASE.
 *
 * The Supabase project this site is a lodger in also serves another live site,
 * and PostgREST's exposed-schema list is one value for the whole project. The
 * entire safety property of the command is that it ADDS to that list and never
 * replaces it: get it wrong and the other site's API stops answering, which is
 * a worse outage than the one the command exists to fix and one nobody would
 * think to connect to having run this.
 *
 * That is the sort of thing that should not be first exercised at four in the
 * morning against production. The connection cannot be tested here; the
 * decision about what to write can, and it is the half that does the damage.
 */

describe("what PostgREST is told to serve", () => {
  it("reads the list off the role", () => {
    expect(exposedList(["pgrst.db_schemas=public, graphql_public, tavern"])).toEqual([
      "public",
      "graphql_public",
      "tavern",
    ]);
  });

  it("ignores other settings on the same role", () => {
    expect(
      exposedList(["statement_timeout=8s", "pgrst.db_schemas=public", "search_path=public"])
    ).toEqual(["public"]);
  });

  it("assumes Supabase's own default when the role says nothing", () => {
    // This is the state the site was actually in: the setting had been lost, and
    // the API's own error named exactly this pair.
    expect(exposedList([])).toEqual(["public", "graphql_public"]);
    expect(exposedList(undefined)).toEqual(["public", "graphql_public"]);
  });

  it("adds without removing, and keeps the order it found", () => {
    expect(mergeExposed(["pgrst.db_schemas=public, graphql_public"], "tavern")).toEqual([
      "public",
      "graphql_public",
      "tavern",
    ]);
  });

  it("NEVER drops another site's schema", () => {
    // The failure that matters. `shareholder` is not ours and must survive.
    const before = ["pgrst.db_schemas=public, graphql_public, shareholder"];
    const after = mergeExposed(before, "tavern");
    expect(after).toContain("shareholder");
    expect(after).toContain("public");
    expect(after).toContain("graphql_public");
    expect(after).toContain("tavern");
    expect(after).toHaveLength(4);
  });

  it("is idempotent, so a second run writes nothing", () => {
    const already = ["pgrst.db_schemas=public, graphql_public, tavern"];
    expect(mergeExposed(already, "tavern")).toEqual(exposedList(already));
  });

  it("survives the whitespace a human leaves in a dashboard field", () => {
    expect(exposedList(["pgrst.db_schemas= public ,graphql_public ,  tavern "])).toEqual([
      "public",
      "graphql_public",
      "tavern",
    ]);
    expect(exposedList(["pgrst.db_schemas=public,,graphql_public"])).toEqual([
      "public",
      "graphql_public",
    ]);
  });
});
