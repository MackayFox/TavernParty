"use client";

/**
 * THIS IS YOU, ON THE LONG WAY DOWN, and it is on paper.
 *
 * The Deep Run learned this first: your character is a thing you glance at
 * twenty times a night and read properly twice, so it belongs on parchment along
 * the bottom edge of the screen where a real sheet sits on the table, and
 * everything you need only sometimes belongs one tap behind it.
 *
 * Longway was the last screen not doing that. It stacked the sheet, the running
 * totals, the five faces and the Act down one column, which meant deciding a
 * door was: read the door, scroll up for the faces, scroll up further for your
 * Dread, scroll back down. Adam, having played it: "still had to do a lot of
 * scrolling back and forth to make my decisions."
 *
 * WHAT IS SHARED WITH THE DESCENT AND WHAT IS NOT. The arithmetic (`totals`),
 * the ability rows and the dialog shell all come from `components/daily/
 * Adventurer`, because a second hand-rolled overlay is a second chance to get
 * focus containment wrong and the `cancel`-not-`close` bug is written down there
 * in full. What is local is the contents: the descent has Vigour, floors and a
 * knack; this has Renown, Dread, Hook tokens and five faces you can see coming.
 *
 * WHY THE FIVE FACES ARE ON THE STRIP AND THE ABILITY BOXES ARE TOO. Knowing
 * that Act 4 is an 18 is the whole plan, so it cannot live above the fold. The
 * ability boxes are arguably redundant here, because unlike the descent these
 * doors say which ability they lean on and print your reach already; they stay
 * because a character bar without the character's numbers is not the thing this
 * borrows, and because the reach on a door does not tell you WHY it is what it
 * is.
 */
import { useEffect, useState } from "react";
import { AbilityRows, SheetDialog, signed, totals, type Brings } from "@/components/daily/Adventurer";
import { DIE_RULE } from "@/lib/daily/core";
import { TAG_MEANING, isTag } from "@/lib/content/tags";
import { DREAD_DOUBLE_AT, HOOK_TOKEN_VALUE } from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";

/**
 * Say what a tag means rather than printing the slug, the way the Act does on the
 * dark and the Callings page does in the rules. The tags decide what Marks you
 * and which scene doubles your costs, so an Act headed "CLERGY · OATH" with no
 * gloss anywhere hid the two rules the player is being asked to plan around.
 * Falls back to the slug because these arrive as plain strings from the route.
 */
export const tagMeaning = (tag: string): string => (isTag(tag) ? TAG_MEANING[tag] : tag);

/**
 * "a thief scene", "an uncanny scene". The tags are data and half of them start
 * with a vowel, so the article cannot be written into the sentence: the sheet
 * read "Failing, on a uncanny scene".
 */
const article = (word: string): string => {
  const first = word[0]?.toLowerCase() ?? "";
  // `"aeiou".includes("")` is true, so the empty case has to be asked first.
  return first && "aeiou".includes(first) ? "an" : "a";
};

/** Everything about the character that does not change during the night. */
export type Who = {
  callingName: string;
  affinities: [Ability, Ability];
  failingTag: string;
  failingText: string;
  kitName: string;
  kitBlurb: string;
  kitBonus: { ability: Ability; value: number } | null;
  hookName: string;
  hookBlurb: string;
  scores: Record<Ability, number>;
};

/**
 * Everything that does.
 *
 * `act` and `acts` used to live here as well, and they were both derivable from
 * these two: the Act you are on is `spent + 1` and there are as many Acts as
 * there are faces. Two spellings of one fact can disagree, and this pair did:
 * the object is built above the render guard, so before the payload lands it
 * said "Act 1 of 0". Derived at the point of use now, where it cannot.
 */
export type Standing = {
  renown: number;
  dread: number;
  tokens: number;
  /** Tonight's five, in order, and how many have already been spent. */
  faces: number[];
  spent: number;
};

/** The Act being faced, one-based, and how many there are. */
function actOf(standing: Standing): { act: number; acts: number } {
  const acts = standing.faces.length;
  return { act: Math.min(standing.spent + 1, acts), acts };
}

/**
 * One resolved Act, in the shape the ledger behind you needs.
 *
 * One `outcome` rather than a `success` boolean beside a `flinched` boolean.
 * Both readers below already treated this as three-valued, and two booleans is
 * four states for three meanings: `{flinched: true, success: true}` was
 * representable and meaningless. The engine agrees it is a three-way, and
 * renders it as one in the share line.
 */
