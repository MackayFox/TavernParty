import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({ scarId: z.string().min(1).max(80), keep: z.boolean() });

/** Keep it where everybody can see, or say nothing about it. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { scarId, keep } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.decideScar(room, identity.id, scarId, keep, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
