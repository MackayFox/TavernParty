import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import * as engine from "@/lib/game/engine";
import * as store from "@/lib/game/store";
import { MAX_ACTS, MAX_PLAYERS, MIN_ACTS, MIN_PLAYERS } from "@/lib/game/rules";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40).default("The back room"),
  visibility: z.enum(["public", "private"]).default("public"),
  displayName: z.string().trim().min(1).max(20).optional(),
  settings: z
    .object({
      maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).optional(),
      acts: z.number().int().min(MIN_ACTS).max(MAX_ACTS).optional(),
    })
    .optional(),
});

/** Open a table, and sit down at it. */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "table-create", 20, 3600);
    if (limited) return limited;
    const body = createSchema.parse(await jsonBody(req));
    const identity = await getIdentity(true);
    if (!identity)
      return NextResponse.json({ error: "Could not work out who you are." }, { status: 401 });
    const name = identity.displayName ?? body.displayName;
    if (!name)
      return NextResponse.json({ error: "Put a name to your character first." }, { status: 400 });

    const room = await store.createRoom({
      name: body.name,
      visibility: body.visibility,
      settings: body.settings,
    });
    await store.mutate(room.code, (r, now) =>
      engine.join(r, { id: identity.id, name }, now)
    );
    return NextResponse.json({ code: room.code });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * The lobby browser.
 *
 * Tables somebody is actually sitting at, and `players` is chairs occupied rather
 * than seats ever taken, so a table whose players all closed their tabs is not on
 * this list at all. See `engine.occupiedSeats`.
 */
export async function GET() {
  try {
    return NextResponse.json({ tables: await store.listPublicRooms() });
  } catch (err) {
    return handleError(err);
  }
}
