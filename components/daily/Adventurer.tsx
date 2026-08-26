"use client";

/**
 * THIS IS YOU, and it is on paper.
 *
 * The tokens file's own doctrine is that the character sheet is the only light
 * surface in the product and that it always means "this is yours". The descent
 * was the one screen not honouring it: your abilities rendered as another dark
 * panel beside the room, indistinguishable at a glance from the thing trying to
 * kill you. So the sheet is parchment again, and it sits along the bottom edge of
 * the screen the way a real one sits on the table in front of you: always there,
 * never in the way, readable without being read.
 *
 * THREE PIECES, and each answers exactly one question.
 *
 *   AdventurerStrip  who am I, and what have I got left?   (always visible)
 *   DepthRail        where am I in the night?              (always visible)
 *   FullSheet        everything, plus what I have done.    (one tap)
 *
 * WHAT IT DELIBERATELY DOES NOT SHOW. The doors do not print which ability they
 * lean on, because reading the room is the game. So this shows what you BRING,
 * and the mapping from a door to an ability is left to you. Showing your Brawn
 * is not a leak; showing that the third door is a Brawn door would be.
 */
import { useEffect, useRef } from "react";
import { ABILITY_BLURB, ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";

export type Sheet = {
  callingName: string;
  callingBlurb: string;
  /** Ability order as the payload gives it, so this never assumes one. */
  abilities: readonly Ability[];
  /** Final score per ability, after the array, affinities and kit. */
  scores: Record<Ability, number>;
  affinities: Ability[];
  kit: { name: string; ability: Ability | null; value: number }[];
  knack: { label: string; text: string } | null;
  knackSpent: boolean;
  vigour: number;
  baseVigour: number;
  floor: number;
  floors: number;
  carrying: string[];
};

/** One resolved floor, in the shape both the rail and the ledger need. */
export type LedgerLine = {
  roomIndex: number;
  title: string;
  label: string;
  cleared: boolean;
  vigourSpent: number;
};

type Total = {
  ability: Ability;
  label: string;
  /** The ability score itself. The number you rolled and placed. */
  score: number;
  /** The number you actually bring: the modifier, training and kit. */
  total: number;
  trained: boolean;
  /** "16, trained", "12, +1 a coil of rope". What the total is made of. */
  from: string;
};

/**
 * What you bring, per ability, worked out once.
 *
 * It lived twice before, in the strip and in the panel, which is two chances to
 * disagree about a number the player is choosing doors on.
 */
function totals(sheet: Sheet): Total[] {
  return sheet.abilities.map((ability) => {
    const score = sheet.scores[ability] ?? 0;
    const trained = sheet.affinities.includes(ability);
    const kit = sheet.kit.filter((k) => k.ability === ability);
    const fromKit = kit.reduce((t, k) => t + k.value, 0);
    return {
      ability,
      label: ABILITY_LABEL[ability],
      score,
      total: abilityMod(score) + (trained ? 2 : 0) + fromKit,
      trained,
      from: [
        String(score),
        trained ? "trained" : null,
        ...kit.map((k) => `${signed(k.value)} ${k.name}`),
      ]
        .filter(Boolean)
        .join(", "),
    };
  });
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

/**
 * YOUR SHEET, PEEKING OVER THE TABLE EDGE.
 *
 * One row on a desktop, two or three on a phone, and the same component either
 * way: there is no `lg:` fork here and there should never be one again. The old
 * screen rendered a full sticky panel on wide and a different compact strip on
 * narrow, which is two layouts to keep true about one character.
 *
 * Everything on it is a fact you need in order to choose a door. Everything you
 * need only sometimes is behind "Full sheet".
 */
export function AdventurerStrip({ sheet, onOpen }: { sheet: Sheet; onOpen: () => void }) {
  const thin = sheet.vigour <= 2;
  const pct = Math.max(0, Math.min(100, (sheet.vigour / Math.max(1, sheet.baseVigour)) * 100));
  return (
    <footer
      aria-label="Your character"
      className="sheet tp-strip flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2"
    >
      <div className="min-w-0">
        {/* "Calling" is the product's word and the build screen teaches it, but
            the strip is glanced at rather than read, so it uses the plain one. */}
        <span className="sheet-label block">Who you are</span>
        <span className="font-display block truncate text-base leading-tight text-paper-ink">
          {sheet.callingName}
        </span>
      </div>

      {/* ---------------------------------------------------------- Vigour */}
      {/*
        VIGOUR IS HEALTH, AND THE STRIP HAS TO SAY SO.
        The word is the product's own vocabulary and it stays, but a player on
        their first night has no reason to know that the number next to it is the
        one standing between them and the end of the run. So the label carries the
        plain word too, and the whole block reads as one sentence to a screen
        reader.
      */}
      {/*
        `role="group"` is load-bearing. ARIA forbids naming a generic element, so
        every browser drops an aria-label on a bare div, and everything carrying
        the actual number below is aria-hidden. Without the role a screen reader
        got the words "Vigour (health)" and no value at all, in the one panel that
        is on screen the whole way down.
      */}
      <div
        role="group"
        aria-label={`Vigour, your health: ${sheet.vigour} of ${sheet.baseVigour}${thin ? ", nearly done" : ""}`}
      >
        <span className="sheet-label block">Vigour (health)</span>
        <div aria-hidden className="flex items-center gap-2">
          {/*
            Keyed on the value so it re-enters every time it changes: losing
            three Vigour should be something you SEE happen, not a number that
            was one thing and is now another. The number and the word are the
            state; the movement is decoration laid over them.
          */}
          <span
            key={sheet.vigour}
            className={`num tp-anim-reveal text-lg leading-none ${
              thin ? "text-paper-danger" : "text-paper-ink"
            }`}
          >
            {sheet.vigour}
            <span className="text-[11px] font-normal text-paper-ink-mid"> of {sheet.baseVigour}</span>
          </span>
          <span
            role="presentation"
            className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-paper-rule"
          >
            <span
              className={`block h-full rounded-full ${thin ? "bg-paper-danger" : "bg-paper-ink"}`}
              style={{
                width: `${pct}%`,
                transition: "width var(--tp-dur-emphatic) var(--tp-ease-out)",
              }}
            />
          </span>
          {/* Never the bar on its own, and never the colour on its own. */}
          {thin && <span className="sheet-label text-paper-danger">nearly done</span>}
        </div>
      </div>

      {/* ------------------------------------------------------- abilities */}
      <ul className="flex flex-wrap gap-1.5" aria-label="What you bring">
        {totals(sheet).map((t) => (
          <li
            key={t.ability}
            className="sheet-box min-w-11 px-2 py-0.5 text-center"
            aria-label={`${t.label}: ${t.from}, so you bring ${signed(t.total)}`}
          >
            <span aria-hidden className="sheet-label block leading-tight">
              {/* Training is a mark, not a tint: a star a phone can render. */}
              {t.trained && <span className="mr-0.5">&#10022;</span>}
              {t.label}
            </span>
            {/*
              SCORE BIG, MODIFIER SMALL, in that order, because that is what a
              character sheet has looked like for fifty years and this is the
              one surface in the product that is trying to look like one.
              Adam: "shouldn't the main text be the stat value? Feels backwards."

              It was the other way round on a real argument, which is worth
              recording because it loses: the doors deliberately do not say which
              ability they lean on, so the number a player actually decides with
              is what they BRING, not what they scored. That is true and it does
              not matter, because a number in the position where everybody has
              always read a score will be read as a score whatever it is.
              Fighting a convention that strong to save one inference is a bad
              trade.

              The modifier stays signed and legible rather than shrinking to a
              footnote, because it is not decoration: with training and kit on
              top, twelve Brawn brings plus five, and somebody reading "12" as
              "average" would be wrong about the only thing that reaches a die.
            */}
            <span aria-hidden className="num block text-base leading-tight text-paper-ink">
              {t.score}
            </span>
            <span aria-hidden className="num block text-[11px] leading-tight text-paper-ink-mid">
              {signed(t.total)}
            </span>
          </li>
        ))}
      </ul>

      {sheet.knack && (
        <span className="sheet-label rounded-full border border-paper-rule bg-paper-field px-2.5 py-1">
          One trick {sheet.knackSpent ? "· spent" : "· in hand"}
        </span>
      )}

      {sheet.carrying.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="On you">
          {sheet.carrying.map((m) => (
            <li
              key={m}
              className="sheet-label rounded-full border border-paper-rule bg-paper-field px-2.5 py-1"
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="ml-auto min-h-11 rounded-sm border border-paper-ink px-3 hover:bg-paper-rule/60"
      >
        <span className="sheet-label text-paper-ink">
          Full sheet <span aria-hidden>&#9656;</span>
        </span>
      </button>
    </footer>
  );
}

/**
 * WHERE YOU ARE IN THE NIGHT, spatially.
 *
 * This replaces a permanently visible list of everything that had already
 * happened. That list was three facts per floor stacked beside a room which only
 * ever needed one of them, and by the fifth floor it was taller than the game. A
 * column of nodes down the left edge says the same thing at no reading cost: a
 * tick for cleared, a cross for failed, and the candle is where you are standing.
 *
 * Every node is a button and every one of them opens the sheet, because the
 * question a rail provokes is "what happened on floor two", and the answer has to
 * be one tap away rather than nowhere.
 */
export function DepthRail({
  floors,
  lines,
  current,
  onOpen,
}: {
  floors: number;
  lines: LedgerLine[];
  /** Zero-based index of the floor being faced, or -1 once the run is over. */
  current: number;
  onOpen: () => void;
}) {
  return (
    <nav
      aria-label="The descent so far"
      className="absolute bottom-0 left-0 top-0 z-10 flex w-11 flex-col items-center justify-center sm:w-14"
    >
      {Array.from({ length: floors }, (_, i) => {
        const past = lines[i];
        const here = i === current;
        const tone = past
          ? past.cleared
            ? "border-accent/60 text-accent"
            : "border-danger/60 text-danger"
          : here
            ? "tp-anim-candle border-accent text-text-hi"
            : "border-border-dim text-text-low";
        /*
         * FOUR GLYPHS, so the rail never leans on hue or on movement.
         *
         * The candle pulse marks where you are standing, and under
         * prefers-reduced-motion that pulse is switched off, which used to leave
         * the accent border doing the job by itself. A filled diamond says the
         * same thing at a glance, in the dark, in greyscale, and still. The floor
         * number is not lost: the scene eyebrow above prints "Floor 3 of 6".
         */
        const glyph = past ? (past.cleared ? "✓" : "✕") : here ? "◆" : String(i + 1);
        return (
          <span key={i} className="flex flex-col items-center">
            {i > 0 && <span aria-hidden className="h-4 w-px bg-border-dim" />}
            <button
              type="button"
              onClick={onOpen}
              aria-label={
                past
                  ? `Floor ${i + 1}, ${past.title}, ${
                      past.cleared ? "cleared" : "failed"
                    }. Open your sheet.`
                  : here
                    ? `Floor ${i + 1}, where you are. Open your sheet.`
                    : `Floor ${i + 1}, below you. Open your sheet.`
              }
              /*
               * The disc is 28px because a column of six of them down the edge of
               * a phone should not be a wall of buttons. The TARGET is 44, which
               * is the rule, so the button is 44 and the disc inside it is drawn
               * at 28. Every other control in this screen already does this.
               */
              className="grid h-11 w-11 place-items-center"
            >
              <span
                aria-hidden
                className={`num grid h-7 w-7 place-items-center rounded-full border bg-bg-1 text-xs ${tone}`}
              >
                {glyph}
              </span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}

/**
 * WHAT HAS ALREADY HAPPENED, one line per floor.
 *
 * The prose has been read once already, in the reveal, at the moment it mattered.
 * This is the record: which door, whether it gave, and what it cost.
 */
export function Ledger({ lines, par }: { lines: LedgerLine[]; par: number | null }) {
  if (lines.length === 0) {
    return <p className="text-sm text-paper-ink-mid">Nothing yet. The first floor is waiting.</p>;
  }
  return (
    <>
      {par !== null && (
        <p className="sheet-label mb-1">
          Par tonight <span className="num">{par}</span>
        </p>
      )}
      <ol>
        {lines.map((line) => (
          <li
            key={line.roomIndex}
            className="flex items-baseline gap-2 border-b border-paper-rule/60 py-1.5"
          >
            <span className="num w-4 shrink-0 text-xs text-paper-ink-mid">{line.roomIndex + 1}</span>
            <span aria-hidden className="num shrink-0 text-xs text-paper-ink">
              {line.cleared ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-paper-ink">
              {line.title}
              <span className="text-paper-ink-mid"> &middot; {line.label}</span>
            </span>
            {/* "no" is not a status and a bare minus four is not a quantity. */}
            <span className="num shrink-0 text-xs text-paper-ink-mid">
              {line.cleared ? "cleared" : "failed"}
              {line.vigourSpent > 0 ? ` · −${line.vigourSpent} Vigour` : ""}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * EVERYTHING THAT IS YOURS, AND EVERYTHING YOU HAVE DONE, in one overlay.
 *
 * A native `<dialog>`, for the same reason the reveal is one: focus containment,
 * Escape, inertness of the game behind it and a backdrop, all from the platform
 * and all correct. Every hand-rolled overlay gets at least one of those wrong,
 * usually the focus trap.
 */
export function FullSheet({
  sheet,
  lines,
  par,
  onClose,
}: {
  sheet: Sheet;
  lines: LedgerLine[];
  par: number | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  /**
   * `onClose` behind a ref so the effect below can be mount-only.
   *
   * The parent passes a fresh arrow every render, so depending on it would make
   * the effect re-run constantly, and this effect calls `showModal`.
   */
  const closer = useRef(onClose);
  closer.current = onClose;

  /**
   * ESCAPE IS `cancel`, NEVER `close`, AND THAT DISTINCTION IS THE WHOLE BUG.
   *
   * The dialog has to tell React when the platform dismisses it, because Escape
   * closes a native dialog on its own and the overlay would otherwise stay
   * mounted as a sheet nobody could see or reopen.
   *
   * Listening for `close` looked like the way to hear that. It is not, because
   * `close` ALSO fires when we close it ourselves in cleanup, and it fires
   * ASYNCHRONOUSLY: the spec queues it as a task rather than dispatching it then
   * and there. React mounts effects, and in development mounts them a second
   * time to flush out exactly this class of thing, so the real sequence was
   * open, cleanup, close(), open again, and only THEN the queued close event
   * from the first teardown landing on the freshly attached listener. It called
   * onClose, `sheetOpen` went back to false in the same tick it went true, and
   * from the outside the button simply did nothing. Removing the listener before
   * closing does not help, because the event outlives the swap.
   *
   * `cancel` fires only when the USER dismisses it and never for a programmatic
   * close, which is the exact question being asked. It is also what
   * `Reveal.tsx` has always used, which is why the reveal never had this bug and
   * this did.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dismissed = () => closer.current();
    el.addEventListener("cancel", dismissed);
    if (!el.open) el.showModal();
    return () => {
      el.removeEventListener("cancel", dismissed);
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      /*
       * Clicking the dark outside it closes it, which is the gesture everybody
       * tries first on a phone. The handler is on the dialog itself and fires
       * only when the target IS the dialog, which for a native <dialog> means
       * the backdrop rather than anything inside it.
       */
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="tp-dialog sheet w-[min(40rem,calc(100vw-2rem))] p-4 backdrop:bg-scrim sm:p-6"
    >
      {/*
        The close control is sticky, because this panel scrolls and on a small
        screen the button had gone off the top by the time you reached the
        ledger. A modal you have to scroll back up to leave is a modal people
        describe as not working.
      */}
      <header className="sticky -top-4 z-10 -mx-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-paper-rule bg-paper px-4 pb-3 pt-1 sm:-top-6 sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <p className="sheet-label">
            Your sheet &middot; Floor {sheet.floor} of {sheet.floors}
          </p>
          <h2 id="sheet-title" className="font-display text-2xl text-paper-ink">
            {sheet.callingName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="min-h-11 rounded-sm border border-paper-ink px-3 hover:bg-paper-rule/60"
        >
          <span className="sheet-label text-paper-ink">Close</span>
        </button>
      </header>

      <p className="mt-3 text-paper-ink">{sheet.callingBlurb}</p>

      <p className="sheet-label mt-4">Vigour, which is your health</p>
      <p className="text-paper-ink">
        <span className="num">{sheet.vigour}</span> of {sheet.baseVigour}. Every floor takes some,
        whether the door gives or not, and at nothing you do not come back up.
      </p>

      {/*
        ROWS, NOT A THREE COLUMN GRID.

        Each of these cells carries a label, two numbers, what the total is made
        of, and a sentence explaining what the ability means. In three columns on
        a phone that is about a hundred pixels of width per cell for a sentence,
        which is where the full sheet fell apart: the text wrapped to a column
        one or two words wide and the six cells grew to different heights.

        A row gets the whole width and reads at any size, and it puts the numbers
        in a column you can scan down, which is what a character sheet is for.
      */}
      <ul className="mt-4 divide-y divide-paper-rule/60 border-y border-paper-rule/60">
        {totals(sheet).map((t) => (
          <li
            key={t.ability}
            className="flex items-baseline gap-3 py-2"
            aria-label={`${t.label}: ${t.from}, so you bring ${signed(t.total)}. ${ABILITY_BLURB[t.ability]}`}
          >
            <span aria-hidden className="sheet-label w-16 shrink-0">
              {t.trained && <span className="mr-0.5">&#10022;</span>}
              {t.label}
            </span>
            <span aria-hidden className="num w-8 shrink-0 text-right text-lg text-paper-ink">
              {t.score}
            </span>
            <span aria-hidden className="num w-10 shrink-0 text-right text-lg text-paper-ink">
              {signed(t.total)}
            </span>
            <span aria-hidden className="min-w-0 flex-1 text-sm leading-snug text-paper-ink-mid">
              {ABILITY_BLURB[t.ability]}
              {t.from.includes(",") ? ` (${t.from})` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p aria-hidden className="sheet-label mt-1">
        Score, then what you bring to a roll. &#10022; means trained.
      </p>

      {sheet.kit.length > 0 && (
        <>
          <p className="sheet-label mt-4">Carrying</p>
          <p className="text-paper-ink">
            {sheet.kit.map((k, i) => (
              <span key={k.name}>
                {i > 0 && <span className="text-paper-ink-mid"> &middot; </span>}
                {k.name}
                {k.ability && (
                  <span className="num text-xs text-paper-ink-mid">
                    {" "}
                    ({signed(k.value)} {ABILITY_LABEL[k.ability]})
                  </span>
                )}
              </span>
            ))}
          </p>
        </>
      )}

      {sheet.knack && (
        <>
          <p className="sheet-label mt-4">Your one trick</p>
          <p className="text-paper-ink">
            {sheet.knack.label}. {sheet.knack.text}{" "}
            <span className="text-paper-ink-mid">
              {sheet.knackSpent ? "Spent tonight." : "Still in hand."}
            </span>
          </p>
        </>
      )}

      {sheet.carrying.length > 0 && (
        <>
          <p className="sheet-label mt-4">On you</p>
          <p className="text-paper-ink">{sheet.carrying.join(", ")}. Some doors care about these.</p>
        </>
      )}

      <p className="sheet-label mt-5 border-t border-paper-rule pt-4">The ledger, behind you</p>
      <div className="mt-1">
        <Ledger lines={lines} par={par} />
      </div>
    </dialog>
  );
}
