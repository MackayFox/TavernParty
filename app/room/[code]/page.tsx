/**
 * The room, server side: one snapshot, so the page has a table on it.
 *
 * This screen used to be a spinner until the JavaScript had downloaded, React
 * had hydrated and one fetch had come back, three waits in series before a
 * player saw anything of their own game. The first snapshot is taken here
 * instead, through the same store call `GET /api/tables/[code]` makes, and handed
 * to the client as its opening state.
 *
 * It is not an extra read. It replaces the client's first poll, which now starts
 * 2.5 seconds after mount rather than immediately, and it ticks and heartbeats
 * exactly as that poll would have.
 */
import * as store from "@/lib/game/store";
import { getGuestId, getIdentity } from "@/lib/identity";
import type { RoomView } from "@/lib/game/types";
import { RoomClient } from "./RoomClient";

export const metadata = {
  // robots.txt stops the crawl, not the indexing: an external link to one of
  // these is enough for Google to list it without ever fetching it. A room is
  // gone by the time anybody clicks, and the rest are personal.
  robots: { index: false, follow: false },
};

/** A table is live state and it is redacted per viewer. Never cache it. */
export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();

  let initial: RoomView | null = null;
  let initialGone = false;
  try {
    initial = await store.snapshot(code, (await getIdentity())?.id ?? (await getGuestId()));
    initialGone = initial === null;
  } catch (err) {
    // A snapshot that throws is the database having a moment, not a missing
    // table. Say nothing, render the spinner, and let the poll sort it out:
    // telling somebody their table does not exist because of a timeout would be
    // a worse lie than a second of waiting.
    console.warn(`[room] first snapshot failed for ${code}`, err);
  }

  return <RoomClient code={code} initial={initial} initialGone={initialGone} />;
}
