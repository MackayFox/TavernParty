import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { isAdmin } from "@/lib/campaign/admin";
import { getDungeon, saveDungeon } from "@/lib/campaign/store";

const schema = z.object({ action: z.enum(["list", "return", "ban", "choose"]) });

/**
 * The queue, worked by a person.
 *
 * Four verbs and no more: put it on the shelf, hand it back to its author, take
 * it down, or put it in front of the whole site. Nothing here is automatic and
 * nothing here is reversible by the author, because the entire moderation design
 * is that the front page is not reachable from a form.
 *
 * `choose` is a stamp and a curated link, never a rotation. Nothing in
 * `lib/daily/` reads it, so being chosen cannot put a database query in the path
 * of the one module in the product that is pure arithmetic.
 *
 * A banned dungeon keeps its link and its rows. Its author can still see it and
 * still see what happened to it, and nothing on the site points at it. Deleting
 * it would be tidier and would also mean somebody's evening disappearing without
 * explanation.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    if (!(await isAdmin()))
      return NextResponse.json({ error: "Not for you." }, { status: 404 });

    const { code } = await ctx.params;
    const { action } = schema.parse(await jsonBody(req));
    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    if (action === "choose") {
      // Choosing shelves it too: nobody is pointed at the front page at a dungeon
      // that is not on the front page.
      const chosenAt = row.chosenAt ?? new Date().toISOString();
      await saveDungeon({ ...row, visibility: "listed", chosenAt });
      return NextResponse.json({ ok: true, visibility: "listed", chosenAt });
    }

    const visibility =
      action === "list" ? "listed" : action === "ban" ? "banned" : "unlisted";
    await saveDungeon({ ...row, visibility });
    return NextResponse.json({ ok: true, visibility });
  } catch (err) {
    return handleError(err);
  }
}
