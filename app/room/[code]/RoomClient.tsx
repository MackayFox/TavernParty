"use client";

/**
 * THE ROOM. The whole game screen.
 *
 * State comes from one place: GET /api/tables/[code], polled every 2.5s. That
 * poll is also what advances the game, because a serverless deployment has no
 * timers and every read ticks the room. The FIRST snapshot is not polled at all:
 * `page.tsx` takes it server side and passes it in, so the table is in the HTML
 * and this screen has something real on it before any of this has run.
 *
 * Supabase Realtime is available as an accelerant: a broadcast triggers an early
 * refetch and nothing else, so the room plays correctly with Realtime switched
 * off, misconfigured or blocked. It is off by default and loaded lazily, because
 * subscribing to it means shipping 227 KB of Supabase client.
 *
 * Snapshots can arrive out of order, so anything with a lower `version` than the
 * newest one already seen is dropped on the floor.
 *
 * The server is the only authority. Nothing on this page decides a die, a
 * deadline, a phase or a reward: it renders the redacted view and posts
 * intentions.
 *
 * ponytail: the scene pool is imported into the client bundle, so a determined
 * player could read a Reckless target number out of it rather than paying a
 * Torch for it. Everything that actually scores is server side and redacted, and
 * the fix is a per-scene endpoint that returns the current scene with the
 * Reckless target stripped. Worth doing the day somebody posts the trick.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Announcer, Card, ErrorNote, Spinner } from "@/components/ui";
import { Act } from "@/components/room/Act";
import { Assign } from "@/components/room/Assign";
import { Ballad, Final } from "@/components/room/Ending";
import { Draft } from "@/components/room/Draft";
import { Muster, Waiting } from "@/components/room/Lobby";
import { ActResult } from "@/components/room/Result";
import { Chronicle, DreadMeter, PartyRail, PhaseBar, phaseSentence } from "@/components/room/shared";
import type { RoomView } from "@/lib/game/types";

const POLL_MS = 2_500;

/**
 * Read here rather than imported from lib/supabase/browser, on purpose.
 *
 * The whole point of the flag is that the Supabase client is never fetched, and
 * importing the constant from the module that contains it would fetch it. Next
 * inlines this literal at build time, so with the flag off the import below is
 * dead code and its chunk is never requested.
 */
const REALTIME = process.env.NEXT_PUBLIC_REALTIME === "1";

export function RoomClient({
  code,
  initial,
  initialGone,
}: {
  code: string;
  /** The server's snapshot, rendered before any of this hydrates. */
  initial: RoomView | null;
  initialGone: boolean;
}) {
  const [view, setView] = useState<RoomView | null>(initial);
  const [gone, setGone] = useState(initialGone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The highest version rendered. Anything older than this is a stale reply. */
  const seen = useRef(initial?.version ?? -1);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setGone(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as RoomView;
      if (next.version < seen.current) return;
      seen.current = next.version;
      setView(next);
    } catch {
      // A dropped poll is not an error the player needs to read about. The next
      // one is 2.5 seconds away.
    }
  }, [code]);

  useEffect(() => {
    // Only when the server did not already hand us one. Fetching on mount as
    // well would put back the round trip this page exists to have removed.
    if (seen.current < 0) void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  /**
   * Tell the table when the tab goes, rather than making them wait out the
   * timeout for it.
   *
   * `sendBeacon` because it survives the page going away, which `fetch` does not.
   * The presence sweep is the safety net and this is the fast path: without it a
   * host closing a tab holds the chair for the whole PRESENCE_TIMEOUT_MS, and with
   * it the chair moves on in one poll. `pagehide` rather than `unload`, which
   * mobile Safari does not reliably fire.
   */
  useEffect(() => {
    const url = `/api/tables/${encodeURIComponent(code)}/leave`;
    const goodbye = () => {
      // Only when the page is actually going, not on a tab switch: a player who
      // looks at something else for ten seconds has not left the table.
      if (document.visibilityState !== "hidden") return;
      navigator.sendBeacon?.(url, new Blob(["{}"], { type: "application/json" }));
    };
    window.addEventListener("pagehide", goodbye);
    return () => window.removeEventListener("pagehide", goodbye);
  }, [code]);

  // Realtime is an accelerant only: it refetches, it never carries state. Loaded
  // on demand so its 227 KB is not in this page's first load, and only when the
  // deployment has asked for it.
  useEffect(() => {
    if (!REALTIME) return;
    let stop: (() => void) | undefined;
    let dropped = false;
    void import("@/lib/supabase/browser").then(({ subscribeToTable }) => {
      if (dropped) return;
      stop = subscribeToTable(code, () => void load());
    });
    return () => {
      dropped = true;
      stop?.();
    };
  }, [code, load]);

  const post = useCallback(
    async (path: string, body?: unknown, method: "POST" | "DELETE" = "POST"): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(code)}${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "That did not go through. Try it again.");
          return false;
        }
        await load();
        return true;
      } catch {
        setError("The tavern did not answer. Try it again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, load]
  );

  /**
   * False for exactly one render, which is the one that has to match the HTML.
   *
   * `Timer` reads `Date.now()`, and the server's second and the browser's second
   * are never the same second. React treats that as a hydration mismatch and
   * throws away the entire server render to start again, which would cost this
   * page the thing it was changed for. So the first pass renders the room with no
   * deadline on it, which is the only part of the screen that reads a clock, and
   * the countdown appears one frame later. Nothing moves when it does: the header
   * is a flex row and the title beside it is already truncated.
   */
  const [clock, setClock] = useState(false);
  useEffect(() => setClock(true), []);

  if (gone) {
    return (
      <div className="py-16">
        <Card className="text-center">
          <h1 className="font-display text-2xl text-text-hi">No such table</h1>
          <p className="mt-2 text-text-mid">
            Nobody is sitting at {code}. Check the code, or start a table of your own.
          </p>
        </Card>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner label="Finding the table" />
      </div>
    );
  }

  const shown = clock ? view : { ...view, phaseEndsAt: null };
  const beat = `${view.phase}-${view.act?.index ?? 0}`;
  const props = { view, post, busy };

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <PhaseBar view={shown} />
      <ErrorNote message={error} />
      <DreadMeter view={view} />

      {!view.me.id && view.phase !== "WAITING" && (
        <p className="rounded-md border border-border-strong px-3 py-2 text-sm text-text-mid">
          You are watching this one. The run has started, so the next table is the one you
          can play.
        </p>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div key={beat} className="min-w-0">
          {view.phase === "WAITING" && <Waiting {...props} />}
          {view.phase === "MUSTER" && <Muster view={view} />}
          {(view.phase === "DRAFT_CALLING" || view.phase === "DRAFT_KIT") && (
            <Draft {...props} />
          )}
          {view.phase === "ASSIGN" && <Assign {...props} />}
          {view.phase === "ACT" && <Act {...props} />}
          {view.phase === "ACT_RESULT" && <ActResult {...props} />}
          {view.phase === "BALLAD" && <Ballad {...props} />}
          {view.phase === "FINAL" && <Final {...props} />}
        </div>
        <aside className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start">
          <PartyRail view={view} />
          <Chronicle view={view} />
        </aside>
      </div>

      {/*
        One announcement per phase, for anybody who is not watching the screen.
        Derived rather than kept in state behind an effect: the sentence is a
        pure function of the phase, so a poll that changes nothing produces the
        same string and React never touches the live region.
      */}
      <Announcer message={phaseSentence(view)} />
    </div>
  );
}
