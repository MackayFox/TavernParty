"use client";

/**
 * DRAFT_CALLING and DRAFT_KIT.
 *
 * One interaction, twice: rank up to three, hand it in, and the tick serves the
 * table in priority order. The only difference is the pool and the direction,
 * and the direction is the whole fork, so the kit draft says so twice.
 */
import { useState } from "react";
import { Avatar, Button, Pill } from "@/components/ui";
import { CALLING_DETAIL } from "@/lib/content/callings";
import { KIT_DETAIL } from "@/lib/content/kit";
import { ABILITY_LABEL, DRAFT_RANKS } from "@/lib/game/rules";
import { reversePriority } from "@/lib/game/draft";
import { CALLING_BY_ID, KIT_BY_ID, nameOf, type PhaseProps } from "./shared";

const RANK_WORD = ["1st choice", "2nd choice", "3rd choice"];

/** Display words for the three charge kinds. */
const CHARGE_NOUN: Record<"reroll" | "reveal" | "torch", string> = {
  reroll: "reroll",
  reveal: "look ahead",
  torch: "torch",
};

export function Draft({ view, post, busy }: PhaseProps) {
  const kit = view.phase === "DRAFT_KIT";
  const draft = kit ? view.kitDraft : view.callingDraft;
  const [wants, setWants] = useState<string[]>(draft?.myWants ?? []);
  const [handedIn, setHandedIn] = useState(false);

  if (!draft) return null;

  const order = kit ? reversePriority(view.priority) : view.priority;
  const myPlace = order.indexOf(view.me.id) + 1;
  const label = (id: string) =>
    (kit ? KIT_BY_ID.get(id)?.name : CALLING_BY_ID.get(id)?.name) ?? id;

  function toggle(id: string) {
    setHandedIn(false);
    setWants((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= DRAFT_RANKS
          ? current
          : [...current, id]
    );
  }

  function move(index: number, by: number) {
    setHandedIn(false);
    setWants((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit() {
    if (await post("/wants", { wants })) setHandedIn(true);
  }

  return (
    <div className="phase-in space-y-6">
      <header className="space-y-2">
        <p className="prose-read">
          {kit
            ? "Rank up to three pieces of gear. This draft runs in REVERSE, so whoever got first crack at the Calling they wanted picks here last. That is the trade."
            : "Rank up to three Callings. One of each per table, so the table decides who gets to be what."}
        </p>
        <p className="text-sm text-text-mid">
          You are {myPlace > 0 ? `${myPlace} of ${order.length}` : "not in the order"} in this
          draft. Everybody sees the same pool, and nobody sees what anybody else has
          ranked. Hand in nothing and you get whatever is left over.
        </p>
        {kit && (
          <ol className="flex flex-wrap gap-2">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-1 text-xs text-text-mid">
                <span className="num text-text-low">{i + 1}.</span>
                <Avatar id={id} name={nameOf(view, id)} size={24} />
                <span className="font-display">{nameOf(view, id)}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      <section aria-label="Your ranking" className="rounded-lg border border-border-strong bg-bg-1 p-3">
        <h2 className="label-caps mb-2">Your ranking</h2>
        {wants.length === 0 ? (
          <p className="text-sm text-text-mid">Nothing yet. Tap up to three below.</p>
        ) : (
          <ol className="space-y-2">
            {wants.map((id, i) => (
              <li key={id} className="flex items-center gap-2">
                <span className="num w-6 shrink-0 text-accent">{i + 1}</span>
                <span className="font-display min-w-0 flex-1 truncate text-text-hi">
                  {label(id)}
                </span>
                <button
                  type="button"
                  className="min-h-11 min-w-11 rounded-md border border-border-strong text-text-mid disabled:opacity-40"
                  aria-label={`Move ${label(id)} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-11 min-w-11 rounded-md border border-border-strong text-text-mid disabled:opacity-40"
                  aria-label={`Move ${label(id)} down`}
                  disabled={i === wants.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="min-h-11 min-w-11 rounded-md border border-border-strong text-text-mid"
                  aria-label={`Take ${label(id)} off your list`}
                  onClick={() => toggle(id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled={busy || wants.length === 0} onClick={() => void submit()}>
            {handedIn ? "Hand it in again" : "Hand it in"}
          </Button>
          <p className="text-sm text-text-mid">
            {handedIn
              ? "Handed in. You can still change it until the window closes."
              : `${draft.committed.length} of ${view.players.length} have handed in.`}
          </p>
        </div>
        {draft.committed.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Who has handed in">
            {draft.committed.map((id) => (
              <li key={id} className="flex items-center gap-1 text-xs text-text-mid">
                <Avatar id={id} name={nameOf(view, id)} size={24} />
                <span className="font-display">{nameOf(view, id)}</span>
                <span className="sr-only">has handed in</span>
                <span aria-hidden>✓</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {draft.pool.map((id) => {
          const rank = wants.indexOf(id);
          const picked = rank >= 0;
          const atLimit = !picked && wants.length >= DRAFT_RANKS;
          return (
            <li key={id}>
              <div
                className={`h-full rounded-lg border bg-bg-1 p-3 ${
                  picked ? "border-accent" : "border-border-dim"
                }`}
              >
                {kit ? (
                  <KitBody id={id} />
                ) : (
                  <CallingBody id={id} />
                )}
                <button
                  type="button"
                  aria-pressed={picked}
                  disabled={atLimit || busy}
                  onClick={() => toggle(id)}
                  className={`mt-3 min-h-11 w-full rounded-md border px-3 font-display disabled:opacity-40 ${
                    picked
                      ? "border-accent bg-accent text-ink font-semibold"
                      : "border-border-strong text-text-hi"
                  }`}
                >
                  {picked
                    ? `✓ ${RANK_WORD[rank] ?? `choice ${rank + 1}`}`
                    : atLimit
                      ? "Three is the most you can rank"
                      : "Add to your ranking"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CallingBody({ id }: { id: string }) {
  const calling = CALLING_BY_ID.get(id);
  if (!calling) return <p className="text-sm text-text-mid">{id}</p>;
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-text-hi">{calling.name}</h3>
        <Pill tone="accent">
          {calling.affinities.map((a) => ABILITY_LABEL[a]).join(" + ")} +2
        </Pill>
      </div>
      <p className="mt-1 text-sm italic text-text-mid">{calling.blurb}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <dt className="label-caps inline">Signature </dt>
          <dd className="inline text-text-hi">{calling.signature.label}</dd>
        </div>
        <div>
          <dt className="label-caps inline">Failing on {calling.failing.tag} </dt>
          <dd className="inline text-text-mid">{calling.failing.text}</dd>
        </div>
      </dl>
      <details className="mt-2">
        <summary className="label-caps flex min-h-11 items-center text-accent">
          What it is like to play
        </summary>
        <p className="mt-1 text-sm text-text-mid">{CALLING_DETAIL[id]}</p>
      </details>
    </>
  );
}

function KitBody({ id }: { id: string }) {
  const item = KIT_BY_ID.get(id);
  if (!item) return <p className="text-sm text-text-mid">{id}</p>;
  return (
    <>
      <h3 className="font-display text-lg text-text-hi">{item.name}</h3>
      <p className="mt-1 text-sm italic text-text-mid">{item.blurb}</p>
      <p className="mt-2 flex flex-wrap gap-2">
        {item.bonus && (
          <Pill tone="accent">
            {ABILITY_LABEL[item.bonus.ability]} +{item.bonus.value}
          </Pill>
        )}
        {item.charge && (
          <Pill tone="arcane">
            {item.charge.uses} {CHARGE_NOUN[item.charge.kind]}
            {item.charge.uses === 1 ? "" : "s"}
          </Pill>
        )}
      </p>
      <details className="mt-2">
        <summary className="label-caps flex min-h-11 items-center text-accent">
          A closer look
        </summary>
        <p className="mt-1 text-sm text-text-mid">{KIT_DETAIL[id]}</p>
      </details>
    </>
  );
}
