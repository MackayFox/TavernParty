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

/**
 * The desk index: your drafts, and the shelf you can pick rooms off.
 *
 * THE SHELF COMES DOWN WITHOUT ITS OUTCOMES. The house's twenty rooms are the same
 * twenty the Deep Run deals from, so serving them whole handed out the win and
 * lose prose for every floor of tonight's daily, to anybody, without so much as a
 * cookie. The shelf list only ever renders a title, the setup, each door's promise
 * and which ability it asks for, so the outcomes were never needed here.
 *
 * The desk gets them back for a room it has actually picked up, because an author
 * has to be able to read what they are publishing.
 */
function shelfSafe(entry: Awaited<ReturnType<typeof listPool>>[number]) {
  return {
    ...entry,
    room: {
      ...entry.room,
      options: entry.room.options.map(({ win: _win, lose: _lose, ...rest }) => rest),
    },
  };
}

export async function GET() {
  try {
    const identity = await getIdentity();
    const pool = (await listPool()).map(shelfSafe);
    if (!identity) return NextResponse.json({ mine: [], pool });
    return NextResponse.json({ mine: await listByOwner(identity.id), pool });
  } catch (err) {
    return handleError(err);
  }
}
