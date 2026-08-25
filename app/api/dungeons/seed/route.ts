import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { seedHouseContent } from "@/lib/campaign/seed";

/**
 * Put the house's own rooms on the shelf, and the house's own dungeon in the Hall.
 *
 * The whole of the work is in `lib/campaign/seed.ts`, because boot does the same
 * thing on a server with no database and two copies of it would drift.
 *
 * Idempotent, and deliberately not authenticated: everything it adds is fixed
 * content that already ships in the bundle, so there is nothing here an attacker
 * could want and nothing they could substitute. A second run is a no-op.
 */
export async function POST() {
  try {
    const { rooms, added, demo } = await seedHouseContent();
    return NextResponse.json({ added, total: rooms, demo });
  } catch (err) {
    return handleError(err);
  }
}
