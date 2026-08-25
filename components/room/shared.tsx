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
import { TIMINGS, dreadThresholds } from "@/lib/game/rules";
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
  // "Act", not "encounter". The eyebrow above this heading already reads
  // "Act 3 of 5", the sentence below it says "Act 3 of 5", the engine phase is
  // ACT and settings call them acts, so a heading reading "The encounter" put a
  // second name for the same five things thirty pixels under the first one.
  ACT: "The Act",
  ACT_RESULT: "What it cost",
  BALLAD: "The ballad",
  FINAL: "Last orders",
};

/**
 * What the phase is asking of you, in one line.
 *
 * Shown in the header strip AND read out on change, which is the right way round:
 * it used to be announced to screen readers only, so the people who could see the
 * screen were the ones told least about it.
 */
export function phaseSentence(view: RoomView): string {
  const act = view.act ? `Act ${view.act.index} of ${view.settings.acts}. ` : "";
  switch (view.phase) {
    case "WAITING":
      // Now that this is on the screen it can do a job: the commonest confusion
      // at a table is four people waiting for a fifth who was never coming.
      return view.players.find((p) => p.id === view.me.id)?.isHost
        ? `${view.players.length} at the table. Start it when you are ready, and empty seats fill with strangers.`
        : `${view.players.length} at the table. The host starts it.`;
    case "MUSTER":
      return "The house rolls the array. Nothing to press. The first draft opens on its own.";
    case "DRAFT_CALLING":
      // The trade is the whole point of the draft and it is invisible until the
      // next phase, by which time it is too late to have understood it.
      return "Rank up to three Callings. First pick here means last pick of the kit.";
    case "DRAFT_KIT":
      return "Rank up to three pieces of kit. This draft runs in reverse.";
    case "ASSIGN":
      return "Place your six numbers and choose a Hook.";
    case "ACT":
      return `${act}Choose one of the three ways through.`;
    case "ACT_RESULT":
      return `${act}The ledger. Keep your Scar or hide it.`;
    case "BALLAD":
      return "Toast somebody else. Sing nothing and nobody gets your Laurel.";
    case "FINAL":
      return "The night is over. Final standings.";
  }
}

// ---------------------------------------------------------------------------
// Dread
// ---------------------------------------------------------------------------

/**
 * The Dread reading for THIS table, and the words that go with it.
 *
 * DREAD_DOUBLE_AT, DREAD_TURN_AT and DREAD_MAX are the SOLO figures, kept for
 * the dailies and for the pages that want a number to print. A table's
 * thresholds scale with its head count, because Dread is generated per player
 * (see `dreadThresholds` in rules.ts). Reading the flat constants here printed a
 * one-player ceiling over a six-player night: the meter said 5 of 8 while the
 * party could carry 22, and it announced "everything costs more" three points
 * before the engine agreed. Every number on this panel was somebody else's game.
 */
export function dreadReading(
  dread: number,
  players: number
): { double: number; turn: number; max: number; doubled: boolean; turned: boolean; state: string } {
  const { double, turn, max } = dreadThresholds(players);
  const doubled = dread >= double;
  const turned = dread >= turn;
  return {
    double,
    turn,
    max,
    doubled,
    turned,
    state: turned
      ? "The night has turned"
      : doubled
        ? "Everything costs more"
        : "Steady, for now",
  };
}

/**
 * The collective count, its two published thresholds, and what each one does.
 *
 * Never colour alone: the number, a state word and the two thresholds are all
 * spelled out, so the bar is decoration on top of text that already says it.
 */
