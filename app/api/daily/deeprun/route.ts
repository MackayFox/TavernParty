import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { resolvePlayDate } from "@/lib/daily/core";
import {
  ARRAY_SIZE,
  DEPTH,
  KIT_SLOTS,
  puzzleFor,
  run,
  shareText,
  validBuild,
} from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";

/**
 * THE DEEP RUN.
 *
 * The GET is the dungeon WITHOUT its dice. The target numbers are in it, because
 * this is a bet and not a riddle, but the number in each room is not, because
 * finding that out when you open the door is the entire game.
 *
 * The POST takes a build and EVERY DECISION SO FAR, and replays the lot. The
 * client posts again after each room, and gets back the lines for the rooms it
 * has actually committed to and nothing beyond them. So there is no session, no
 * cookie and no row in a table, and the client cannot see a die it has not yet
 * paid for by choosing.
 *
 * ponytail: nothing stops somebody posting a whole speculative run, reading the
 * dice out of the reply, and posting a better one. That is inherent to a daily
 * with no server-side session and it is the same hole as knowing today's Wordle
 * before you play it. The fix, if it ever matters, is a signed run token issued
 * on the first POST and required on the rest; the trigger is somebody bothering.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json({ ...puzzleFor(date), archive });
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  callingId: z.string().min(1).max(60),
  /** One array index per ability, in the order the abilities were sent. */
  placement: z.array(z.number().int().min(0).max(ARRAY_SIZE - 1)).length(ARRAY_SIZE),
  kitIds: z.array(z.string().min(1).max(60)).length(KIT_SLOTS),
  steps: z
    .array(z.object({ optionId: z.string().min(1).max(60), knack: z.boolean().optional() }))
    .max(DEPTH),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    const puzzle = puzzleFor(date);
    const build = {
      callingId: body.callingId,
      placement: body.placement,
      kitIds: body.kitIds,
    };
    const problem = validBuild(puzzle, build);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const result = run(puzzle, build, body.steps);
    // Over when they are out, done in, or have opened every door.
    const finished = result.out || result.vigour <= 0 || body.steps.length >= DEPTH;
    if (!finished) return NextResponse.json({ ...result, archive, finished });

    const { par, best } = parFor(puzzle);
    return NextResponse.json({
      ...result,
      archive,
      finished,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      par,
      /** The best run there was tonight. With the score, and never before it. */
      bestRun: best,
      share: shareText(date, result, par),
    });
  } catch (err) {
    return handleError(err);
  }
}
