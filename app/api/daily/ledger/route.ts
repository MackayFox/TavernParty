import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { resolvePlayDate } from "@/lib/daily/core";
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
 * never leaves `lib/daily/ledger.ts`.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json({
    ...puzzleFor(date),
    archive,
    maxChecks: MAX_CHECKS,
    maxScore: MAX_SCORE,
  });
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** One amount index per person, in the order the names were sent. */
  assignment: z.array(z.number().int()).length(PEOPLE),
  mode: z.enum(["check", "close"]),
  checksUsed: z.number().int().min(0).max(MAX_CHECKS).default(0),
});

/**
 * A check says how many rows are right and never which ones. Closing the ledger
 * is free, final, and the only response that ever contains the answer.
 *
 * ponytail: the check count comes from the client, because a daily has no server
 * side session to keep it in and nothing else in the product needs one. It is
 * cosmetic, in the same way that Wordle cannot stop you opening a second tab,
 * and the rate limit below is what stops the checks being used as an oracle:
 * enumerating all 120 ledgers by hand would take 120 requests.
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

    if (body.mode === "check") {
      return NextResponse.json({
        mode: "check",
        correctRows: rowsCorrect(date, body.assignment),
        rows: PEOPLE,
      });
    }

    const solved = isSolved(date, body.assignment);
    return NextResponse.json({
      mode: "close",
      archive,
      solved,
      score: scoreFor(solved, body.checksUsed),
      maxScore: MAX_SCORE,
      checksUsed: body.checksUsed,
      solution: solutionFor(date),
      share: shareText(date, solved, body.checksUsed),
    });
  } catch (err) {
    return handleError(err);
  }
}
