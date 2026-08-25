import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { isAdmin } from "@/lib/campaign/admin";
import { standingOf } from "@/lib/campaign/hall";
import { listSubmitted } from "@/lib/campaign/store";

/** What is waiting. A 404 rather than a 403 for anybody else: the queue is not a door to rattle. */
export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const rows = await listSubmitted();
    const queue = await Promise.all(
      rows.map(async (row) => ({
        code: row.code,
        title: row.title,
        intro: row.intro,
        author: row.authorName,
        floors: row.rooms.length,
        par: row.par,
        difficulty: row.difficulty,
        plays: row.plays,
        finishes: row.finishes,
        standing: await standingOf(row.code),
        // The prose a moderator actually has to read, in one place, rather than
        // making them open the dungeon and click through every floor.
        prose: row.rooms.flatMap((r) => [
          r.title,
          r.setup,
          ...r.options.flatMap((o) => [o.label, o.promise, o.win, o.lose]),
        ]),
      }))
    );
    return NextResponse.json({ queue });
  } catch (err) {
    return handleError(err);
  }
}
