import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

/** Spend a Kit reroll charge and throw your own die again. No body needed. */
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.useKitReroll(room, identity.id, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