export function DreadMeter({ view }: { view: RoomView }) {
  const { double, turn, max, doubled, turned, state } = dreadReading(
    view.dread,
    view.players.length
  );
  const frac = Math.max(0, Math.min(1, view.dread / max));
  const tone = turned ? "bg-danger" : doubled ? "bg-warning" : "bg-success";
  return (
    <section
      aria-label="Party Dread"
      className="rounded-lg border border-border-dim bg-bg-1 p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-caps">Dread</span>
        <span className="num text-lg text-text-hi">
          {view.dread}
          <span className="text-text-low">/{max}</span>
        </span>
      </div>
      {/*
        Dread is on the screen for every phase of a run and was defined on none
        of them. A player who has not read the rules page watched a number climb
        and was never told what it counts, whose it is, or that anything can
        bring it down. Both directions, because the meter that only ever goes up
        is the one people stop reading.
      */}
      <p className="mt-1 text-xs text-text-mid">
        One number for the whole party: failures and kept Scars push it up, and an Act most
        of you clear brings it back down.
      </p>
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
          {doubled ? "Passed" : "At"} {double}: every Cost doubles, except on the Reckless
          line.
        </li>
        <li>
          {turned ? "Passed" : "At"} {turn}: the night turns, and the last Act comes from a
          worse deck.
        </li>
        {/* The scale itself, so nobody reads these against the solo figures the
            front page prints. Not "yours seats N": that sat a line under a seat
            count written "2 of 6" and was read as the room's capacity, when it
            is the head count these two figures were worked out from. */}
        <li>
          Both figures scale with the head count, and there are {view.players.length} of you.
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

/**
 * Kept, hidden and still undecided, counted apart.
 *
 * `viewFor` sends YOU your whole pile, wounds you have hidden and wounds you
 * have not decided included, and sends everybody else only the kept ones. The
 * rail printed `scars.length` as "Scars kept", so your own hidden Scar was
 * counted as worn and then counted a second time as "said nothing about", and an
 * undecided one was counted as worn before you had decided anything.
 */
export function scarTally(p: PlayerView): { kept: number; hidden: number; undecided: number } {
  return {
    kept: p.scars.filter((s) => s.kept === true).length,
    hidden: p.hiddenScarCount,
    undecided: p.scars.filter((s) => s.kept === null).length,
  };
}

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
          const scars = scarTally(p);
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
                {scars.kept + scars.hidden + scars.undecided > 0 && (
                  <p className="text-xs text-text-low">
                    {scars.kept} Scar{scars.kept === 1 ? "" : "s"} kept
                    {scars.hidden > 0 ? `, ${scars.hidden} said nothing about` : ""}
                    {scars.undecided > 0 ? `, ${scars.undecided} still to decide` : ""}
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

/**
 * The header strip: what is happening, which Act, what it wants of you, and how
 * long is left.
 *
 * THE SENTENCE USED TO BE READ ONLY TO SCREEN READERS. `phaseSentence` is the one
 * line that says what to do, it was written for exactly that job, and it was
 * piped into an aria-live region and shown to nobody. So a sighted player got a
 * two-word label and a clock: "The muster", ticking down, with nothing to press
 * and no way to know that was intended. The same phase told a screen reader
 * "nothing to press, the first draft opens on its own".
 *
 * It matters most where the label is least self-explanatory. Choosing your kit
 * does not tell you the draft runs in REVERSE, which is the whole trade the
 * Calling draft set up, and a player who misses it thinks the game shuffled them
 * for no reason.
 */
export function PhaseBar({ view }: { view: RoomView }) {
  const total = PHASE_MS[view.phase];
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-dim pb-3">
      <div className="min-w-0">
        <p className="label-caps">
          {view.act ? `Act ${view.act.index} of ${view.settings.acts}` : view.code}
        </p>
        <h1 className="font-display truncate text-xl text-text-hi sm:text-2xl">
          {PHASE_LABEL[view.phase]}
        </h1>
        <p className="mt-0.5 text-sm text-text-mid">{phaseSentence(view)}</p>
      </div>
      {view.phaseEndsAt !== null && total ? (
        <Timer endsAt={view.phaseEndsAt} totalMs={total} />
      ) : null}
    </div>
  );
}
