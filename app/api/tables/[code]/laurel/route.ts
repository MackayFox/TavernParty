import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({ targetId: z.string().min(1).max(64) });

/** One secret toast at the Ballad. Never yourself. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { targetId } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.castLaurel(room, identity.id, targetId, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
