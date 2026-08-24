import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { ABILITIES } from "@/lib/game/types";

import { getIdentity } from "@/lib/identity";

const schema = z.object({
  /** Fenborn only. The other two choosable powers take no argument. */
  swap: z.tuple([z.enum(ABILITIES), z.enum(ABILITIES)]).optional(),
});

/** Call on your Blood. Once a run, and the engine decides what that means. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) =>
      engine.useBloodPower(room, identity.id, body, now)
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
