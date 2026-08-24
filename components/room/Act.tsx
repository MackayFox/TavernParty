"use client";

/**
 * ACT. The encounter, set on the dark.
 *
 * Three doors, one of them Reckless with its number behind glass. Everything a
 * player needs to make the bet is on this screen in words: what the door needs,
 * what it pays, what it costs, and who the table thinks ought to be taking it.
 */
import { useState } from "react";
import { Avatar, Button, Pill } from "@/components/ui";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import { costMultiplier } from "@/lib/game/resolve";
import {
  ABILITY_LABEL,
  AFFINITY_BONUS,
  DREAD_DOUBLE_AT,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKEN_VALUE,
  MARK_BONUS,
  MARK_FLINCH_PENALTY,
  NOMINATION_PENALTY,
  REVEAL_COST_TORCHES,
  abilityMod,
} from "@/lib/game/rules";
import type { ApproachDef } from "@/lib/game/types";
import { CALLING_BY_ID, KIT_BY_ID, meOf, nameOf, signed, type PhaseProps } from "./shared";

export function Act({ view, post, busy }: PhaseProps) {
  const act = view.act;
  const me = meOf(view);
  const [spend, setSpend] = useState(0);
  const [nominated, setNominated] = useState<string | null>(null);

  if (!act) return null;
  const scene = SCENES_BY_ID[act.sceneId];
  if (!scene) return null;

  const calling = me?.callingId ? CALLING_BY_ID.get(me.callingId) : undefined;
  const kit = (me?.kitIds ?? []).map((id) => KIT_BY_ID.get(id)).filter((k) => !!k);
  const marked = act.marked.includes(view.me.id);
  const failingHere = !!calling && scene.tags.includes(calling.failing.tag);
  const chosen = act.myChoice ? scene.approaches.find((a) => a.id === act.myChoice) : undefined;
  const tokens = me?.hookTokens ?? 0;
  const torches = me?.torches ?? 0;

  /** Everything you bring to a roll before the die and before tokens. */
  function bonusFor(approach: ApproachDef): number {
    let total = me?.scores ? abilityMod(me.scores[approach.ability]) : 0;
    if (calling?.affinities.includes(approach.ability)) total += AFFINITY_BONUS;
    for (const item of kit) {
      if (item.bonus?.ability === approach.ability) total += item.bonus.value;
    }
    return total;
  }

  function costWords(approach: ApproachDef): string {
    const mult = costMultiplier({ calling, scene, dread: view.dread, approach });
    const parts: string[] = [];
    if (approach.cost.renown > 0) parts.push(`${approach.cost.renown * mult} Renown`);
    if (approach.cost.dread > 0) parts.push(`${approach.cost.dread * mult} party Dread`);
    return parts.length > 0 ? parts.join(" and ") : "nothing but the story";
  }

  return (
    <div className="phase-in space-y-6">
      <section aria-label="The scene" className="tp-anim-reveal">
        <h2 className="font-display text-2xl text-text-hi sm:text-3xl">{scene.title}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {scene.tags.map((tag) => (
            <li key={tag}>
              <Pill>{tag}</Pill>
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
              {MARK_FLINCH_PENALTY} more than usual for not moving. It also refills your
              Hook tokens, because your own history has come round.
            </p>
          </>
        )}
      </section>

      {failingHere && (
        <p className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
          Your Failing is in this room. {calling?.failing.text} Failure costs you double.
        </p>
      )}
      {view.dread >= DREAD_DOUBLE_AT && (
        <p className="rounded-md border border-warning/60 px-3 py-2 text-sm text-warning">
          Dread is {view.dread}. Every Cost is doubled, except on the Reckless line.
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
            {spend > 0 ? `, with ${spend} Hook token${spend === 1 ? "" : "s"} spent` : ""}
            . Nothing is thrown until the window closes, so the rest of the table is
            still deciding.
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

      <section aria-label="The three ways through" className="space-y-3">
        {scene.approaches.map((approach) => {
          const bonus = bonusFor(approach);
          const hidden = approach.reckless && act.recklessTn === null;
          const tn = approach.reckless ? act.recklessTn : approach.tn;
          const need = tn === null ? null : tn - bonus - (chosen ? 0 : spend * HOOK_TOKEN_VALUE);
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
                {ABILITY_LABEL[approach.ability]} · you bring {signed(bonus)} · needs{" "}
                {hidden ? "?" : tn}
                {need !== null ? ` · so a ${Math.max(1, Math.min(20, need))} or better on the die` : ""}
              </p>
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
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="lg"
                  disabled={busy || !!chosen || !view.me.id}
                  onClick={() => void post("/commit", { approachId: approach.id, spendTokens: spend })}
                >
                  {chosen?.id === approach.id ? "Taken" : "Take this line"}
                </Button>
                {approach.reckless && hidden && (
                  <Button
                    variant="secondary"
                    disabled={busy || torches < REVEAL_COST_TORCHES}
                    onClick={() => void post("/reveal")}
                  >
                    {torches < REVEAL_COST_TORCHES
                      ? "No torch left to burn"
                      : `Burn a torch to see the number (${torches} left)`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
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
          Do nothing and you Flinch, which is {Math.abs(FLINCH_RENOWN)} Renown off you and{" "}
          {FLINCH_DREAD} Dread on everybody. It is a move, not a pass.
        </p>
      </section>
    </div>
  );
}
