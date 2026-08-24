import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { HOOK_TOKENS_MAX } from "@/lib/game/rules";
import { getIdentity } from "@/lib/identity";

const schema = z.object({
  approachId: z.string().min(1).max(60),
  // Tideborn start one above the ceiling, so the cap here is MAX + 1, not MAX.
  // The engine clamps to what the player actually holds; this only has to be
  // wide enough not to reject a legal spend with a generic zod error.
  spendTokens: z.number().int().min(0).max(HOOK_TOKENS_MAX + 1).default(0),
});

/** Commit to one of the three ways through, and how many Hook tokens to spend. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { approachId, spendTokens } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.commitApproach(room, identity.id, approachId, spendTokens, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
