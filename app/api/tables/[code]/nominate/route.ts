import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({ nomineeId: z.string().min(1).max(64) });

/** Put somebody else forward for the door nobody wants. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { nomineeId } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.nominate(room, identity.id, nomineeId, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
