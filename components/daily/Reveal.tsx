"use client";

/**
 * WHAT JUST HAPPENED, ONE BEAT AT A TIME.
 *
 * The Deep Run used to resolve a floor by appending a finished paragraph to a list
 * above the room. Everything arrived at once, nothing moved, and on a phone the
 * result landed off the top of the screen: you pressed a door and the page sat
 * exactly where it was. Adam's words were that it did not feel interactive, and it
 * did not, because nothing about it was an event.
 *
 * So the outcome is an event now. You take a door, the die rolls, the things you
 * bring are counted onto it one at a time, the number you needed appears, and then
 * it either gives or it does not. Beat by beat, in front of you, with a button at
 * the end that takes you down.
 *
 * WHY A NATIVE `<dialog>` RATHER THAN A DIV WITH A HIGH Z-INDEX.
 *
 * `showModal()` gives focus containment, Escape, inertness of everything behind
 * it, and a backdrop, all from the platform and all correct. Every hand-rolled
 * modal I have seen gets at least one of those wrong, usually the focus trap, and
 * the failure mode is a keyboard user tabbing into a page that is not there.
 *
 * REDUCED MOTION IS NOT A SHORTER ANIMATION, IT IS NO ANIMATION. Somebody who has
 * asked for less movement gets the whole thing at once, immediately, and the
 * continue button straight away. They are not made to wait through beats they
 * cannot see the point of, which is what a "faster animation" would do.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Die } from "@/components/ui";
import { listOf, type Outcome } from "@/lib/daily/core";
import { playCleared, playFailed, playHurt, playRoll } from "./sfx";

export type RevealLine = {
  roomIndex: number;
  title: string;
  label: string;
  roll: number;
  mods: { label: string; value: number }[];
  total: number;
  tn: number | null;
  cleared: boolean;
  /**
   * HOW badly, not merely whether. A near miss and a catastrophe used to render
   * as the identical sentence, the identical colour and the identical bill,
   * which is the whole of "is it just the same loss however spectacularly I
   * fail?". They are three different events now and the screen says so.
   */
  outcome: Outcome;
  vigourSpent: number;
  vigourAfter: number;
  text: string;
  gained?: string[];
};

/** How long each beat holds, in milliseconds. Tuned by reading it out loud. */
const BEAT = {
  roll: 900,
  perMod: 420,
  needed: 520,
  outcome: 700,
} as const;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The beats, as a list, so the component is a cursor over it rather than a nest
 * of timeouts each knowing about the next one.
 *
 * A brace throws nothing, so it has no die and no sum: it goes straight to the
 * outcome. That is not a special case bolted on, it is the same list with the
 * middle missing.
 */
export type Beat = "rolling" | "die" | `mod-${number}` | "needed" | "outcome" | "prose";

export function beatsFor(line: RevealLine): Beat[] {
  const threw = line.roll > 0;
  const beats: Beat[] = [];
  if (threw) {
    beats.push("rolling", "die");
    line.mods.forEach((_, i) => beats.push(`mod-${i}` as Beat));
    if (line.tn !== null) beats.push("needed");
  }
  beats.push("outcome", "prose");
  return beats;
}

function holdFor(beat: Beat): number {
  if (beat === "rolling") return BEAT.roll;
  if (beat === "die") return BEAT.perMod;
  if (beat.startsWith("mod-")) return BEAT.perMod;
  if (beat === "needed") return BEAT.needed;
  if (beat === "outcome") return BEAT.outcome;
  return 0;
}

