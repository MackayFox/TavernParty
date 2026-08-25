import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { reportFor } from "@/lib/campaign/gate";
import { designOf } from "@/lib/campaign/puzzle";
import { countPickups, getDungeon, ownedBy, saveDungeon } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Publish, which here means "freeze and hand back a link".
 *
 * The gate runs AGAIN, server-side, and its verdict is the one that counts. The
 * desk already ran it and showed the author the result, and that is a courtesy
 * rather than a control: the desk is a client, the client is a stranger, and a
 * dungeon that reached the world without the solver seeing it is the one thing
 * this feature cannot survive.
 *
 * Publishing does NOT list it. It gets a link and appears nowhere. A person puts
 * things in the Hall.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const limited = await rateLimit(req, "dungeon-publish", 20, 3600);
    if (limited) return limited;

    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    const identity = await getIdentity();
    const mine = ownedBy(row, identity?.id);
    if (!mine) return NextResponse.json({ error: "That one is not yours." }, { status: 403 });
    if (row.publishedAt)
      return NextResponse.json({ ok: true, code: row.code, already: true });

    if (!row.title.trim())
      return NextResponse.json({ error: "It needs a name before it goes anywhere." }, { status: 400 });

    const report = reportFor(designOf(row));
    if (!report.ok) {
      return NextResponse.json(
        { error: "The gate is not happy with this one yet.", report },
        { status: 400 }
      );
    }

    await saveDungeon({
      ...row,
      // Frozen at publish. The dice are pinned to the code, so par cannot change,
      // and a browse card should never pay for a search to learn a constant.
      par: report.par,
      difficulty: report.difficulty,
      report,
      publishedAt: new Date().toISOString(),
      visibility: "unlisted",
    });

    // Credit the rooms this one picked up off the shelf. Quiet, and the only
    // reward a room author gets, which is why it is worth getting right.
    await countPickups(row.rooms.map((r) => r.id).filter((id) => id.startsWith("p-")));

    return NextResponse.json({ ok: true, code: row.code, report });
  } catch (err) {
    return handleError(err);
  }
}
