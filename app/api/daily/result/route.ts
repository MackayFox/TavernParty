import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { DAILY_GAMES, DAILY_META, resolvePlayDate, type DailyGame } from "@/lib/daily/core";
import { getAllDailyStats, getDailyStats, saveDailyResult } from "@/lib/daily/results";
import { getIdentity } from "@/lib/identity";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  game: z.enum(DAILY_GAMES),
  score: z.number().int().min(-999).max(999),
  par: z.number().int().min(-999).max(999).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Streak-keeping for registered users only.
 *
 * A guest's game is complete without this endpoint ever being called: their
 * score is already in localStorage before the request goes out, and a failure
 * here is silent by design. Archive days are practice and are never recorded.
 *
 * The score is bounded per game rather than trusted, so a crafted POST cannot
 * write a figure the game could not have produced.
 */
export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "daily-result", 80, 3600);
    if (limited) return limited;
    const body = schema.parse(await jsonBody(req));
    const { date, archive } = resolvePlayDate(body.date);
    const meta = DAILY_META[body.game];
    if (body.score < meta.minScore || body.score > meta.maxScore)
      return NextResponse.json({ error: "That score is not possible." }, { status: 400 });

    const identity = await getIdentity();
    if (!identity || identity.kind !== "user") return NextResponse.json({ saved: false });
    if (archive) return NextResponse.json({ saved: false, reason: "practice" });

    await saveDailyResult(identity.id, body.game, body.score, body.par ?? null, date);
    return NextResponse.json({
      saved: true,
      stats: await getDailyStats(identity.id, body.game),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(req: Request) {
  try {
    const identity = await getIdentity();
    if (!identity || identity.kind !== "user") return NextResponse.json({ stats: null });
    const game = new URL(req.url).searchParams.get("game");
    if (game && (DAILY_GAMES as readonly string[]).includes(game))
      return NextResponse.json({ stats: await getDailyStats(identity.id, game as DailyGame) });
    return NextResponse.json({ all: await getAllDailyStats(identity.id) });
  } catch (err) {
    return handleError(err);
  }
}
