"use client";

/**
 * ACT. The encounter, set on the dark.
 *
 * Three doors, one of them Reckless with its number behind glass. Everything a
 * player needs to make the bet is on this screen in words: what the door needs,
 * what it pays, what it costs, and who the table thinks ought to be taking it.
 */
import { useEffect, useState } from "react";
import { Avatar, Button, Pill } from "@/components/ui";
import { TAG_MEANING, isTag } from "@/lib/content/tags";
import { DIE_RULE, faceNeeded } from "@/lib/daily/core";
import { costMultiplier, sumLedger } from "@/lib/game/resolve";
import {
  ABILITY_LABEL,
  AFFINITY_BONUS,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKEN_VALUE,
  MARK_BONUS,
  MARK_FLINCH_PENALTY,
  NOMINATION_PENALTY,
  REVEAL_COST_TORCHES,
  SIGNATURE_BOOST,
  abilityMod,
  dreadThresholds,
} from "@/lib/game/rules";
import type { ApproachView, Calling, Modifier, SceneView } from "@/lib/game/types";
import { CALLING_BY_ID, KIT_BY_ID, meOf, nameOf, signed, type PhaseProps } from "./shared";

/**
 * What not moving costs you, worked out the way `resolveAct` works it out.
 *
 * Two things were wrong with the version this replaces, both of them making the
 * most consequential number on the screen too small.
 *
 * The multiplier was computed without `players`, and `costMultiplier` falls back
 * to the SOLO doubling threshold without it, so a six-handed table was told its
 * costs had doubled from Dread 3 when the engine does not double them until 8.
 *
 * And the Mark was added on afterwards at face value. The engine multiplies it
 * with the base, `(renown - markPenalty) * multiplier`, so a Marked player on
 * their Failing scene at a doubled table read "2 Renown off you, and 1 more for
 * the Mark" for a move that was about to take 8.
 *
 * No `approach`, deliberately: `resolveAct` costs a flinch with none either, so
 * the Reckless exemption never applies to standing still.
 */
export function flinchCost(input: {
  calling: Calling | undefined;
  scene: SceneView;
  dread: number;
  players: number;
  marked: boolean;
}): { renown: number; dread: number; multiplier: number } {
  const multiplier = costMultiplier({
    calling: input.calling,
    scene: input.scene,
    dread: input.dread,
    players: input.players,
  });
  return {
    renown: Math.abs((FLINCH_RENOWN - (input.marked ? MARK_FLINCH_PENALTY : 0)) * multiplier),
    dread: FLINCH_DREAD * multiplier,
    multiplier,
  };
}

/**
 * Your whole side of a roll before the die, named. The ledger doctrine, applied
 * before the throw instead of after it.
 *
 * The screen used to print `tn - bonus - tokens` and call it the face you
 * needed, which quietly dropped a Signature the player had already declared to
 * the entire table: `rollApproach` adds SIGNATURE_BOOST to the roll, so a
 * Chanter who had just spent the loudest thing they own was shown a target five
 * higher than the one about to be thrown at. It dropped the tokens too, the
 * moment you committed, because it zeroed the spend once `myChoice` came back.
 */
export function reachParts(input: {
  /** The sheet: ability modifier, training and Kit. */
  bonus: number;
  /** Hook tokens going onto this roll. */
  spending: number;
  /** A Signature already declared into this Act, or 0. */
  boost: number;
  signatureLabel?: string;
}): Modifier[] {
  const parts: Modifier[] = [{ label: "you", value: input.bonus }];
  if (input.spending > 0)
    parts.push({
      label: `${input.spending} Hook token${input.spending === 1 ? "" : "s"}`,
      value: input.spending * HOOK_TOKEN_VALUE,
    });
  if (input.boost > 0)
    parts.push({
      label: (input.signatureLabel ?? "your Signature").toLowerCase(),
      value: input.boost,
    });
  return parts;
}

/**
 * What you locked into an Act, remembered across a reload.
 *
 * `viewFor` redacts `act.spend` until the Act resolves and the engine does not
 * take the tokens off you until the window closes, so between committing and
 * resolving the server will not tell you what you spent and your token count
 * still reads full. The panel forgot the spend on every refresh, and the
 * arithmetic under each door quietly dropped it with them.
 *
 * ponytail: a crutch on the client, and it does not follow you to another
 * device. The fix is one line in `viewFor`: hand the viewer their own `spend`
 * entry the way it already hands them their own `myChoice`.
 */
