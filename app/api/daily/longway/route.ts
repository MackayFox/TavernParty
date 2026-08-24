import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { resolvePlayDate } from "@/lib/daily/core";
import { ACTS, FLINCH, parFor, play, puzzleFor, shareText } from "@/lib/daily/longway";

/**
 * THE LONG WAY DOWN.
 *
 * GET hands out the night: the character, the five scenes, the three doors on
 * each and the die that is already thrown. Everything a player can see, and
 * nothing else: par is not in this payload, because par is the answer.
 *
 * POST takes the choices made so far and returns the ledger for each, which is
 * what turns the arithmetic over one Act at a time without the client ever
 * holding the rules. It is stateless: the night is a pure function of the date,
 * so the same list of choices always produces the same ledgers, and there is
 * nothing to store between Acts. Par is returned only once the fifth Act is in.
 */
export async function GET(req: Request) {
  const { date, archive } = resolvePlayDate(new URL(req.url).searchParams.get("date"));
  return NextResponse.json({ ...puzzleFor(date), archive });
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  choices: z
    .array(
      z.object({
        doorId: z.string().min(1).max(60),
        spend: z.number().int().min(0).max(2).default(0),
      })
    )
    .min(1)
    .max(ACTS),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    const puzzle = puzzleFor(date);

    // Every door has to be a door that is actually in front of you in that Act.
    // Trusting the id would let a client take Act I's cheap win five times.
    for (const [i, choice] of body.choices.entries()) {
      const act = puzzle.acts[i];
      if (choice.doorId === FLINCH) continue;
      if (!act.doors.some((d) => d.id === choice.doorId))
        return NextResponse.json(
          { error: "That is not one of the ways through." },
          { status: 400 }
        );
    }

    const run = play(puzzle, body.choices);
    const complete = body.choices.length === puzzle.acts.length;
    if (!complete) return NextResponse.json({ ...run, complete });

    const { par, line } = parFor(puzzle);
    return NextResponse.json({
      ...run,
      complete,
      archive,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      score: run.renown,
      par,
      /** The best night available, revealed only now the night is over. */
      parLine: line,
      share: shareText(date, run, par),
    });
  } catch (err) {
    return handleError(err);
  }
}
