"use client";

/**
 * ASSIGN. The biggest decision in the game, so it gets the biggest screen.
 *
 * The six house numbers are chips you pick up and put down on your own sheet.
 * They are held as indices into the house array rather than as values, because
 * the array can contain the same number twice and a duplicate must still be two
 * separate chips.
 */
import { useMemo, useState } from "react";
import { Button, ErrorNote, Pill, Sheet } from "@/components/ui";
import { HOOKS, HOOK_DETAIL } from "@/lib/content/hooks";
import { ABILITY_BLURB, ABILITY_LABEL, abilityMod } from "@/lib/game/rules";
import { ABILITIES, type Ability, type Scores } from "@/lib/game/types";
import { BLOOD_BY_ID, CALLING_BY_ID, KIT_BY_ID, meOf, signed, type PhaseProps } from "./shared";

type Slots = Record<Ability, number | null>;

const EMPTY: Slots = {
  brawn: null,
  deft: null,
  grit: null,
  wits: null,
  nerve: null,
  charm: null,
};

export function Assign({ view, post, busy }: PhaseProps) {
  const me = meOf(view);
  const array = view.houseArray ?? [];
  const calling = me?.callingId ? CALLING_BY_ID.get(me.callingId) : undefined;
  const blood = me?.bloodId ? BLOOD_BY_ID.get(me.bloodId) : undefined;
  const kit = (me?.kitIds ?? []).map((id) => KIT_BY_ID.get(id)).filter((k) => !!k);

  const [slots, setSlots] = useState<Slots>(() => fromScores(me?.scores ?? null, array));
  const [held, setHeld] = useState<number | null>(null);
  const [hookId, setHookId] = useState<string | null>(me?.hookId ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [handedIn, setHandedIn] = useState(false);

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

  /** Best numbers onto what you are trained for, then down the standard order. */
  function auto() {
    setProblem(null);
    setHandedIn(false);
    const order: Ability[] = calling
      ? [...calling.affinities, ...ABILITIES.filter((a) => !calling.affinities.includes(a))]
      : [...ABILITIES];
    const byValue = array.map((_, i) => i).sort((a, b) => array[b] - array[a]);
    const next = { ...EMPTY };
    order.forEach((ability, i) => {
      next[ability] = byValue[i] ?? null;
    });
    setSlots(next);
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
        Without this, "where should the 16 go?" has no basis at all, and the
        auto-place button is the only usable answer: a first-timer presses it and
        learns nothing. One sentence gives them a reason to disagree with it.
      */}
      <p className="rounded-md border border-border-strong bg-bg-1 px-3 py-2 text-sm text-text-hi">
        Every encounter offers three ways through and each one tests a different ability, so a
        high number is only worth what the night asks of it. Spread them and you are never
        stuck; spike them and you are the only person who can do one thing.
      </p>
      <p className="prose-read">
        Six numbers, one sheet. Pick a number up, then tap the ability you want it in.
        Tap a filled box to take the number back off.
      </p>

      <section aria-label="The house numbers" className="space-y-2">
        <h2 className="label-caps">
          Still to place · {tray.length} of {array.length}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {tray.map((i) => (
            <li key={i}>
              <button
                type="button"
                aria-pressed={held === i}
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
                {held === i && <span className="sr-only">in hand</span>}
              </button>
            </li>
          ))}
          {tray.length === 0 && (
            <li className="text-sm text-text-mid">All six placed.</li>
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

      <section aria-label="Choose a Hook" className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-text-hi">Where you have been</h2>
          <p className="prose-read mt-1">
            Your Hook puts one of its problems into everybody's night, and it hands you
            two tokens worth five apiece on a roll. They only ever refill when the night
            turns on you, so the people who can see your Hook decide when you are paid.
          </p>
        </div>
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
                  <h3 className="font-display text-text-hi">{hook.name}</h3>
                  <p className="mt-1 text-sm italic text-text-mid">{hook.blurb}</p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="danger">Puts {hook.insertTag} in the deck</Pill>
                    <Pill tone="success">Refills on {hook.callTag}</Pill>
                  </p>
                  <details className="mt-2">
                    <summary className="label-caps flex min-h-11 items-center text-accent">
                      The whole story
                    </summary>
                    <p className="mt-1 text-sm text-text-mid">{HOOK_DETAIL[hook.id]}</p>
                  </details>
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
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
                  ? "Ready."
                  : "Still needs a Hook."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Rebuild the chip layout from scores already on the server, if there are any. */
function fromScores(scores: Scores | null, array: readonly number[]): Slots {
  if (!scores) return { ...EMPTY };
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
