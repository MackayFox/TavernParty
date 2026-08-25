import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { MIN_FINISHERS, standingOf } from "@/lib/campaign/hall";
import { listPublished } from "@/lib/campaign/store";

/**
 * The Hall.
 *
 * Ranked by the Wilson lower bound on marks per finisher, with anything under
 * MIN_FINISHERS held out of the ranking and shown under New instead. That split
 * is the whole design: a new dungeon gets seen without being able to top the
 * board on one friendly vote, and a good one climbs as evidence accumulates
 * rather than as attention does.
 */
export async function GET() {
  try {
    const rows = await listPublished(60);
    const cards = await Promise.all(
      rows.map(async (row) => {
        const standing = await standingOf(row.code);
        return {
          code: row.code,
          title: row.title,
          intro: row.intro,
          author: row.authorName,
          floors: row.rooms.length,
          par: row.par,
          difficulty: row.difficulty,
          plays: row.plays,
          finishes: row.finishes,
          publishedAt: row.publishedAt,
          chosen: !!row.chosenAt,
          ...standing,
          ranked: standing.finishers >= MIN_FINISHERS,
        };
      })
    );
    return NextResponse.json({
      minFinishers: MIN_FINISHERS,
      wellThoughtOf: cards.filter((c) => c.ranked).sort((a, b) => b.wilson - a.wilson),
      fresh: [...cards].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    });
  } catch (err) {
    return handleError(err);
  }
}
