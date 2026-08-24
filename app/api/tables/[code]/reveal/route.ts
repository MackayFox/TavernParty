import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";


/** Burn a torch to see what the Reckless line actually needs. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.revealReckless(room, identity.id, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
