"use client";

/**
 * The room chrome, and the four helpers every phase needs.
 *
 * Kept in one file because it is all the same thing: the bits of the table that
 * are on screen whatever is happening. Anything that belongs to one phase lives
 * in that phase's file instead.
 */
import { Avatar, Pill, Timer } from "@/components/ui";
import { CALLINGS } from "@/lib/content/callings";
import { KIT } from "@/lib/content/kit";
import { HOOKS } from "@/lib/content/hooks";
import { BLOODS } from "@/lib/content/bloods";
import { DREAD_DOUBLE_AT, DREAD_MAX, DREAD_TURN_AT, TIMINGS } from "@/lib/game/rules";
import type { Phase, PlayerView, RoomView } from "@/lib/game/types";

/** POST to a room endpoint. Resolves true when the server accepted it. */
export type Post = (path: string, body?: unknown, method?: "POST" | "DELETE") => Promise<boolean>;

export type PhaseProps = {
  view: RoomView;
  post: Post;
  busy: boolean;
};

/** "+3", "0", "-1". Every modifier in the product is printed with its sign. */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function nameOf(view: RoomView, id: string): string {
  return view.players.find((p) => p.id === id)?.name ?? "SOMEBODY";
}

export function meOf(view: RoomView): PlayerView | null {
  return view.players.find((p) => p.id === view.me.id) ?? null;
}

export const CALLING_BY_ID = new Map(CALLINGS.map((c) => [c.id, c]));
export const KIT_BY_ID = new Map(KIT.map((k) => [k.id, k]));
export const HOOK_BY_ID = new Map(HOOKS.map((h) => [h.id, h]));
export const BLOOD_BY_ID = new Map(BLOODS.map((b) => [b.id, b]));

/** How long the phase on screen was given. Matches what the engine set. */
export const PHASE_MS: Partial<Record<Phase, number>> = {
  MUSTER: TIMINGS.musterMs,
  DRAFT_CALLING: TIMINGS.draftCallingMs,
  DRAFT_KIT: TIMINGS.draftKitMs,
  ASSIGN: TIMINGS.assignMs,
  ACT: TIMINGS.actMs,
  ACT_RESULT: TIMINGS.actResultMs,
  BALLAD: TIMINGS.balladMs,
};

export const PHASE_LABEL: Record<Phase, string> = {
  WAITING: "At the table",
  MUSTER: "The muster",
  DRAFT_CALLING: "Choosing a Calling",
  DRAFT_KIT: "Choosing your kit",
  ASSIGN: "Making your character",
  ACT: "The encounter",
  ACT_RESULT: "What it cost",
  BALLAD: "The ballad",
  FINAL: "Last orders",
};

/** What the phase is asking of you, read out to a screen reader on change. */
export function phaseSentence(view: RoomView): string {
  const act = view.act ? `Act ${view.act.index} of ${view.settings.acts}. ` : "";
  switch (view.phase) {
    case "WAITING":
      return `Waiting at the table. ${view.players.length} here.`;
    case "MUSTER":
      return "The house rolls the array. Nothing to decide yet.";
    case "DRAFT_CALLING":
      return "Rank up to three Callings.";
    case "DRAFT_KIT":
      return "Rank up to three pieces of kit. This draft runs in reverse.";
    case "ASSIGN":
      return "Place your six numbers and choose a Hook.";
    case "ACT":
      return `${act}Choose one of the three ways through.`;
    case "ACT_RESULT":
      return `${act}The ledger. Keep your Scar or hide it.`;
    case "BALLAD":
      return "Toast somebody else.";
    case "FINAL":
      return "The night is over. Final standings.";
  }
}

// ---------------------------------------------------------------------------
// Dread
// ---------------------------------------------------------------------------

/**
 * The collective count, its two published thresholds, and what each one does.
 *
 * Never colour alone: the number, a state word and the two thresholds are all
 * spelled out, so the bar is decoration on top of text that already says it.
 */