export type ActLine = {
  index: number;
  doorLabel: string;
  outcome: "worked" | "failed" | "flinched";
  renownDelta: number;
};

/**
 * The character, in the shape `totals` and `AbilityRows` want.
 *
 * The ability ORDER is whatever the payload gave, which for this daily is by
 * descending score. That is a deliberate reading order and not an accident, so
 * it is preserved rather than sorted into the canonical one.
 */
export function bringsOf(who: Who): Brings {
  return {
    callingName: who.callingName,
    abilities: Object.keys(who.scores) as Ability[],
    scores: who.scores,
    affinities: who.affinities,
    kit: [
      {
        name: who.kitName,
        ability: who.kitBonus?.ability ?? null,
        value: who.kitBonus?.value ?? 0,
      },
    ],
  };
}

/** The three ways an Act ends, said as a shape and as a word. */
const OUTCOME_GLYPH: Record<ActLine["outcome"], string> = {
  worked: "✓",
  failed: "✕",
  flinched: "○",
};
const OUTCOME_WORD: Record<ActLine["outcome"], string> = {
  worked: "worked · ",
  failed: "did not · ",
  flinched: "",
};

/**
 * A number with its name beside it.
 *
 * BESIDE, not over. Label-over-number is the sheet's grammar and it is what the
 * boxes do, but four of them stacked that way is two lines of height each, and
 * on a 390px phone the strip came out at seven hundred pixels of a
 * eight-hundred-pixel screen: the bar meant to keep the game visible was
 * covering it. These four are read as a sentence rather than scanned as a
 * column, so they get one line between them.
 */
function Stat({
  label,
  value,
  note,
  warn = false,
}: {
  label: string;
  value: number | string;
  /** "doubled". The thing the number on its own does not say. */
  note?: string;
  warn?: boolean;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="sheet-label">{label}</span>{" "}
      <span className="num text-base leading-none text-paper-ink">{value}</span>
      {note ? (
        <span className={`sheet-label ml-1 ${warn ? "text-paper-danger" : "text-paper-ink-mid"}`}>
          {note}
        </span>
      ) : null}
    </span>
  );
}

/**
 * TONIGHT'S FIVE, at a glance.
 *
 * Not the `Die` component: that one is drawn for the dark and carries its own
 * critical and fumble verdicts underneath, which on parchment reads as a
 * different product and adds a line of height to a bar that has none to give.
 * A face is a number in a box here, like every other number on the sheet.
 */