const SPEND_KEY = (code: string, act: number) => `tp:spend:${code}:${act}`;

function rememberedSpend(code: string, act: number): number {
  try {
    const raw = window.sessionStorage.getItem(SPEND_KEY(code, act));
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    // Storage refused. Not a reason to fail to draw the encounter.
    return 0;
  }
}

function rememberSpend(code: string, act: number, tokens: number): void {
  try {
    window.sessionStorage.setItem(SPEND_KEY(code, act), String(tokens));
  } catch {
    // As above.
  }
}

export function Act({ view, post, busy }: PhaseProps) {
  const act = view.act;
  const me = meOf(view);
  const [spend, setSpend] = useState(0);
  /**
   * Read AFTER mount, never in a lazy initialiser.
   *
   * `useState(() => ...)` runs during render, and this reads sessionStorage,
   * which does not exist on the server. Since the room started server-rendering
   * its first snapshot, that made the first client render disagree with the
   * server's and React threw the whole tree away and rebuilt it. The effect runs
   * once after mount instead, so both renders start from the same nothing.
   */
  const [locked, setLocked] = useState<number | null>(null);
  useEffect(() => {
    setLocked(rememberedSpend(view.code, view.act?.index ?? 0));
  }, [view.code, view.act?.index]);
  const [nominated, setNominated] = useState<string | null>(null);

  if (!act) return null;
  /**
   * The scene as the server redacted it, not the authored one.
   *
   * This file used to import SCENES_BY_ID, which put all thirty scenes, their
   * prose and every hidden Reckless target number into the browser bundle while
   * the UI politely pretended not to know them.
   */
  const scene = act.scene;

  const calling = me?.callingId ? CALLING_BY_ID.get(me.callingId) : undefined;
  const kit = (me?.kitIds ?? []).map((id) => KIT_BY_ID.get(id)).filter((k) => !!k);
  const marked = act.marked.includes(view.me.id);
  const failingHere = !!calling && scene.tags.includes(calling.failing.tag);
  const chosen = act.myChoice ? scene.approaches.find((a) => a.id === act.myChoice) : undefined;
  const tokens = me?.hookTokens ?? 0;
  const torches = me?.torches ?? 0;
  /** The thresholds for THIS table, not the solo figures. See rules.ts. */
  const thresholds = dreadThresholds(view.players.length);
  /**
   * A Chanter's bet is already on the table and `rollApproach` adds it to the
   * roll, so the arithmetic under each door has to as well. It did not: a player
   * who had just spent the loudest thing they own was shown the number they
   * needed without it, which is not the number about to be thrown.
   */
  const boost = act.boosted.includes(view.me.id) ? SIGNATURE_BOOST : 0;
  /** Once you have moved, the tokens are locked in; before that, the widget. */
  // `locked` is null until the effect below reads it back, which is the state
  // BOTH the server and the first client render see. Falling back to zero keeps
  // the two identical instead of hydrating into a different tree.
  const spending = chosen ? (locked ?? 0) : spend;

  /** Everything you bring to a roll before the die and before tokens. */
  function bonusFor(approach: ApproachView): number {
    let total = me?.scores ? abilityMod(me.scores[approach.ability]) : 0;
    if (calling?.affinities.includes(approach.ability)) total += AFFINITY_BONUS;
    for (const item of kit) {
      if (item.bonus?.ability === approach.ability) total += item.bonus.value;
    }
    return total;
  }

  function reachOn(approach: ApproachView): Modifier[] {
    return reachParts({
      bonus: bonusFor(approach),
      spending,
      boost,
      signatureLabel: calling?.signature.label,
    });
  }

  const flinch = flinchCost({
    calling,
    scene,
    dread: view.dread,
    players: view.players.length,
    marked,
  });

  function costWords(approach: ApproachView): string {
    const mult = costMultiplier({
      calling,
      scene,
      dread: view.dread,
      players: view.players.length,
      approach,
    });
    const parts: string[] = [];
    if (approach.cost.renown > 0) parts.push(`${approach.cost.renown * mult} Renown`);
    if (approach.cost.dread > 0) parts.push(`${approach.cost.dread * mult} party Dread`);
    return parts.length > 0 ? parts.join(" and ") : "nothing but the story";
  }

  return (
    <div className="phase-in space-y-6">
      <section aria-label="The scene" className="tp-anim-reveal">
        <h2 className="font-display text-2xl text-text-hi sm:text-3xl">{scene.title}</h2>
        {/*
          Not a slug soup. TAG_MEANING exists for all twenty tags and was being
          used on the front page and the rules page but nowhere in the game, so
          the encounter was headed "CLERGY · DARK · OATH" with no gloss anywhere.
          Each meaning now sits beside its own tag: joined into one line under all
          three they read as a single run-on sentence about nothing, and the
          player still could not tell which half belonged to which word.
        */}
        <ul className="mt-2 space-y-1">
          {scene.tags.map((tag) => (
            <li key={tag} className="flex flex-wrap items-baseline gap-2">
              <Pill>{tag}</Pill>
              {isTag(tag) && <span className="text-xs text-text-low">{TAG_MEANING[tag]}</span>}
            </li>
          ))}
        </ul>
        <p className="prose-read mt-3">{scene.setup}</p>
      </section>

      <section aria-label="Who is Marked" className="rounded-lg border border-border-dim bg-bg-1 p-3">
        <h3 className="label-caps">Marked by this scene</h3>
        {act.marked.length === 0 ? (
          <p className="mt-1 text-sm text-text-mid">
            Nobody. This one is not about anybody's past.
          </p>
        ) : (
          <>
            <ul className="mt-2 flex flex-wrap gap-3">
              {act.marked.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <Avatar id={id} name={nameOf(view, id)} size={28} />
                  <span className="font-display text-sm text-text-hi">
                    {nameOf(view, id)}
                    {id === view.me.id ? " (you)" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-text-mid">
              Being Marked pays {MARK_BONUS} Renown for taking the Act at all, and costs{" "}
              {/* Multiplied, like the figure further down the screen. Printing the
                  raw constant here while the flinch line printed the scaled one
                  meant the same rule appeared twice with two different numbers. */}
              {MARK_FLINCH_PENALTY * flinch.multiplier} more than usual for not moving. It
              also refills your Hook tokens, because your own history has come round.
            </p>
          </>
        )}
      </section>

      {failingHere && (
        <p className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
          Your Failing is in this room. {calling?.failing.text} Failure costs you double.
        </p>
      )}
      {view.dread >= thresholds.double && (
        <p className="rounded-md border border-warning/60 px-3 py-2 text-sm text-warning">
          Dread is {view.dread}, and {thresholds.double} is where it starts to tell at a table
          of {view.players.length}. Every Cost is doubled, except on the Reckless line.
        </p>
      )}

      {chosen ? (
        <section
          aria-label="What you took"
          className="rounded-lg border border-accent bg-bg-1 p-4"
        >
          <p className="label-caps">You are committed</p>
          <p className="font-display mt-1 text-lg text-text-hi">{chosen.label}</p>
          <p className="mt-1 text-sm text-text-mid">
            {ABILITY_LABEL[chosen.ability]}
            {(locked ?? 0) > 0
              ? `, with ${locked} Hook token${locked === 1 ? "" : "s"} going with it`
              : ", with no Hook tokens on it"}
            . They come off you when the window closes, so your count above still reads
            full. Nothing is thrown until then, and the rest of the table is still
            deciding.
          </p>
        </section>
      ) : (
        <section aria-label="Spend Hook tokens" className="rounded-lg border border-border-dim bg-bg-1 p-3">
          <h3 className="label-caps">Hook tokens to spend</h3>
          <p className="mt-1 text-sm text-text-mid">
            Each one is worth {HOOK_TOKEN_VALUE} on the roll. You have {tokens}, and they
            only come back when a scene calls your Hook against you.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: tokens + 1 }, (_, n) => (
              <li key={n}>
                <button
                  type="button"
                  aria-pressed={spend === n}
                  // Without this the row reads out as three buttons called "0",
                  // "1" and "2", which is not a choice anybody can make.
                  aria-label={
                    n === 0
                      ? "Spend no Hook tokens"
                      : `Spend ${n} Hook token${n === 1 ? "" : "s"}, worth ${n * HOOK_TOKEN_VALUE} on the die`
                  }
                  onClick={() => setSpend(n)}
                  className={`min-h-11 min-w-11 rounded-md border px-3 font-mono ${
                    spend === n
                      ? "border-accent bg-accent text-ink font-bold"
                      : "border-border-strong text-text-hi"
                  }`}
                >
                  {spend === n ? `✓ ${n}` : n}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-text-hi">
            {spend === 0
              ? "Spending nothing."
              : `Spending ${spend}, worth ${signed(spend * HOOK_TOKEN_VALUE)} on the die.`}
          </p>
        </section>
      )}

      {/*
        The two Signatures that are declared while the Act is live. Both are
        bets: you call them before anybody knows the die, which is what makes
        them worth more than the six that answer a result.
      */}
      {calling && !me?.usedSignature && !act.boosted.includes(view.me.id) &&
        (calling.signature.kind === "addFive" || calling.signature.kind === "revealReckless") && (
          <section className="rounded-lg border border-accent/60 bg-bg-1 p-4">
            <p className="label-caps">Your Signature, once a night</p>
            <h3 className="font-display mt-1 text-lg text-accent">{calling.signature.label}</h3>
            <p className="mt-1 text-sm text-text-hi">
              {calling.signature.kind === "addFive"
                ? `Worth ${SIGNATURE_BOOST} on whatever you take next, and the whole table sees you call it. It has to be now: once you have moved it is too late.`
                : "Read the Reckless number without burning a Torch. Use it on the Act where you cannot tell whether the reward is worth it."}
            </p>
            <Button
              className="mt-3"
              disabled={busy || !view.me.id || (calling.signature.kind === "addFive" && !!chosen)}
              onClick={() => void post("/signature")}
            >
              {calling.signature.kind === "addFive" && chosen
                ? "Too late, you have moved"
                : `Call ${calling.signature.label}`}
            </Button>
          </section>
        )}

      {act.boosted.length > 0 && (
        <p className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent">
          {act.boosted.map((id) => nameOf(view, id)).join(", ")} called a Signature into this
          one. Whatever they take, they are backing it.
        </p>
      )}

      {/* The tap is final, and the token widget above is folded into it. */}
      <p className="rounded-md border border-border-strong bg-bg-1 px-3 py-2 text-sm text-text-hi">
        {chosen
          ? "You have moved. Nothing is thrown until the window closes."
          : "Whichever line you take is locked in, tokens and all. Set your tokens first."}
      </p>

      <section aria-label="The three ways through" className="space-y-3">
        {scene.approaches.map((approach) => {
          const parts = reachOn(approach);
          const reach = sumLedger(parts);
          const hidden = approach.reckless && act.recklessTn === null;
          const tn = approach.reckless ? act.recklessTn : approach.tn;
          // Floored at 2 and capped at 20 by `faceNeeded`, not at 1 and 20: a 1
          // always fails whatever the total, so "a 1 or better" is a promise the
          // server will not keep.
          const need = tn === null ? null : faceNeeded(tn, reach);
          return (
            <div
              key={approach.id}
              className={`rounded-lg border p-4 ${
                approach.reckless ? "border-danger/60 bg-bg-1" : "border-border-dim bg-bg-1"
              } ${chosen?.id === approach.id ? "border-accent" : ""}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg text-text-hi">{approach.label}</h3>
                {approach.reckless && <Pill tone="danger">Reckless, one player only</Pill>}
              </div>
              <p className="num mt-1 text-sm text-text-mid">
                {ABILITY_LABEL[approach.ability]} · you bring {signed(reach)} · needs{" "}
                {hidden ? "?" : tn}
                {need !== null ? ` · so a ${need} or better on the die` : ""}
              </p>
              {/* Never a bare figure: what you bring is the sum of named things. */}
              {parts.length > 1 && (
                <p className="num text-xs text-text-low">
                  {parts.map((part) => `${signed(part.value)} ${part.label}`).join(" · ")}
                </p>
              )}
              <p className="mt-2 text-sm text-text-hi">
                Wins {approach.deed} Renown. Fails and it costs {costWords(approach)}, and
                leaves a Scar.
              </p>
              {approach.reckless && (
                <p className="mt-2 text-sm text-text-mid">
                  Only one player can take this line, and the quicker hand wins it. Anybody
                  else who reached for it is moved to the door they are best at and the
                  party takes a point of Dread for the scramble.
                  {hidden ? " The number is behind glass until somebody pays to see it." : ""}
                  {/*
                    First contact with the word Torch used to be a dead button
                    reading "No torch left to burn", which tells somebody who has
                    never had one that they have run out of a thing they did not
                    know existed. Torches are only ever handed out by the Kit
                    draft, so a player carrying none cannot get one tonight and a
                    control is the wrong shape for that. The button is gone in
                    that case and this says where they come from instead.
                  */}
                  {hidden && torches < REVEAL_COST_TORCHES
                    ? " A torch buys a look at it, and the Kit draft is the only place torches come from. You are carrying none, so unless somebody else burns one this line is a bet in the dark."
                    : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="lg"
                  disabled={busy || !!chosen || !view.me.id}
                  onClick={() => {
                    const going = spend;
                    void post("/commit", {
                      approachId: approach.id,
                      spendTokens: going,
                    }).then((ok) => {
                      if (!ok) return;
                      setLocked(going);
                      rememberSpend(view.code, act.index, going);
                    });
                  }}
                >
                  {chosen?.id === approach.id ? "Taken" : "Take this line"}
                  {/* Three buttons named "Take this line" is three identical
                      entries in a screen reader's list of controls. The visible
                      words still lead, so speech input keeps working. */}
                  <span className="sr-only">: {approach.label}</span>
                </Button>
                {approach.reckless && hidden && torches >= REVEAL_COST_TORCHES && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void post("/reveal")}
                  >
                    Burn a torch to see it ({torches} left)
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-text-low">{DIE_RULE}</p>
      </section>

      <section aria-label="Nominate somebody" className="rounded-lg border border-border-dim bg-bg-1 p-3">
        <h3 className="label-caps">Put somebody else forward</h3>
        <p className="mt-1 text-sm text-text-mid">
          If they take the Act and pull it off you take half the credit. If they do not,
          you lose {NOMINATION_PENALTY} Renown for sending them.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {view.players
            .filter((p) => p.id !== view.me.id)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={nominated === p.id}
                  disabled={busy || !view.me.id}
                  onClick={() => {
                    void post("/nominate", { nomineeId: p.id }).then((ok) => {
                      if (ok) setNominated(p.id);
                    });
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 ${
                    nominated === p.id
                      ? "border-accent bg-accent-dim text-text-hi"
                      : "border-border-strong text-text-hi"
                  }`}
                >
                  <Avatar id={p.id} name={p.name} size={24} />
                  <span className="font-display text-sm">{p.name}</span>
                  {nominated === p.id && <span className="text-xs text-accent">✓ sent</span>}
                </button>
              </li>
            ))}
        </ul>
        {nominated && (
          <p className="mt-2 text-sm text-text-hi">
            You have put {nameOf(view, nominated)} forward. Everybody finds out when the
            Act resolves.
          </p>
        )}
      </section>

      <section aria-label="Who has moved" className="space-y-2">
        <h3 className="label-caps">
          Moved · {act.committed.length} of {view.players.length}
        </h3>
        <ul className="flex flex-wrap gap-3">
          {view.players.map((p) => {
            const done = act.committed.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2">
                <Avatar id={p.id} name={p.name} size={24} dimmed={!done} />
                <span className="text-xs text-text-mid">
                  {p.name} {done ? "has moved" : "is still deciding"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-text-mid">
          Do nothing and you Flinch, which right now is {flinch.renown} Renown off you and{" "}
          {flinch.dread} Dread on everybody. It is a move, not a pass.
          {marked
            ? ` ${MARK_FLINCH_PENALTY * flinch.multiplier} of that Renown is for being Marked and staying put.`
            : ""}
          {flinch.multiplier > 1
            ? ` Where this night has got to has multiplied all of it by ${flinch.multiplier}.`
            : ""}
        </p>
      </section>
    </div>
  );
}
