import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

/**
 * Get up and go.
 *
 * There was no way out of a table at all, which combined badly with Quick Match
 * seating you at the fullest waiting one: land in an abandoned lobby and you
 * occupied that chair until the reaper came for it.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) => engine.leave(room, identity.id, now));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
