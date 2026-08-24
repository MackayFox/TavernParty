import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { resolvePlayDate } from "@/lib/daily/core";
import {
  SLOTS,
  parFor,
  puzzleFor,
  score,
  shareText,
  startingSlots,
  validSlots,
} from "@/lib/daily/tableofsix";

/**
 * TABLE OF SIX. Six rolls, six obstacles, one assignment.
 *
 * The dice and the target numbers are the puzzle, so they are all in the GET.
 * The optimum is not: it comes back with the score, once there is nothing left
 * to spoil.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json({ ...puzzleFor(date), archive, starting: startingSlots() });
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** One die position per obstacle, in the order the obstacles were sent. */
  slots: z.array(z.number().int()).length(SLOTS),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    if (!validSlots(body.slots))
      return NextResponse.json(
        { error: "Every obstacle needs exactly one roll, and every roll needs a home." },
        { status: 400 }
      );

    const puzzle = puzzleFor(date);
    const result = score(puzzle, body.slots);
    const { par, best } = parFor(puzzle);
    return NextResponse.json({
      ...result,
      archive,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      score: result.total,
      par,
      /** The best assignment there was. Revealed with the score, never before. */
      bestSlots: best,
      share: shareText(date, result, par),
    });
  } catch (err) {
    return handleError(err);
  }
}
