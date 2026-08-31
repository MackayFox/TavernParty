import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { bankScore, readSpent, writeSpent } from "@/lib/daily/spent";
import { dailyCacheControl, resolvePlayDate } from "@/lib/daily/core";
import {
  MAX_CHECKS,
  MAX_SCORE,
  PEOPLE,
  isSolved,
  puzzleFor,
  rowsCorrect,
  scoreFor,
  shareText,
  solutionFor,
  validAssignment,
} from "@/lib/daily/ledger";
import { rateLimit } from "@/lib/ratelimit";

/**
 * THE LEDGER. Five drinkers, five debts, four true statements.
 *
 * GET is the names, the amounts and the statements. The grid it resolves to
 * never leaves `lib/daily/ledger.ts`. It is public and cacheable for exactly as
 * long as the puzzle lasts, which is until the next UTC midnight: the payload
 * holds no answer and nothing in it is per player.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json(
    {
      ...puzzleFor(date),
      archive,
      maxChecks: MAX_CHECKS,
      maxScore: MAX_SCORE,
    },
    { headers: { "Cache-Control": dailyCacheControl(archive) } }
  );
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** One amount index per person, in the order the names were sent. */
  assignment: z.array(z.number().int()).length(PEOPLE),
  mode: z.enum(["check", "close"]),
  /*
   * `checksUsed` IS GONE FROM THE WIRE. It used to be sent by the client and
   * trusted, with a note calling that cosmetic because enumerating 120
   * arrangements would take 120 requests. It would not: `correctRows` is a
   * fitness score, so you filter rather than enumerate. Somebody solved it in
   * five requests, each one claiming three checks spent, then closed claiming
   * zero and was congratulated for balancing it first time. See lib/daily/spent.
   */
});

/**
 * A check says how many rows are right and never which ones. Closing the ledger
 * is free, final, and the only response that ever contains the answer.
 *
 * The count of checks spent is kept in a signed cookie rather than in the body,
 * so an honest score and a cheated one are no longer the same number.
 */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "daily-ledger", 40, 3600);
    if (limited) return limited;
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    if (!validAssignment(body.assignment))
      return NextResponse.json(
        { error: "Every drinker owes exactly one of the five amounts." },
        { status: 400 }
      );

    const spent = await readSpent("ledger", date);

    if (body.mode === "check") {
      // Refused rather than silently free: a fourth check that answers is a
      // fourth check, whatever the score afterwards claims.
      if (spent >= MAX_CHECKS) {
        return NextResponse.json(
          {
            error: `That is all three checks. Close the ledger and see how you did.`,
            spent,
          },
          { status: 400 }
        );
      }
      await writeSpent("ledger", date, spent + 1);
      return NextResponse.json({
        mode: "check",
        correctRows: rowsCorrect(date, body.assignment),
        rows: PEOPLE,
        spent: spent + 1,
        left: MAX_CHECKS - (spent + 1),
      });
    }

    const solved = isSolved(date, body.assignment);
    /**
     * The first score for a day stands. See `bankScore`.
     *
     * The solution still comes back, because seeing where you went wrong is the
     * reward for finishing. What it no longer buys is a second, better score:
     * this route was stateless, so "post rubbish, read `solution`, post
     * `solution`" was a two-request perfect game with no cookies at all.
     */
    const earned = scoreFor(solved, spent);
    const banked = await bankScore("ledger", date, earned, archive);
    return NextResponse.json({
      mode: "close",
      archive,
      solved,
      // Scored against what was actually spent, not against what was claimed.
      score: banked.score,
      alreadyPlayed: banked.alreadyPlayed,
      maxScore: MAX_SCORE,
      checksUsed: spent,
      solution: solutionFor(date),
      share: shareText(date, solved, spent),
    });
  } catch (err) {
    return handleError(err);
  }
}
