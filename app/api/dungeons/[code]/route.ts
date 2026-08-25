import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { doorFor } from "@/lib/campaign/puzzle";
import { getDungeon, ownedBy, saveDungeon } from "@/lib/campaign/store";
import { MAX_FLOORS } from "@/lib/campaign/gate";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

/**
 * One authored room, validated at the wire.
 *
 * Every bound here is a real one. The prose caps are generous enough for the
 * house's own longest room and small enough that a row cannot be used as free
 * storage, and the numbers are clamped to what the engine can actually resolve:
 * a target of 40 is not a hard door, it is a door that does not open, and the
 * gate would refuse it anyway. Refusing it here means the gate never sees it.
 */
const optionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  kind: z.enum(["check", "brace"]),
  ability: z.enum(["brawn", "deft", "grit", "wits", "nerve", "charm"]).optional(),
  tn: z.number().int().min(2).max(20).optional(),
  vigour: z.number().int().min(0).max(8).optional(),
  promise: z.string().trim().max(200),
  win: z.string().trim().max(400),
  lose: z.string().trim().max(400),
});

const roomSchema = z.object({
  id: z.string().min(1).max(60),
  band: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  boss: z.boolean().optional(),
  title: z.string().trim().max(80),
  setup: z.string().trim().max(600),
  options: z.array(optionSchema).min(1).max(5),
});

const saveSchema = z.object({
  title: z.string().trim().max(80),
  intro: z.string().trim().max(600),
  rooms: z.array(roomSchema).max(MAX_FLOORS),
  callingIds: z.array(z.string().min(1).max(60)).max(8),
  kitIds: z.array(z.string().min(1).max(60)).max(12),
  baseVigour: z.number().int().min(5).max(14),
});

/** The door: what a player sees before they go down. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });
    if (row.visibility === "banned")
      return NextResponse.json({ error: "That one has been taken down." }, { status: 404 });

    const identity = await getIdentity();
    const mine = ownedBy(row, identity?.id);
    // The author gets the whole draft back so the desk can load it. Everybody
    // else gets the door, which carries no `win`, no `lose` and no dice.
    return NextResponse.json(mine ? { mine: true, draft: row } : { mine: false, door: doorFor(row) });
  } catch (err) {
    return handleError(err);
  }
}

/** Save a draft. The author only, and never a published one silently. */
export async function PUT(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const limited = await rateLimit(req, "dungeon-save", 120, 3600);
    if (limited) return limited;
    const body = saveSchema.parse(await jsonBody(req));
    const identity = await getIdentity();
    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    const mine = ownedBy(row, identity?.id);
    if (!mine) return NextResponse.json({ error: "That one is not yours." }, { status: 403 });

    /**
     * A published dungeon is frozen, and this is not tidiness.
     *
     * Its par, its difficulty and its card were computed once and handed to
     * everybody who has the link. Letting an author edit the rooms afterwards
     * means a score posted on Tuesday was set on a different dungeon to the one
     * somebody plays on Thursday, and the leaderboard silently stops meaning
     * anything. Editing after publishing is a copy, not an edit.
     */
    if (row.publishedAt) {
      return NextResponse.json(
        {
          error:
            "This one is out in the world and its dice are pinned. Take a copy if you want to change it.",
          code: "published",
        },
        { status: 409 }
      );
    }

    await saveDungeon({ ...row, ...body });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
