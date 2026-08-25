import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { reportFor } from "@/lib/campaign/gate";
import { designOf } from "@/lib/campaign/puzzle";
import { getDungeon, ownedBy } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Run the gate over a draft and tell the author the truth about it.
 *
 * Rate limited rather than debounced HERE, because the debounce lives on the
 * desk where it belongs and a limit on the server is what stops somebody using
 * a solver as a free compute service. Ten an hour is generous for a person and
 * useless for anybody else, and the desk skips the call entirely when the
 * mechanical hash has not moved, which is most of an afternoon's typing.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const limited = await rateLimit(req, "dungeon-report", 40, 3600);
    if (limited) return limited;

    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    const identity = await getIdentity();
    const mine = ownedBy(row, identity?.id);
    if (!mine) return NextResponse.json({ error: "That one is not yours." }, { status: 403 });

    return NextResponse.json(reportFor(designOf(row)));
  } catch (err) {
    return handleError(err);
  }
}
