import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { createDungeon, listByOwner, listPool } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

const createSchema = z.object({ name: z.string().trim().min(1).max(20).optional() });

/** Open a new draft. */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "dungeon-create", 10, 3600);
    if (limited) return limited;
    const body = createSchema.parse(await jsonBody(req));
    const identity = await getIdentity(true);
    if (!identity)
      return NextResponse.json({ error: "Could not work out who you are." }, { status: 401 });
    const name = identity.displayName ?? body.name;
    if (!name)
      return NextResponse.json({ error: "Put a name to it first." }, { status: 400 });

    const row = await createDungeon(
      name,
      identity.kind === "user" ? identity.id : null,
      identity.id
    );
    return NextResponse.json({ code: row.code });
  } catch (err) {
    return handleError(err);
  }
}

/** The desk index: your drafts, and the shelf you can pick rooms off. */
export async function GET() {
  try {
    const identity = await getIdentity();
    if (!identity) return NextResponse.json({ mine: [], pool: await listPool() });
    return NextResponse.json({ mine: await listByOwner(identity.id), pool: await listPool() });
  } catch (err) {
    return handleError(err);
  }
}
