import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({ botId: z.string().min(1).max(64) });

/** Sit a stranger at the table. Host only, lobby only. */
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.addBot(room, identity.id, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

/** Ask them to leave. */
export async function DELETE(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const { botId } = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room) => engine.removeBot(room, identity.id, botId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
