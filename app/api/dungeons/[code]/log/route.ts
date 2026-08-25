import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { floorReportFor } from "@/lib/campaign/hall";
import { getDungeon, ownedBy } from "@/lib/campaign/store";
import { getIdentity } from "@/lib/identity";
import type { Report } from "@/lib/campaign/gate";

/**
 * The play log. The author's only, and the most useful screen in the feature.
 *
 * It exists to close the one honest gap in the gate. The gate solves for PERFECT
 * play, which is what makes it fast and what makes par mean something, and it is
 * therefore always optimistic about how many people get out. This is what really
 * happened: "you were told sixty percent would make it, thirty-one percent did,
 * and floor four is where the rest stopped."
 *
 * Author-only because it is feedback, not a scoreboard. Telling everybody which
 * floor stops people is telling them which floor to prepare for, and half the
 * point of a dungeon is not knowing.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const row = await getDungeon(code);
    if (!row) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });

    const identity = await getIdentity();
    if (!ownedBy(row, identity?.id))
      return NextResponse.json({ error: "That one is not yours." }, { status: 403 });

    const log = await floorReportFor(row.code);
    const frozen = row.report as Report | null;
    const predicted =
      frozen && frozen.builds > 0 ? frozen.out / frozen.builds : null;
    const observed = log.plays > 0 ? log.finished / log.plays : null;

    return NextResponse.json({
      code: row.code,
      title: row.title,
      par: row.par,
      floors: row.rooms.length,
      // What the solver said, and what people did. The gap is the point.
      predicted,
      observed,
      plays: log.plays,
      finished: log.finished,
      meanScore: log.meanScore,
      // `stoppedOn` is the 1-based floor they were standing in when the Vigour
      // ran out (engine sets `depth = room.index + 1` before the check), so the
      // room that did it is at index floor - 1.
      stops: Object.entries(log.stops)
        .map(([floor, count]) => ({
          floor: Number(floor),
          title: row.rooms[Number(floor) - 1]?.title ?? `Floor ${floor}`,
          count,
        }))
        .sort((a, b) => a.floor - b.floor),
    });
  } catch (err) {
    return handleError(err);
  }
}
