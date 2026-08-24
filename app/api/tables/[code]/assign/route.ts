import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({
  scores: z.object({
    brawn: z.number().int().min(1).max(20),
    deft: z.number().int().min(1).max(20),
    grit: z.number().int().min(1).max(20),
    wits: z.number().int().min(1).max(20),
    nerve: z.number().int().min(1).max(20),
    charm: z.number().int().min(1).max(20),
  }),
  hookId: z.string().min(1).max(40),
});

/** Place the six house numbers, and choose a Hook. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { scores, hookId } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.assign(room, identity.id, scores, hookId, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
