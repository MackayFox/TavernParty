import { NextResponse } from "next/server";
import { DAILY_GAMES, DAILY_META, utcDate } from "@/lib/daily/core";

/**
 * The index of the four dailies.
 *
 * One place that names the ids, so a smoke test or a link checker does not have
 * to guess at slugs, and adding a fifth daily is one entry in `DAILY_META`
 * rather than an edit in every consumer.
 */
export async function GET() {
  return NextResponse.json({
    date: utcDate(),
    games: DAILY_GAMES.map((id) => ({ id, ...DAILY_META[id] })),
  });
}