function Faces({
  faces,
  spent,
  label = "Tonight's five",
}: {
  faces: number[];
  spent: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="sheet-label shrink-0">{label}</span>
      <ul className="flex gap-1">
        {faces.map((face, i) => {
          const gone = i < spent;
          const here = i === spent;
          return (
            <li
              key={i}
              /*
               * Three states and never by tint alone: a spent face is struck
               * through, the one in hand is ringed, and the rest are plain. Both
               * marks are shapes rather than colours, and the accessible name
               * says which of the three it is in words.
               */
              className={`sheet-box num min-w-7 px-1 py-0.5 text-center text-sm leading-tight ${
                here ? "border-paper-ink ring-1 ring-paper-ink" : ""
              } ${gone ? "text-paper-ink-mid line-through" : "text-paper-ink"}`}
              aria-label={`Act ${i + 1}, a ${face}${gone ? ", already spent" : here ? ", this Act" : ", still to come"}`}
            >
              <span aria-hidden>{face}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * YOUR SHEET, PEEKING OVER THE TABLE EDGE.
 *
 * One layout at every size, exactly as the descent's strip insists on: there is
 * no `lg:` fork here and there should not be one, because two layouts is two
 * chances to disagree about one character.
 */
export function NightStrip({
  who,
  standing,
  onOpen,
}: {
  who: Who;
  standing: Standing;
  onOpen: () => void;
}) {
  const doubling = standing.dread >= DREAD_DOUBLE_AT;
  const { act, acts } = actOf(standing);
  /**
   * Open on a wide screen, closed on a phone, and a tap either way.
   *
   * Driven from JS rather than a `sm:` class because a closed `<details>` hides
   * its own children through the UA's slot, which no `display` rule can undo:
   * CSS can hide the summary on a wide screen but cannot force the panel open.
   * Media-query state is the honest version of the same intent.
   *
   * Starts closed so the server and the phone agree; the effect opens it before
   * anybody on a desktop has read a word.
   */
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return (
    <footer aria-label="Your character" className="sheet tp-strip px-3 py-2">
      {/*
        A REFERENCE PANEL MUST NOT OUTRANK THE DECISION.

        Measured on an iPhone-sized screen: this strip was 229px of an 844px
        viewport -- 27%, and more like 35% once real browser chrome is counted --
        and all four doors of Act 1 began at y=875. Every choice in the game was
        below the fold, under a panel you need once per Act, on the screen where
        the only thing to do is pick one.

        So on a phone it opens closed: one line with the two numbers that change,
        and a tap for the rest. From `sm` up nothing changes, because there the
        space was never contested.

        `<details>` rather than a state hook: it is a disclosure, and the native
        one brings keyboard operation, the right roles and Escape for free. The
        `sm:` rules force it permanently open on a wide screen without the marker
        or the summary showing.
      */}
      <details className="group [&[open]>summary]:mb-2" open={wide || open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 sm:hidden">
          <span className="truncate">
            <span className="font-display text-base text-paper-ink">{who.callingName}</span>{" "}
            <span className="sheet-label">Act</span>{" "}
            <span className="num text-paper-ink">{act}</span>
            <span className="sheet-label">/{acts}</span>{" "}
            <span className="sheet-label">Renown</span>{" "}
            <span className="num text-paper-ink">{standing.renown}</span>{" "}
            <span className="sheet-label">Dread</span>{" "}
            <span className={`num ${doubling ? "text-paper-danger" : "text-paper-ink"}`}>
              {standing.dread}
            </span>
            {doubling ? <span className="sheet-label text-paper-danger"> doubled</span> : null}
          </span>
          <span className="sheet-label shrink-0 text-paper-ink">
            <span className="group-open:hidden">Your sheet &#9662;</span>
            <span className="hidden group-open:inline">Hide &#9652;</span>
          </span>
        </summary>

      {/* THREE LINES, and they are in the order you need them: who and where,
          what you bring, what is still to come. Every one of them wraps rather
          than scrolls, so nothing on the strip can ever be off the edge. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* "Calling" is the product's word and the rule line teaches it, but the
            strip is glanced at rather than read, so it uses the plain one. The
            descent's strip labels it the same way. */}
        <span className="whitespace-nowrap">
          <span className="sheet-label">Who you are</span>{" "}
          <span className="font-display text-base leading-tight text-paper-ink">
            {who.callingName}
          </span>
        </span>
        <Stat label="Act" value={`${act} of ${acts}`} />
        <Stat label="Renown" value={standing.renown} />
        {/* The word "doubled" does the work, not the colour: at three, every cost
            in the night doubles bar the Reckless door, and that is the single
            most expensive fact on this bar. */}
        <Stat label="Dread" value={standing.dread} note={doubling ? "doubled" : undefined} warn={doubling} />
        <Stat label="Hook tokens" value={standing.tokens} />
      </div>

      <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="What you bring">
        {totals(bringsOf(who)).map((t) => (
          <li
            key={t.ability}
            className="sheet-box min-w-11 flex-1 px-1 py-0.5 text-center"
            aria-label={`${t.label}: ${t.from}, so you bring ${signed(t.total)}`}
          >
            <span aria-hidden className="sheet-label block leading-tight">
              {/* Training is a mark, not a tint: a star a phone can render. */}
              {t.trained && <span className="mr-0.5">&#10022;</span>}
              {t.label}
            </span>
            {/* Score big, modifier small, in that order, because that is what a
                character sheet has looked like for fifty years and this is the
                one surface in the product trying to look like one. */}
            <span aria-hidden className="num block text-sm leading-tight text-paper-ink">
              {t.score}
            </span>
            <span aria-hidden className="num block text-[11px] leading-tight text-paper-ink-mid">
              {signed(t.total)}
            </span>
          </li>
        ))}
      </ul>

      {/*
        THE STAR SAYS "TRAINED", AND IT HAS TO SAY SO HERE.
        The sheet this replaced spelled the word out on every trained box, on the
        argument that nothing else on the page explains why two of the six
        numbers are worth more than they look. A bare mark with its legend one
        tap away inside the full sheet is that decision quietly reverted, so the
        legend comes out here, next to the marks it is about.
      */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="sheet-label">&#10022; trained</span>
        <Faces faces={standing.faces} spent={standing.spent} />
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto min-h-11 rounded-sm border border-paper-ink px-3 hover:bg-paper-rule/60"
        >
          <span className="sheet-label text-paper-ink">
            Full sheet <span aria-hidden>&#9656;</span>
          </span>
        </button>
      </div>
      </details>
    </footer>
  );
}

/**
 * EVERYTHING THAT IS YOURS, AND EVERY ACT YOU HAVE SPENT, in one overlay.
 *
 * The shell is the descent's, so Escape, the backdrop, focus containment and
 * inertness of the page behind all behave the same way in both games.
 */
export function NightSheet({
  who,
  standing,
  lines,
  onClose,
}: {
  who: Who;
  standing: Standing;
  lines: ActLine[];
  onClose: () => void;
}) {
  const doubling = standing.dread >= DREAD_DOUBLE_AT;
  const { act, acts } = actOf(standing);
  return (
    <SheetDialog
      label={`Your sheet · Act ${act} of ${acts}`}
      title={who.callingName}
      onClose={onClose}
    >
      <AbilityRows who={bringsOf(who)} />

      <p className="sheet-label mt-4">Where you stand</p>
      <p className="text-paper-ink">
        <span className="num">{standing.renown}</span> Renown, which is the score, and{" "}
        <span className="num">{standing.dread}</span> Dread.{" "}
        {doubling
          ? `At ${DREAD_DOUBLE_AT} every cost in the night is doubled, bar the Reckless door, and it does not come back down.`
          : `At ${DREAD_DOUBLE_AT} every cost doubles, bar the Reckless door.`}{" "}
        <span className="num">{standing.tokens}</span> Hook tokens left, worth{" "}
        <span className="num">{HOOK_TOKEN_VALUE}</span> each on a roll.
      </p>

      <div className="mt-4">
        <Faces
          faces={standing.faces}
          spent={standing.spent}
          label="Tonight's five, already thrown"
        />
      </div>
      <p className="sheet-label mt-1">
        Struck through is spent. The ringed one is this Act. Knowing them is the game.
      </p>
      {/* The rule the shell prints under every other dice row. It is written out
          here rather than borrowed from `DieRule`, which is styled for the dark
          and would arrive as grey text on parchment. */}
      <p className="sheet-label mt-1">{DIE_RULE}</p>

      <p className="sheet-label mt-4">Carrying</p>
      <p className="text-paper-ink">
        {who.kitName}. {who.kitBlurb}
      </p>

      <p className="sheet-label mt-4">Hook: your backstory</p>
      <p className="text-paper-ink">
        {who.hookName}. {who.hookBlurb}
      </p>

      <p className="sheet-label mt-4">
        Failing, on {article(who.failingTag)} {who.failingTag} scene
      </p>
      {/* The meaning first, then the Calling's own line, which is the order the
          Callings page uses. Knowing which of tonight's five Acts is the bad one
          is the whole plan, and it cannot depend on having read the rules page
          for the slug. */}
      <p className="text-paper-ink">
        {tagMeaning(who.failingTag)}. {who.failingText}
      </p>

      <p className="sheet-label mt-5 border-t border-paper-rule pt-4">The Acts behind you</p>
      <div className="mt-1">
        {lines.length === 0 ? (
          <p className="text-sm text-paper-ink-mid">Nothing yet. The first Act is waiting.</p>
        ) : (
          <ol>
            {lines.map((line) => (
              <li
                key={line.index}
                className="flex items-baseline gap-2 border-b border-paper-rule/60 py-1.5"
              >
                <span className="num w-4 shrink-0 text-xs text-paper-ink-mid">{line.index}</span>
                {/* Three glyphs, not two. Standing still is not a failed check,
                    it is a move somebody chose, and a cross against it reads as
                    the game telling them off for it. */}
                <span aria-hidden className="num shrink-0 text-xs text-paper-ink">
                  {OUTCOME_GLYPH[line.outcome]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-paper-ink">
                  {line.doorLabel}
                </span>
                {/* "no" is not a status and a bare minus two is not a quantity.
                    A flinch prints no verdict, because the door label already
                    says "Did not move" and it was saying it twice. */}
                <span className="num shrink-0 text-xs text-paper-ink-mid">
                  {OUTCOME_WORD[line.outcome]}
                  {signed(line.renownDelta)} Renown
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SheetDialog>
  );
}
