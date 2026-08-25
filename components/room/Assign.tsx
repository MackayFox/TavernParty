"use client";

/**
 * ASSIGN. The biggest decision in the game, so it gets the biggest screen.
 *
 * The six house numbers are chips you pick up and put down on your own sheet.
 * They are held as indices into the house array rather than as values, because
 * the array can contain the same number twice and a duplicate must still be two
 * separate chips.
 *
 * THE SEVENTY SECONDS. This screen used to open empty: six blank boxes and
 * twenty backgrounds, each with a name, a line, two tags and a disclosure, and a
 * clock. Nobody reads twenty Hooks in seventy seconds, so nobody read any of
 * them, and running out of clock handed you a Hook drawn at random by `beginRun`
 * with no warning anywhere that it would.
 *
 * The fix is the framing, not the clock, which lives in rules.ts and is not
 * ours: the screen opens with a whole character already on it, placed the way
 * `defaultScores` would place it and carrying a suggested past, and the seventy
 * seconds are spent disagreeing with it rather than producing it from nothing.
 * Twenty cards are behind one tap instead of in front of you. Nothing here is
 * mandatory reading, and what the deadline does is written on the screen.
 */
import { useMemo, useState } from "react";
import { Button, ErrorNote, Pill, Sheet, hashOf } from "@/components/ui";
import { HOOKS, HOOK_DETAIL } from "@/lib/content/hooks";
import { TAG_MEANING, isTag } from "@/lib/content/tags";
import { ABILITY_BLURB, ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import { ABILITIES, type Ability, type Calling, type Scores } from "@/lib/game/types";
import { BLOOD_BY_ID, CALLING_BY_ID, KIT_BY_ID, meOf, signed, type PhaseProps } from "./shared";

type Slots = Record<Ability, number | null>;

/** `Hook.insertTag` and `callTag` are plain strings on the type. Say the word. */
const tagMeaning = (tag: string) => (isTag(tag) ? TAG_MEANING[tag] : tag);

const EMPTY: Slots = {
  brawn: null,
  deft: null,
  grit: null,
  wits: null,
  nerve: null,
  charm: null,
};

/**
 * Best numbers onto what you are trained for, then down the standard order.
 *
 * Deliberately the same policy as `defaultScores` in the engine, which is what
 * the deadline applies to anybody who hands in nothing. The screen opening on it
 * means the suggestion you are looking at is the one you will get.
 */
export function autoSlots(array: readonly number[], calling: Calling | undefined): Slots {
  const order: Ability[] = calling
    ? [...calling.affinities, ...ABILITIES.filter((a) => !calling.affinities.includes(a))]
    : [...ABILITIES];
  const byValue = array.map((_, i) => i).sort((a, b) => array[b] - array[a]);
  const next = { ...EMPTY };
  order.forEach((ability, i) => {
    next[ability] = byValue[i] ?? null;
  });
  return next;
}

/**
 * The past this screen opens on.
 *
 * Spread across the table by a hash of the player's own id rather than given to
 * everybody as HOOKS[0]: the twenty insert tags are a permutation of the whole
 * tag vocabulary, so a table that all defaulted to the same Hook would build a
 * deck out of one problem repeated. It is named on screen, it is changeable for
 * the whole window, and it is the same on every render, which is the difference
 * between a suggestion and the silent draw the deadline used to make.
 */
export function suggestedHookId(playerId: string): string {
  return HOOKS[hashOf(playerId) % HOOKS.length].id;
}

export function Assign({ view, post, busy }: PhaseProps) {
  const me = meOf(view);
  const array = view.houseArray ?? [];
  const calling = me?.callingId ? CALLING_BY_ID.get(me.callingId) : undefined;
  const blood = me?.bloodId ? BLOOD_BY_ID.get(me.bloodId) : undefined;
  const kit = (me?.kitIds ?? []).map((id) => KIT_BY_ID.get(id)).filter((k) => !!k);

  const [slots, setSlots] = useState<Slots>(() =>
    me?.scores ? fromScores(me.scores, array) : autoSlots(array, calling)
  );
  const [held, setHeld] = useState<number | null>(null);
  const [hookId, setHookId] = useState<string | null>(
    () => me?.hookId ?? (view.me.id ? suggestedHookId(view.me.id) : null)
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [handedIn, setHandedIn] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  const used = useMemo(
    () => new Set(ABILITIES.map((a) => slots[a]).filter((i): i is number => i !== null)),
    [slots]
  );
  const tray = array.map((_, i) => i).filter((i) => !used.has(i));

  function place(ability: Ability) {
    setProblem(null);
    setHandedIn(false);
    setSlots((current) => {
      // Tapping a filled box with nothing in hand takes the number back off.
      if (held === null) return { ...current, [ability]: null };
      const next = { ...current };
      for (const a of ABILITIES) if (next[a] === held) next[a] = null;
      next[ability] = held;
      return next;
    });
    setHeld(null);
  }

  function auto() {
    setProblem(null);
    setHandedIn(false);
    setSlots(autoSlots(array, calling));
    setHeld(null);
  }

  async function submit() {
    const scores = {} as Scores;
    for (const a of ABILITIES) {
      const index = slots[a];
      if (index === null) {
        setProblem(
          "Every one of the six numbers goes in a box, and no box is left empty. Nothing is thrown away and nothing is invented."
        );
        return;
      }
      scores[a] = array[index];
    }
    // The array is the array. Belt and braces: the server checks this too.
    const mine = ABILITIES.map((a) => scores[a]).sort((x, y) => x - y);
    const house = [...array].sort((x, y) => x - y);
    if (mine.length !== house.length || mine.some((v, i) => v !== house[i])) {
      setProblem(
        `Those are not the numbers the house rolled. You may rearrange ${house.join(", ")} and nothing else.`
      );
      return;
    }
    if (!hookId) {
      setProblem("Choose a Hook. It is the part of you that turns up in everybody else's night.");
      return;
    }
    setProblem(null);
    if (await post("/assign", { scores, hookId })) setHandedIn(true);
  }

  const chosenHook = hookId ? HOOKS.find((h) => h.id === hookId) : undefined;

  return (
    <div className="phase-in space-y-6">
      {/*
        The four things a first-timer needs and had none of: what this is, what
        to do, that the clock is real, and what the clock does if they let it
        run. The last one was the worst of it, because the answer was a Hook
        drawn at random and nothing said so.
      */}
      <section
        aria-label="What this screen is"
        className="rounded-md border border-border-strong bg-bg-1 px-3 py-2 text-sm text-text-hi"
      >
        <p>
          Here is a whole character, already filled in. Your best numbers are on what your
          Calling is trained for, and a past has been suggested. Change any of it, or leave
          it, then hand the sheet in.
        </p>
        <p className="mt-2 text-text-mid">
          Hand in nothing before the clock runs out and the house keeps this placement and
          picks your past for you at random, which is very unlikely to be the one below.
          One tap on the button at the bottom is enough to stop that.
        </p>
      </section>
      <p className="prose-read">
        Every encounter offers three ways through and each one tests a different ability, so a
        high number is only worth what the night asks of it. Spread them and you are never
        stuck; spike them and you are the only person who can do one thing.
      </p>

      <Sheet
        title={me?.name ?? "Your sheet"}
        subtitle={[calling?.name, blood?.name].filter(Boolean).join(" · ") || "Your sheet"}
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ABILITIES.map((ability) => {
            const index = slots[ability];
            const value = index === null ? null : array[index];
            return (
              <li key={ability}>
                <button
                  type="button"
                  onClick={() => place(ability)}
                  aria-label={
                    value === null
                      ? `${ABILITY_LABEL[ability]}, empty. ${ABILITY_BLURB[ability]}`
                      : `${ABILITY_LABEL[ability]}, ${value}, worth ${signed(abilityMod(value))}. ${ABILITY_BLURB[ability]}`
                  }
                  className={`sheet-box flex min-h-20 w-full flex-col items-center justify-center gap-0.5 px-2 py-2 ${
                    value === null ? "border-dashed" : ""
                  }`}
                >
                  <span className="sheet-label">{ABILITY_LABEL[ability]}</span>
                  <span className="num text-2xl leading-none text-paper-ink">
                    {value ?? "·"}
                  </span>
                  <span className="sheet-label">
                    {value === null ? "empty" : signed(abilityMod(value))}
                  </span>
                  {/*
                    ABILITY_BLURB was in the aria-label and nowhere else, so a
                    sighted first-timer placing six numbers was shown "GRIT / 14
                    / +2" with no idea what Grit is for, on the biggest screen in
                    the game. The rare inverted accessibility bug.
                  */}
                  <span className="mt-1 block text-[11px] leading-tight text-paper-ink-mid">
                    {ABILITY_BLURB[ability]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-paper-rule pt-3 text-sm text-paper-ink">
          {calling && (
            <div>
              <dt className="sheet-label">Signature, once a night</dt>
              <dd>{calling.signature.label}</dd>
            </div>
          )}
          {blood && (
            <div>
              <dt className="sheet-label">{blood.name}</dt>
              <dd>{blood.powerText}</dd>
            </div>
          )}
          {kit.map((item) => (
            <div key={item.id}>
              <dt className="sheet-label">Carrying</dt>
              <dd>
                {item.name}
                {item.bonus
                  ? `, ${ABILITY_LABEL[item.bonus.ability]} +${item.bonus.value}`
                  : ""}
              </dd>
            </div>
          ))}
          {chosenHook && (
            <div>
              <dt className="sheet-label">Hook</dt>
              <dd>{chosenHook.name}</dd>
            </div>
          )}
        </dl>
      </Sheet>

      {/*
        Below the sheet rather than above it, because the sheet now arrives full:
        the tray is where a number goes when you take it back off, not where the
        screen starts.
      */}
      <section aria-label="The house numbers" className="space-y-2">
        <h2 className="label-caps">
          In your hand · {tray.length} of {array.length}
        </h2>
        <p className="text-sm text-text-mid">
          Tap a box on the sheet to take its number back off. Pick a number up here, then tap
          the ability you want it in.
        </p>
        <ul className="flex flex-wrap gap-2">
          {tray.map((i) => (
            <li key={i}>
              <button
                type="button"
                aria-pressed={held === i}
                aria-label={`${array[i]}, worth ${signed(abilityMod(array[i]))}`}
                onClick={() => setHeld(held === i ? null : i)}
                className={`flex min-h-14 min-w-14 flex-col items-center justify-center rounded-md border-2 px-2 ${
                  held === i
                    ? "border-accent bg-accent-dim"
                    : "border-border-strong bg-bg-2"
                }`}
              >
                <span className="num text-2xl text-text-hi">{array[i]}</span>
                <span className="num text-[10px] text-text-mid">
                  {signed(abilityMod(array[i]))}
                </span>
                {/* Visible, not sr-only: "which one am I holding" was carried by
                    a border colour and nothing else for everybody who can see. */}
                {held === i && <span className="num text-[10px] text-accent">in hand</span>}
              </button>
            </li>
          ))}
          {tray.length === 0 && (
            <li className="text-sm text-text-mid">Nothing in your hand. All six are placed.</li>
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={auto}>
            Put my best where I am trained
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSlots(EMPTY);
              setHeld(null);
              setHandedIn(false);
            }}
          >
            Clear the sheet
          </Button>
        </div>
      </section>

      <section aria-label="Choose a Hook" className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-text-hi">Where you have been</h2>
          <p className="prose-read mt-1">
            Your Hook puts one of its problems into everybody's night, and it hands you
            two tokens worth five apiece on a roll. They only ever refill when the night
            turns on you, so the people who can see your Hook decide when you are paid.
          </p>
        </div>

        {/*
          One card, then a door to the other nineteen. Twenty of these on screen
          at once is more reading than the window holds, and a screen nobody can
          finish is a screen nobody starts.
        */}
        {chosenHook && !browsing && (
          <div className="rounded-lg border border-accent bg-bg-1 p-3">
            <p className="label-caps">Yours, unless you say otherwise</p>
            <HookBody hook={chosenHook} />
          </div>
        )}

        <Button
          variant="secondary"
          aria-expanded={browsing}
          onClick={() => setBrowsing(!browsing)}
        >
          {browsing ? "Close the list" : `Look at all ${HOOKS.length} pasts`}
        </Button>

        {browsing && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {HOOKS.map((hook) => {
              const chosen = hookId === hook.id;
              return (
                <li key={hook.id}>
                  <div
                    className={`h-full rounded-lg border bg-bg-1 p-3 ${
                      chosen ? "border-accent" : "border-border-dim"
                    }`}
                  >
                    <HookBody hook={hook} />
                    <button
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => {
                        setHookId(hook.id);
                        setProblem(null);
                        setHandedIn(false);
                      }}
                      className={`mt-3 min-h-11 w-full rounded-md border px-3 font-display ${
                        chosen
                          ? "border-accent bg-accent text-ink font-semibold"
                          : "border-border-strong text-text-hi"
                      }`}
                    >
                      {chosen ? "✓ This is your history" : "Choose this"}
                      {/* Twenty buttons called "Choose this" is twenty identical
                          entries in a screen reader's control list. */}
                      <span className="sr-only">: {hook.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 space-y-2 border-t border-border-dim bg-bg-0 py-3">
        <ErrorNote message={problem} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={busy} onClick={() => void submit()}>
            {handedIn ? "Hand the sheet in again" : "Hand the sheet in"}
          </Button>
          <p className="text-sm text-text-mid">
            {handedIn
              ? "Handed in. You can still change it until the window closes."
              : tray.length > 0
                ? `${tray.length} number${tray.length === 1 ? "" : "s"} still in your hand.`
                : hookId
                  ? "Ready. Hand it in and the deadline cannot pick for you."
                  : "Still needs a Hook."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One Hook, read the same way whether it is yours or one you are considering. */
function HookBody({ hook }: { hook: (typeof HOOKS)[number] }) {
  return (
    <>
      <h3 className="font-display text-text-hi">{hook.name}</h3>
      <p className="mt-1 text-sm italic text-text-mid">{hook.blurb}</p>
      {/*
        The two facts a Hook is actually chosen on, and both of them were a bare
        slug: "Puts CORPSE in the deck" is not something anybody can weigh in
        seventy seconds. The slug stays, because it is the word the Act screen
        prints on a scene and the two have to read as the same thing, and the
        gloss sits beside its own tag rather than in one joined line under both.
      */}
      <ul className="mt-2 space-y-1">
        <li className="flex flex-wrap items-baseline gap-2">
          <Pill tone="danger">Puts {hook.insertTag} in the deck</Pill>
          <span className="text-xs text-text-mid">{tagMeaning(hook.insertTag)}</span>
        </li>
        <li className="flex flex-wrap items-baseline gap-2">
          <Pill tone="success">Refills on {hook.callTag}</Pill>
          <span className="text-xs text-text-mid">{tagMeaning(hook.callTag)}</span>
        </li>
      </ul>
      <details className="mt-2">
        <summary className="label-caps flex min-h-11 items-center text-accent">
          The whole story
          <span className="sr-only">: {hook.name}</span>
        </summary>
        <p className="mt-1 text-sm text-text-mid">{HOOK_DETAIL[hook.id]}</p>
      </details>
    </>
  );
}

/** Rebuild the chip layout from scores already on the server. */
function fromScores(scores: Scores, array: readonly number[]): Slots {
  const taken = new Set<number>();
  const next = { ...EMPTY };
  for (const ability of ABILITIES) {
    const index = array.findIndex((v, i) => v === scores[ability] && !taken.has(i));
    if (index >= 0) {
      taken.add(index);
      next[ability] = index;
    }
  }
  return next;
}