export function DreadMeter({ dread }: { dread: number }) {
  const frac = Math.max(0, Math.min(1, dread / DREAD_MAX));
  const turned = dread >= DREAD_TURN_AT;
  const doubled = dread >= DREAD_DOUBLE_AT;
  const state = turned
    ? "The night has turned"
    : doubled
      ? "Everything costs more"
      : "Steady, for now";
  const tone = turned ? "bg-danger" : doubled ? "bg-warning" : "bg-success";
  return (
    <section
      aria-label="Party Dread"
      className="rounded-lg border border-border-dim bg-bg-1 p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-caps">Dread</span>
        <span className="num text-lg text-text-hi">
          {dread}
          <span className="text-text-low">/{DREAD_MAX}</span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-3">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${frac * 100}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-sm text-text-hi">{state}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-text-mid">
        <li>
          {doubled ? "Passed" : "At"} {DREAD_DOUBLE_AT}: every Cost doubles, except on the
          Reckless line.
        </li>
        <li>
          {turned ? "Passed" : "At"} {DREAD_TURN_AT}: the night turns, and the last Act comes
          from a worse deck.
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The party
// ---------------------------------------------------------------------------

/**
 * What just happened, in order.
 *
 * `room.log` came down in every snapshot and nothing rendered it, and for several
 * things it is the ONLY record: the Reckless scramble Dread, the Hillfolk reroll,
 * every Signature and Blood power, both nomination payouts, "the night turns" and
 * "everything costs more now". None of it was on screen anywhere.
 *
 * Newest first, because that is what you look at, and capped, because the
 * interesting part of a log is always the top of it.
 */
export function Chronicle({ view, limit = 12 }: { view: RoomView; limit?: number }) {
  const entries = view.log.slice(0, limit);
  if (entries.length === 0) return null;
  return (
    <section aria-label="What just happened" className="rounded-lg border border-border-dim bg-bg-1">
      <h2 className="label-caps border-b border-border-dim px-3 py-2">What just happened</h2>
      <ol className="divide-y divide-border-dim">
        {entries.map((entry, i) => (
          <li key={`${entry.at}-${i}`} className="flex items-start gap-2 px-3 py-1.5">
            {/* A glyph AND the words: never state by colour or icon alone. */}
            <span aria-hidden className="mt-0.5 shrink-0 text-xs">
              {LOG_GLYPH[entry.kind]}
            </span>
            <span className="min-w-0 flex-1 text-xs text-text-mid">{entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const LOG_GLYPH: Record<RoomView["log"][number]["kind"], string> = {
  draft: "◆",
  roll: "⚄",
  scar: "✕",
  dread: "▲",
  laurel: "✦",
  system: "·",
};

export function PartyRail({ view }: { view: RoomView }) {
  return (
    <section aria-label="The party" className="rounded-lg border border-border-dim bg-bg-1">
      <h2 className="label-caps border-b border-border-dim px-3 py-2">
        The party · {view.players.length}
      </h2>
      <ul className="divide-y divide-border-dim">
        {view.players.map((p) => {
          const calling = p.callingId ? CALLING_BY_ID.get(p.callingId) : undefined;
          const mine = p.id === view.me.id;
          const away = !p.connected && !p.isBot;
          return (
            <li key={p.id} className="flex items-start gap-2 px-3 py-2">
              <Avatar id={p.id} name={p.name} ring={mine ? "you" : null} dimmed={away} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-sm text-text-hi">{p.name}</span>
                  {mine && <span className="text-xs text-text-low">(you)</span>}
                  {p.isHost && <Pill>Host</Pill>}
                  {p.isBot && <Pill>Stranger</Pill>}
                  {away && <Pill tone="warning">Away</Pill>}
                </p>
                <p className="text-xs text-text-mid">
                  {calling ? calling.name : "no Calling yet"}
                </p>
                <p className="num mt-0.5 text-xs text-text-low">
                  {p.renown} Renown · {p.hookTokens} token
                  {p.hookTokens === 1 ? "" : "s"}
                  {p.torches > 0 ? ` · ${p.torches} torch${p.torches === 1 ? "" : "es"}` : ""}
                </p>
                {(p.scars.length > 0 || p.hiddenScarCount > 0) && (
                  <p className="text-xs text-text-low">
                    {p.scars.length} Scar{p.scars.length === 1 ? "" : "s"} kept
                    {p.hiddenScarCount > 0
                      ? `, ${p.hiddenScarCount} said nothing about`
                      : ""}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The header strip: what is happening, which Act, and how long is left. */
export function PhaseBar({ view }: { view: RoomView }) {
  const total = PHASE_MS[view.phase];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-dim pb-3">
      <div className="min-w-0">
        <p className="label-caps">
          {view.act ? `Act ${view.act.index} of ${view.settings.acts}` : view.code}
        </p>
        <h1 className="font-display truncate text-xl text-text-hi sm:text-2xl">
          {PHASE_LABEL[view.phase]}
        </h1>
      </div>
      {view.phaseEndsAt !== null && total ? (
        <Timer endsAt={view.phaseEndsAt} totalMs={total} />
      ) : null}
    </div>
  );
}