export function Reveal({
  line,
  floor,
  floors,
  onDone,
  doneLabel,
}: {
  line: RevealLine;
  /** 1-based, for the header. */
  floor: number;
  floors: number;
  onDone: () => void;
  doneLabel: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  /**
   * Focus the way on, when there is one.
   *
   * `autoFocus={done}` could never work: React honours autoFocus at mount and
   * `done` is false then. Worse, the skip button that held focus was replaced by
   * a span at the same instant the primary button stopped being disabled, so
   * focus fell to the body in the middle of a run. Now the skip button stays
   * mounted and disabled, and this moves focus deliberately.
   */
  const onward = useRef<HTMLButtonElement | null>(null);
  const beats = useMemo(() => beatsFor(line), [line]);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  /** How far through the beats we are. Everything on screen is derived from this. */
  const [at, setAt] = useState(reduced ? beats.length : 0);
  const skip = useCallback(() => setAt(beats.length), [beats.length]);

  // Open it as a modal on mount, and never as a non-modal: the whole point is
  // that the page behind it is inert while this is the thing happening.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);

  /**
   * Escape closes a native dialog on its own, which would leave the run showing
   * a floor that has already resolved. So Escape means "stop waiting", not
   * "cancel": it jumps to the end of the reveal, where the continue button is.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => {
      e.preventDefault();
      skip();
    };
    el.addEventListener("cancel", stop);
    return () => el.removeEventListener("cancel", stop);
  }, [skip]);

  useEffect(() => {
    if (at >= beats.length) onward.current?.focus();
  }, [at, beats.length]);

  // Walk the beats. One timer at a time, cleaned up on every step, so a fast
  // click on the skip button cannot leave a stray timeout behind.
  useEffect(() => {
    if (at >= beats.length) return;
    const id = window.setTimeout(() => setAt((n) => n + 1), holdFor(beats[at]));
    return () => window.clearTimeout(id);
  }, [at, beats]);

  // The two sounds that matter, each fired once, on the beat it belongs to.
  const played = useRef({ roll: false, outcome: false, hurt: false });
  const shown = beats.slice(0, at);
  const showDie = line.roll > 0 && (shown.includes("die") || at >= beats.length);
  /**
   * Which modifiers have been counted on, BY INDEX.
   *
   * By index rather than by value, because two of them can legitimately be
   * identical: "trained for this" and a piece of kit can both be +2, and an
   * identity check would reveal the second one the moment the first was due.
   */
  const modsShown = line.mods.map((mod, i) => ({
    mod,
    shown: at >= beats.length || shown.includes(`mod-${i}` as Beat),
  }));
  const showNeeded = line.tn !== null && (shown.includes("needed") || at >= beats.length);
  const showOutcome = shown.includes("outcome") || at >= beats.length;
  const ruined = line.outcome === "ruin";
  /**
   * The word, and it is the plain one. The flavour goes in the prose below; the
   * thing in the box has to be readable at a glance by somebody who is six
   * floors down and tired.
   */
  const verdict = line.cleared
    ? "The floor is cleared"
    : ruined
      ? "It goes badly wrong"
      : line.outcome === "near"
        ? "It does not open, and only just"
        : "It does not open";
  const showProse = shown.includes("prose") || at >= beats.length;
  const done = at >= beats.length;

  useEffect(() => {
    if (line.roll > 0 && !played.current.roll && (shown.includes("rolling") || done)) {
      played.current.roll = true;
      playRoll();
    }
    if (showOutcome && !played.current.outcome) {
      played.current.outcome = true;
      if (line.cleared) playCleared();
      else playFailed();
    }
    /*
     * The hit is its own sound, on its own condition. A brace always works and
     * always costs, so "it gave" and "it hurt" are not the same event and one
     * must not stand in for the other.
     */
    if (showOutcome && line.vigourSpent > 0 && !played.current.hurt) {
      played.current.hurt = true;
      playHurt();
    }
  }, [shown, showOutcome, done, line.roll, line.cleared, line.vigourSpent]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="reveal-title"
      className="tp-dialog w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border-strong bg-bg-1 p-0 text-text-hi backdrop:bg-scrim"
    >
      <div className="flex flex-col gap-3 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-dim pb-3">
          <p className="label-caps">
            Floor {floor} of {floors}
          </p>
          <h2 id="reveal-title" className="font-display text-lg text-text-hi">
            {line.label}
          </h2>
        </header>

        {/* ------------------------------------------------------- the throw */}
        {line.roll > 0 && (
          <div className="flex items-start gap-4">
            <Die face={showDie ? line.roll : 20} rolling={!showDie} size={56} />
            {/*
              NO HAND-WRITTEN DIE ROW HERE. The server already pushes the throw
              into `mods` as "d20" (lib/daily/deeprun.ts), so printing one of our
              own put the die in the column twice and the arithmetic stopped
              adding up in front of the player: "the die 10 / d20 +10 / brawn +3
              / trained +2 / Total 15". In the most expensive interaction in the
              product, on every check, on every floor.

              The ledger doctrine is that the total is the sum of the named
              things above it. One list, from the server, and nothing added.
            */}
            <dl className="min-w-0 flex-1">
              {modsShown
                .filter((m) => m.shown)
                .map(({ mod }, i) => (
                  <div
                    key={`${mod.label}-${i}`}
                    className="tp-anim-reveal flex items-baseline justify-between gap-3 border-b border-border-dim py-0.5"
                  >
                    <dt className="text-sm text-text-mid">{mod.label}</dt>
                    <dd className="num text-sm text-text-hi">
                      {mod.value >= 0 ? "+" : ""}
                      {mod.value}
                    </dd>
                  </div>
                ))}
              {showNeeded && (
                <div className="tp-anim-reveal mt-1 flex items-baseline justify-between gap-3">
                  <dt className="label-caps">Total</dt>
                  <dd className="num text-lg text-text-hi">{line.total}</dd>
                </div>
              )}
              {showNeeded && line.tn !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="label-caps">It wanted</dt>
                  <dd className="num text-lg text-text-hi">{line.tn}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* ----------------------------------------------------- the outcome */}
        {showOutcome && (
          <p
            className={`tp-anim-reveal font-display rounded-md border px-3 py-2 text-center text-xl uppercase ${
              line.cleared
                ? "border-accent bg-accent-dim text-text-hi"
                : ruined
                  ? "border-danger bg-danger/25 text-text-hi"
                  : "border-danger bg-danger/10 text-text-hi"
            }`}
          >
            {/*
              THE VISIBLE WORD IS THE CLEAR ONE.
              It used to say "It gives" while the live region six lines below
              said "Cleared", so the flavour went to the eyes and the plain
              English went to the screen reader. That is the inversion the
              codebase calls out in its own comments, and it was doing it here.
            */}
            <span aria-hidden>{line.cleared ? "✓ " : ruined ? "✕✕ " : "✕ "}</span>
            {verdict}
          </p>
        )}

        {/*
          THE LEDGER, OUT LOUD.

          This announced the verdict and the Vigour and stopped there, so a
          screen reader user got "Cleared" and never the roll, the modifiers, the
          total or the number it wanted. On screen that arithmetic is the whole
          teaching moment -- it is where a player learns that being trained is
          worth two and that the die was never the only thing in it -- and the
          house rule for the entire product is the ledger and never a bare total.
          Non-visually, only the outcome survived, which is precisely a bare
          total with the total taken out.

          Written once, on the last beat, rather than twice. It used to fire at
          the outcome beat and again at the prose beat with a superset string,
          because `holdFor("prose")` is 0, so two polite announcements queued 0ms
          apart on every single check.
        */}
        <p aria-live="polite" className="sr-only">
          {showProse
            ? [
                line.roll > 0 &&
                  `${modsShown.map(({ mod }) => `${mod.label} ${mod.value >= 0 ? "plus" : "minus"} ${Math.abs(mod.value)}`).join(", ")}, total ${line.total}${line.tn !== null ? ` against ${line.tn}` : ""}.`,
                `${line.cleared ? "Cleared" : ruined ? "Not cleared, and it went badly" : "Not cleared"}.`,
                line.vigourSpent > 0
                  ? `${line.vigourSpent} Vigour, ${line.vigourAfter} left.`
                  : `No Vigour lost, ${line.vigourAfter} left.`,
                line.text,
              ]
                .filter(Boolean)
                .join(" ")
            : ""}
        </p>

        {showOutcome && line.vigourSpent > 0 && (
          <p className="num tp-anim-reveal text-center text-danger">
            <span aria-hidden>✕ </span>
            {line.vigourSpent} Vigour, {line.vigourAfter} left
          </p>
        )}
        {showOutcome && line.vigourSpent === 0 && (
          <p className="num text-center text-text-low">Cost you nothing. {line.vigourAfter} Vigour.</p>
        )}

        {showProse && <p className="prose-read tp-anim-reveal">{line.text}</p>}

        {/*
          A MARK YOU WON AND A MARK YOU TOOK ARE NOT THE SAME EVENT.
          Both printed the same diamond in the same colour, separated only by a
          trailing clause, which is a glyph doing the wrong job in both
          directions. The whole point of a ruin's marks is that floor two shuts a
          door on floor five, so the moment one lands it has to read as damage.
        */}
        {showProse && (line.gained?.length ?? 0) > 0 && (
          <p
            className={`tp-anim-reveal text-sm ${line.cleared ? "text-text-hi" : "text-danger"}`}
          >
            <span aria-hidden>{line.cleared ? "◆ " : "✷ "}</span>
            You come away {listOf(line.gained ?? [])}
            {line.cleared
              ? "."
              : floor === floors
                ? ", and you carry it out with you."
                : ", and it is still true on the next floor."}
          </p>
        )}

        {/*
          THE HIT, ACROSS THE WHOLE SCREEN.
          A red vignette for half a second when Vigour goes, clear through the
          middle so the line you are reading stays readable. Decoration on top of
          the number, the sentence and the live region, never instead of them,
          and not rendered at all for somebody who asked for less movement.
        */}
        {showOutcome && line.vigourSpent > 0 && !reduced && (
          <span aria-hidden className={`tp-hurt${ruined ? " tp-ruin" : ""}`} />
        )}
        {/*
          A floor that gave and cost nothing gets the candle's wash instead. Only
          one of the two ever renders: a brace clears AND costs, and being told
          "you got hurt" is the more useful half of that.
        */}
        {showOutcome && line.cleared && line.vigourSpent === 0 && !reduced && (
          <span aria-hidden className="tp-lift" />
        )}

        <footer className="mt-1 flex items-center justify-between gap-3 border-t border-border-dim pt-3">
          {/*
            Skipping is a first-class control, not a courtesy. Somebody on their
            sixth floor of the night has seen the die land five times and should
            not have to sit through it, and somebody who reads faster than the
            timers should not be held back by them.
          */}
          {/*
            The skip stays mounted and goes disabled rather than being swapped for
            a span, because swapping it was what threw focus to the body. And the
            hint about Escape is ON the button, since it used to appear only after
            the beats had finished, which is exactly when Escape stopped doing
            anything.
          */}
          <button
            type="button"
            onClick={skip}
            disabled={done}
            className="min-h-11 px-2 text-sm text-text-mid underline hover:text-text-hi disabled:opacity-0"
          >
            Get on with it, or press Escape
          </button>
          <Button size="lg" onClick={onDone} disabled={!done} ref={onward}>
            {doneLabel}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
