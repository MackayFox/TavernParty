"use client";

/**
 * THIS IS YOU. The panel that never scrolls away.
 *
 * The Deep Run put your abilities on the build screen and then replaced that
 * screen with the descent, so from the first floor onward the one thing you needed
 * in order to choose a door was the one thing you could not see. Adam's words:
 * "my character's stats and stuff should always be visible on desktop".
 *
 * On a wide screen this is a sticky column beside the room, so the room and the
 * doors and your sheet all fit without scrolling. On a narrow one it collapses to
 * a strip above the room, because a phone has no room for a column and a sticky
 * sidebar on a phone is just a thing covering the game.
 *
 * WHAT IT DELIBERATELY DOES NOT SHOW. The doors no longer print which ability they
 * lean on, because reading the room is the game. So this panel shows what you
 * BRING, and the mapping from a door to an ability is left to you. Showing your
 * Brawn is not a leak; showing that the third door is a Brawn door would be.
 */
import { Pill } from "@/components/ui";
import { ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
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

export function Adventurer({ sheet, compact = false }: { sheet: Sheet; compact?: boolean }) {
  const thin = sheet.vigour <= 2;

  /**
   * The narrow-screen version: the three facts you cannot choose a door without,
   * in one row above the room.
   *
   * Not the whole sheet, because on a phone the whole sheet above the room means
   * the room is below the fold, which is the problem this was meant to fix. The
   * full sheet is still there, under the doors, for anybody who wants to check
   * their Deft before deciding.
   */
  if (compact) {
    return (
      <section
        aria-label="Your character, in brief"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-strong bg-bg-1 px-3 py-2"
      >
        <span className="label-caps">{sheet.callingName}</span>
        <span className="num text-text-low">
          floor {sheet.floor}/{sheet.floors}
        </span>
        <span className={`num ml-auto ${thin ? "text-danger" : "text-text-hi"}`}>
          Vigour {sheet.vigour}
          {thin ? " · nearly done" : ""}
        </span>
        {sheet.knack && !sheet.knackSpent && <Pill tone="accent">{sheet.knack.label}</Pill>}
        {sheet.carrying.map((m) => (
          <Pill key={m} tone="accent">
            {m}
          </Pill>
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Your character"
      className="rounded-lg border border-border-strong bg-bg-1"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-dim px-3 py-2">
        <h2 className="font-display text-text-hi">{sheet.callingName}</h2>
        <span className="label-caps">
          Floor {sheet.floor} of {sheet.floors}
        </span>
      </header>

      {/* ---------------------------------------------------------- Vigour */}
      <div className="border-b border-border-dim px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-caps">Vigour</span>
          {/*
            The number and a word, never a bar on its own. A bar alone is state
            communicated by length, which is the same failure as state
            communicated by colour.
          */}
          <span className={`num text-2xl ${thin ? "text-danger" : "text-text-hi"}`}>
            {sheet.vigour}
            <span className="text-sm text-text-low"> of {sheet.baseVigour}</span>
          </span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-3"
          role="presentation"
        >
          <div
            className={`h-full ${thin ? "bg-danger" : "bg-accent"}`}
            style={{
              width: `${Math.max(0, Math.min(100, (sheet.vigour / Math.max(1, sheet.baseVigour)) * 100))}%`,
            }}
          />
        </div>
        {thin && <p className="mt-1 text-xs text-danger">One more bad floor and that is the night.</p>}
      </div>

      {/* -------------------------------------------------------- abilities */}
      <div className="border-b border-border-dim px-3 py-3">
        <p className="label-caps mb-2">What you bring</p>
        <ul className="grid grid-cols-3 gap-1.5">
          {sheet.abilities.map((ability) => {
            const score = sheet.scores[ability] ?? 0;
            const mod = abilityMod(score);
            const trained = sheet.affinities.includes(ability);
            const fromKit = sheet.kit
              .filter((k) => k.ability === ability)
              .reduce((t, k) => t + k.value, 0);
            const total = mod + (trained ? 2 : 0) + fromKit;
            return (
              <li
                key={ability}
                className={`rounded border px-1.5 py-1 text-center ${
                  trained ? "border-accent/60 bg-accent-dim" : "border-border-dim bg-bg-2"
                }`}
                /*
                 * ONE LABEL FOR THE WHOLE CELL, not a `title`.
                 *
                 * A title on a non-focusable list item is mouse-only: no touch
                 * gesture reaches it, it is not in the tab order, and screen
                 * readers do not reliably announce it. It sat here under a comment
                 * claiming it was "for anybody who cannot see the layout", which
                 * was the opposite of true. The three spans are marked hidden so
                 * the cell is read once, as a sentence, rather than as three
                 * fragments.
                 */
                aria-label={`${ABILITY_LABEL[ability]}: score ${score}${
                  trained ? ", trained" : ""
                }, so you bring ${total >= 0 ? "+" : ""}${total}`}
              >
                <span aria-hidden className="label-caps block text-[10px] leading-tight">
                  {ABILITY_LABEL[ability]}
                </span>
                <span aria-hidden className="num block text-lg leading-tight text-text-hi">
                  {total >= 0 ? "+" : ""}
                  {total}
                </span>
                <span aria-hidden className="block text-[10px] leading-tight text-text-low">
                  {score}
                  {trained ? " · trained" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* -------------------------------------------------------------- kit */}
      {sheet.kit.length > 0 && (
        <div className="border-b border-border-dim px-3 py-3">
          <p className="label-caps mb-1">Carrying</p>
          <ul className="space-y-0.5">
            {sheet.kit.map((k) => (
              <li key={k.name} className="text-sm text-text-mid">
                {k.name}
                {k.ability && (
                  <span className="num text-text-low">
                    {" "}
                    ({k.value >= 0 ? "+" : ""}
                    {k.value} {ABILITY_LABEL[k.ability]})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------- the knack */}
      {sheet.knack && (
        <div className="border-b border-border-dim px-3 py-3">
          <p className="label-caps mb-1">Your one trick</p>
          <p className="text-sm text-text-hi">
            {sheet.knack.label}{" "}
            {sheet.knackSpent ? (
              <Pill>spent</Pill>
            ) : (
              <Pill tone="accent">still in hand</Pill>
            )}
          </p>
          <p className="mt-1 text-xs text-text-mid">{sheet.knack.text}</p>
        </div>
      )}

      {/* ---------------------------------------------------------- marks */}
      {sheet.carrying.length > 0 && (
        <div className="px-3 py-3">
          <p className="label-caps mb-1">On you</p>
          <ul className="flex flex-wrap gap-1">
            {sheet.carrying.map((m) => (
              <li key={m}>
                <Pill tone="accent">{m}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-text-low">Some doors care about these.</p>
        </div>
      )}
    </section>
  );
}

/**
 * WHAT HAS ALREADY HAPPENED, compactly.
 *
 * One line per floor rather than the full paragraph each. The paragraphs used to
 * stack above the current room and push it off the screen, which is most of why
 * nothing fitted: by the fifth floor the thing you were doing was four screens
 * below the thing you had done. The prose has already been read once, in the
 * reveal, at the moment it mattered.
 */
export function Behind({
  lines,
  par,
}: {
  lines: { roomIndex: number; title: string; label: string; cleared: boolean; vigourSpent: number }[];
  par: number | null;
}) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="What has happened" className="rounded-lg border border-border-dim bg-bg-1">
      <header className="flex items-baseline justify-between gap-2 border-b border-border-dim px-3 py-2">
        <h2 className="label-caps">Behind you</h2>
        {par !== null && <span className="num text-xs text-text-low">par {par}</span>}
      </header>
      <ol className="divide-y divide-border-dim">
        {lines.map((line) => (
          <li key={line.roomIndex} className="flex items-baseline gap-2 px-3 py-1.5">
            <span className="num w-4 shrink-0 text-xs text-text-low">{line.roomIndex + 1}</span>
            <span
              className={`shrink-0 font-mono text-xs ${line.cleared ? "text-accent" : "text-danger"}`}
              aria-hidden
            >
              {line.cleared ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-mid">
              {line.title}
              <span className="text-text-low"> · {line.label}</span>
            </span>
            {/* "no" is not a status and a bare minus four is not a quantity. */}
            <span className="num shrink-0 text-xs text-text-low">
              {line.cleared ? "cleared" : "failed"}
              {line.vigourSpent > 0 ? ` · −${line.vigourSpent} Vigour` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
