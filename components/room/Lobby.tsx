"use client";

/**
 * WAITING and MUSTER.
 *
 * The lobby is where the code gets shared, so the code is the biggest thing on
 * it. The muster is a beat with no input at all: the array everybody is about to
 * fight over, and the order they will fight over it in. It is the one screen in
 * the game with a countdown ring and nothing to press, so it has to say so.
 */
import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, Card, Field, Input, Pill } from "@/components/ui";
import type { RoomView } from "@/lib/game/types";
import { MIN_PLAYERS, abilityMod, estimateRunMs } from "@/lib/game/rules";
import { nameOf, signed, type PhaseProps } from "./shared";

export function Waiting({ view, post, busy }: PhaseProps) {
  const [copied, setCopied] = useState(false);
  const me = view.players.find((p) => p.id === view.me.id);
  const iAmHost = !!me?.isHost;
  const tooFew = view.players.length < MIN_PLAYERS;
  const full = view.players.length >= view.settings.maxPlayers;

  async function copy() {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="phase-in space-y-6">
      <Card className="text-center">
        <p className="label-caps">Anybody with this can sit down</p>
        <p className="num mt-2 text-4xl tracking-[0.2em] text-accent sm:text-5xl">
          {view.code}
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={copy}>
            Copy the code
          </Button>
          <p aria-live="polite" className="text-sm text-text-mid">
            {copied ? "Copied. Send it to them." : " "}
          </p>
        </div>
      </Card>

      {/*
        A cold visitor arriving on a shared code was shown a code, a seat list and
        a start button, and never told what the game is, how long it takes, or
        that every phase runs on a clock nobody can pause. There was also no link
        to the rules anywhere inside the room.
      */}
      <p className="rounded-md border border-border-strong bg-bg-1 px-3 py-2 text-sm text-text-mid">
        Build a character together, go through {view.settings.acts} Acts, and exactly one of
        you walks out with the Hoard. About {Math.round(estimateRunMs(view.settings) / 60_000)}{" "}
        minutes, and every phase runs on a clock: nothing waits for anybody, and doing nothing
        is always a real move rather than a pass.{" "}
        <Link href="/how-it-works" className="text-accent underline">
          The rules, in full
        </Link>
        .
      </p>

      {!me && <JoinForm post={post} busy={busy} />}

      <section aria-label="Who is at the table" className="space-y-2">
        <h2 className="label-caps">
          At the table · {view.players.length} of {view.settings.maxPlayers}
        </h2>
        <ul className="space-y-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md border border-border-dim bg-bg-1 px-3 py-2"
            >
              <Avatar id={p.id} name={p.name} size={36} ring={p.id === view.me.id ? "you" : null} />
              <span className="font-display flex-1 truncate text-text-hi">{p.name}</span>
              {p.id === view.me.id && <span className="text-xs text-text-low">(you)</span>}
              {p.isHost && <Pill>Host</Pill>}
              {p.isBot && <Pill>Stranger</Pill>}
              {p.isBot && iAmHost && (
                <button
                  type="button"
                  aria-label={`Ask ${p.name} to leave`}
                  className="min-h-11 min-w-11 rounded-md border border-border-strong text-sm text-text-mid"
                  disabled={busy}
                  onClick={() => void post("/bot", { botId: p.id }, "DELETE")}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {/*
          "Stranger" is the word for a seat the server plays and nothing said so
          anywhere in the product: a first-timer read the pill as somebody's
          chosen name. Only when there is one at the table, so it is a caption on
          something you can see rather than a rule to remember.
        */}
        {view.players.some((p) => p.isBot) && (
          <p className="text-xs text-text-low">
            A Stranger is a seat the house plays. It takes the door it is best at and it
            never flinches.
          </p>
        )}
      </section>

      {iAmHost && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={busy || tooFew}
              onClick={() => void post("/start")}
            >
              Start the night
            </Button>
            <Button
              variant="secondary"
              disabled={busy || full}
              onClick={() => void post("/bot")}
            >
              Sit a stranger down
            </Button>
          </div>
          <p className="text-sm text-text-mid">
            {tooFew
              ? `You need at least ${MIN_PLAYERS} at the table. Sit a stranger down if nobody else is coming.`
              : full
                ? "The table is full."
                : `${view.settings.acts} Acts. Everybody acts at the same time, so the run takes the same time however many of you there are.`}
          </p>
        </div>
      )}
      {!iAmHost && me && (
        <p className="text-sm text-text-mid">
          {nameOf(view, view.players.find((p) => p.isHost)?.id ?? "")} starts it when
          everybody is here.
        </p>
      )}

      {me && (
        <div className="border-t border-border-dim pt-3">
          <Button variant="secondary" disabled={busy} onClick={() => void post("/leave")}>
            Give up the chair
          </Button>
          {/*
            This line was a changelog entry shipped as player-facing copy: it
            told the player what the product used to do wrong instead of what
            the button does. Both halves of what it does now, because leaving as
            the last human clears the Strangers out with you, and somebody who
            has just sat six of them down should know that before pressing it.
          */}
          <p className="mt-1 text-xs text-text-low">
            You come off the seat list and the table carries on without you. If you are the
            last one here, the Strangers go home too.
          </p>
        </div>
      )}
    </div>
  );
}

function JoinForm({ post, busy }: { post: PhaseProps["post"]; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void post("/join", { displayName: name.trim() });
        }}
      >
        <Field label="Your name" hint="However you want to be remembered. Twenty letters.">
          <Input
            value={name}
            maxLength={20}
            required
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            placeholder="OLD MARGET"
          />
        </Field>
        <Button type="submit" disabled={busy || !name.trim()}>
          Pull up a chair
        </Button>
      </form>
    </Card>
  );
}

/** The beat. Six numbers and an order, and nothing to press. */
export function Muster({ view }: { view: RoomView }) {
  const array = view.houseArray ?? [];
  return (
    <div className="phase-in space-y-6">
      {/*
        A countdown ring over a screen with no control on it reads as a demand,
        and the only people who know it is not one are the people who have played
        before. So: nothing to do, and it moves on by itself.
      */}
      <p className="rounded-md border border-border-strong bg-bg-1 px-3 py-2 text-sm text-text-hi">
        There is nothing to press on this one. Read it while it is up, and the first draft
        opens on its own when the clock runs out. Nothing here can go wrong.
      </p>
      <section aria-label="The house array">
        <p className="prose-read">
          The house rolls once and everybody builds from the same six numbers. No
          arguments about whose dice were better.
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
          {array.map((n, i) => (
            <li
              key={i}
              className="tp-anim-roll flex min-w-16 flex-col items-center rounded-md border-2 border-border-strong bg-bg-2 px-3 py-2"
            >
              <span className="num text-3xl text-text-hi">{n}</span>
              <span className="num text-xs text-text-mid">{signed(abilityMod(n))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-sm text-text-mid">
          The small figure is what the number is worth on a roll.
        </p>
      </section>

      <Card>
        <h3 className="label-caps">Draft order · Callings first, kit in reverse</h3>
        <ol className="mt-2 space-y-1">
          {view.priority.map((id, i) => (
            <li key={id} className="flex items-baseline gap-2">
              <span className="num text-sm text-text-low">{i + 1}.</span>
              <span className="font-display text-text-hi">{nameOf(view, id)}</span>
              {id === view.me.id && <span className="text-xs text-text-low">(you)</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 border-t border-border-dim pt-3 text-sm text-text-mid">
          First crack at a Calling means last crack at the gear. There is no best seat.
        </p>
      </Card>
    </div>
  );
}
