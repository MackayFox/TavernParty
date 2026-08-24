import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

const schema = z.object({
  /** Knife and Oathbound only: whose success or whose wound. */
  targetId: z.string().min(1).max(80).optional(),
  /** Sapper only: which other door. */
  approachId: z.string().min(1).max(60).optional(),
});

/**
 * Call your Signature. Once in the whole run.
 *
 * Which phase this is legal in depends on the Calling, so the engine decides:
 * the Chanter and the Reckoner declare during the Act, everybody else answers a
 * result. Sending it in the wrong phase gets the engine's own sentence back.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = schema.parse(await jsonBody(req));
    const identity = await getIdentity();
    if (!identity)
      return NextResponse.json({ error: "You are not at this table." }, { status: 401 });
    await store.mutate(code, (room, now) =>
      engine.useSignature(room, identity.id, body, now)
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
