import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { mark, standingOf } from "@/lib/campaign/hall";
import { getDungeon } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Say a dungeon was worth your time.
 *
 * Only possible from somebody who got to the bottom of it, and that rule lives
 * in a foreign key rather than in this handler: a mark row cannot exist without
 * a finished run row. A route can be gone around; a constraint cannot.
 *
 * One per person, and it does not toggle. A vote you can take back is a vote
 * somebody can be argued out of.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const limited = await rateLimit(req, "dungeon-mark", 60, 3600);
    if (limited) return limited;

    const row = await getDungeon(code);
    if (!row || !row.publishedAt || row.visibility === "banned")
      return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    /**
     * No identity is the same answer as no finished run, and gets the same
     * sentence.
     *
     * Playing mints a guest cookie, so anybody who has actually been down there
     * has one. Somebody who arrives with none has finished nothing, and telling
     * them "could not work out who you are" is a true statement about the wrong
     * thing: the reason they cannot rate it is that they have not played it.
     */
    const identity = await getIdentity();
    const result = identity ? await mark(row.code, identity.id) : "not_finished";
    if (result === "not_finished") {
      return NextResponse.json(
        { error: "Get to the bottom of it first. Then you can say it was good." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, standing: await standingOf(row.code) });
  } catch (err) {
    return handleError(err);
  }
}
