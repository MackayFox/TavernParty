import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ displayName: z.string().trim().min(1).max(20).optional() });

/** Join the fullest table still waiting, or open one. */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "quick-match", 30, 3600);
    if (limited) return limited;
    const { displayName } = schema.parse(await jsonBody(req));
    const identity = await getIdentity(true);
    if (!identity)
      return NextResponse.json({ error: "Could not work out who you are." }, { status: 401 });
    const name = identity.displayName ?? displayName;
    if (!name)
      return NextResponse.json({ error: "Put a name to your character first." }, { status: 400 });
    const room = await store.quickMatch();
    await store.mutate(room.code, (r, now) => engine.join(r, { id: identity.id, name }, now));
    return NextResponse.json({ code: room.code });
  } catch (err) {
    return handleError(err);
  }
}
