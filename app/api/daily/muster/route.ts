import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { dailyCacheControl, resolvePlayDate } from "@/lib/daily/core";
import { parFor, play, puzzleFor, shareText, validBuild } from "@/lib/daily/muster";
import { ARRAY_SIZE } from "@/lib/game/rules";
import { bankScore } from "@/lib/daily/spent";

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
    // The first score for a day stands, the same way it does in the other
    // three. Muster already withholds the winning build on a miss, so there is
    // no answer to read here -- this is for parity, so all four dailies agree
    // about what a replay is worth. See bankScore.
    const banked = await bankScore("muster", date, result.cleared, archive);
    return NextResponse.json({
      ...result,
      archive,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      score: banked.score,
      alreadyPlayed: banked.alreadyPlayed,
      par,
      /**
       * THE ANSWER SHEET, AND ONLY ONCE IT CANNOT BE USED.
       *
       * This used to come back on every submission, including a miss, so the
       * obvious move was to post any build, read the winner out of the response
       * and post that. Verified: a deliberately bad build returned 2 of 4 along
       * with the exact winning build, and posting it back returned 4 of 4.
       *
       * Now it arrives when the run already matched par, where it is a
       * confirmation rather than a hint, or on an archive day, which is explicitly
       * practice and where knowing the answer is the point.
       */
      bestBuild: result.cleared >= par || archive ? best : null,
      /** On a miss, the door they gave up rather than the build they should have had. */
      missed:
        result.cleared >= par || archive
          ? null
          : result.trials.find((t) => !t.cleared)?.label ?? null,
      share: shareText(date, result, par, puzzle.encounter),
    });
  } catch (err) {
    return handleError(err);
  }
}
