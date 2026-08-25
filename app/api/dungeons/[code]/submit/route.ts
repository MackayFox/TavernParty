import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { getDungeon, ownedBy, saveDungeon } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Ask for a place in the Hall.
 *
 * Publishing gives you a link. This asks a person to put it on the shelf out
 * front, and a person is the only thing that ever does. Nothing an author can do
 * moves a dungeon from `submitted` to `listed`, which is the whole moderation
 * design: the front page is not reachable from a form.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const limited = await rateLimit(req, "dungeon-submit", 20, 3600);
    if (limited) return limited;

    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    const identity = await getIdentity();
    if (!ownedBy(row, identity?.id))
      return NextResponse.json({ error: "That one is not yours." }, { status: 403 });
    if (!row.publishedAt)
      return NextResponse.json({ error: "Publish it first." }, { status: 400 });
    if (row.visibility === "banned")
      return NextResponse.json({ error: "That one has been taken down." }, { status: 403 });
    if (row.visibility === "listed")
      return NextResponse.json({ ok: true, already: true });

    await saveDungeon({ ...row, visibility: "submitted" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
