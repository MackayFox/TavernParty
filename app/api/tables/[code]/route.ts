import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import * as store from "@/lib/game/store";
import { getGuestId, getIdentity } from "@/lib/identity";

/**
 * The polling endpoint, and the only read the client makes.
 *
 * Every call ticks the room first, which is what advances the phase deadlines:
 * there are no server timers. It also heartbeats the caller, so presence is a
 * side effect of playing rather than a separate channel.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const identity = await getIdentity();
    const viewer = identity?.id ?? (await getGuestId());
    const view = await store.snapshot(code, viewer);
    if (!view)
      return NextResponse.json(
        { error: "That table does not exist.", code: "not_found" },
        { status: 404 }
      );
    return NextResponse.json(view);
  } catch (err) {
    return handleError(err);
  }
}
