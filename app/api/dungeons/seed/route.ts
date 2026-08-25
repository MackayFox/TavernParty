import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { HOUSE_DEFS } from "@/lib/daily/deeprun";
import { addPoolRoom, listPool } from "@/lib/campaign/store";

/**
 * Put the house's own rooms on the shelf.
 *
 * The cold-start answer, and the difference between a builder somebody uses and
 * one they close: a dungeon is about 1,100 words if you write every floor and a
 * two minute job if you pick six off a shelf. On day one the only rooms that
 * exist are the twenty the house wrote, so they go on the shelf and the first
 * stranger picks rather than writes.
 *
 * Idempotent, and deliberately not authenticated: it adds fixed content that
 * already ships in the bundle, so there is nothing here an attacker could want.
 * It cannot add anything else, and a second run is a no-op.
 */
export async function POST() {
  try {
    const before = await listPool();
    const have = new Set(before.map((r) => r.id));
    let added = 0;
    for (const room of HOUSE_DEFS) {
      const id = `p-house-${room.id}`;
      if (have.has(id)) continue;
      await addPoolRoom({
        id,
        authorId: null,
        authorName: "The house",
        room: { ...room, id },
        shared: true,
      });
      added++;
    }
    const after = await listPool();
    return NextResponse.json({ added, total: after.length });
  } catch (err) {
    return handleError(err);
  }
}
