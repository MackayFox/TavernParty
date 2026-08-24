import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { dailyCacheControl, resolvePlayDate } from "@/lib/daily/core";
import { parFor, play, puzzleFor, shareText, validBuild } from "@/lib/daily/muster";
import { ARRAY_SIZE } from "@/lib/game/rules";

/**
 * MUSTER. Build a character on tonight's six numbers and take on the encounter.
 *
 * GET is the whole budget and the whole night: six numbers, five doors with
 * their target numbers and their already-thrown dice, eight Callings and the
 * kit on offer. There is no hidden information in the puzzle at all, which is
 * the design: a score below par is a build decision, never a bad roll.
 *
 * Par, and the build that reaches it, come back with the result.
 *
 * The GET is public and cacheable: the same bytes for everybody until the next
 * UTC midnight, so nobody should be paying a round trip for it twice.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json(
    { ...puzzleFor(date), archive },
    { headers: { "Cache-Control": dailyCacheControl(archive) } }
  );
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** One array slot per ability, in the order the abilities were sent. */
  placement: z.array(z.number().int()).length(ARRAY_SIZE),
  callingId: z.string().min(1).max(60),
  kitId: z.string().min(1).max(60),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    const puzzle = puzzleFor(date);
    const build = {
      placement: body.placement,
      callingId: body.callingId,
      kitId: body.kitId,
    };
    if (!validBuild(puzzle, build))
      return NextResponse.json(
        { error: "That is not a finished character. Six numbers, one Calling, one piece of kit." },
        { status: 400 }
      );

    const result = play(puzzle, build);
    const { par, best } = parFor(puzzle);
    return NextResponse.json({
      ...result,
      archive,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      score: result.cleared,
      par,
      /** The build that clears the most doors tonight. Shown once it is over. */
      bestBuild: best,
      share: shareText(date, result, par, puzzle.encounter),
    });
  } catch (err) {
    return handleError(err);
  }
}
