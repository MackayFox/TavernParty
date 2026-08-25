"use client";

/**
 * WHO IS GOING DOWN, and how long they have been doing this.
 *
 * The complaint: "I am making a few choices from a very limited selection, then
 * throwing the character away within minutes."
 *
 * The choices stay the same, because a shared par depends on every player being
 * offered the same ones. What changes is the throwing away. A runner has a name
 * they picked, an ancestry that was dealt to them, a past they chose, and a list
 * of every night they have been down and every door that hurt them.
 *
 * NOTHING HERE IS A STAT. No level, no rising number, nothing that makes tonight
 * easier than last night, because a character who is stronger than mine is not
 * playing my puzzle and that is the end of a postable score. Counts, and scars,
 * and a name. See lib/daily/hero.ts for the arithmetic that makes the alternative
 * impossible rather than merely unwise.
 */
import { useState } from "react";
import { Button, Pill } from "@/components/ui";
import { BLOODS } from "@/lib/content/bloods";
import { HOOKS } from "@/lib/content/hooks";
import {
  createHero,
  forgetHero,
  oneLine,
  tally,
  type Hero,
} from "@/lib/daily/hero";

export function Runner({
  hero,
  onChange,
}: {
  hero: Hero | null;
  onChange: (hero: Hero | null) => void;
}) {
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [hookId, setHookId] = useState(HOOKS[0].id);
  const [open, setOpen] = useState(false);

  // ------------------------------------------------------------- nobody yet
  if (!hero && !making) {
    return (
      <section className="rounded-lg border border-border-dim bg-bg-1 p-4">
        <p className="label-caps">Nobody yet</p>
        <p className="prose-read mt-1 text-text-mid">
          You can go down as nobody in particular, and the score still counts. Or make somebody
          and keep them: they will carry every night they have been down here and every door that
          got a piece of them.
        </p>
        <Button variant="secondary" className="mt-3" onClick={() => setMaking(true)}>
          Make somebody
        </Button>
      </section>
    );
  }

  // ------------------------------------------------------------- making one
  if (making) {
    const hook = HOOKS.find((h) => h.id === hookId) ?? HOOKS[0];
    return (
      <section className="rounded-lg border border-accent bg-bg-1 p-4">
        <p className="label-caps">Who are you</p>
        <label className="mt-3 block">
          <span className="sheet-label text-text-mid">A name</span>
          <input
            type="text"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-3 text-text-hi"
          />
        </label>

        <label className="mt-3 block">
          <span className="sheet-label text-text-mid">What you did before this</span>
          <select
            value={hookId}
            onChange={(e) => setHookId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-3 text-text-hi"
          >
            {HOOKS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-sm text-text-mid">{hook.blurb}</p>

        <p className="mt-3 text-xs text-text-low">
          Where you are from is dealt rather than chosen, the same way it is dealt at a table.
          You do not get to pick the family you were born into.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={name.trim().length === 0}
            onClick={() => {
              /*
               * The ancestry is dealt from the name, so it is stable for a given
               * name and nobody can reroll it by pressing the button again. Not
               * random per click: that would be a menu with extra steps.
               */
              let n = 0;
              for (const ch of name.trim().toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) | 0;
              onChange(createHero(name, hookId, n));
              setMaking(false);
            }}
          >
            That is me
          </Button>
          <Button variant="ghost" onClick={() => setMaking(false)}>
            Never mind
          </Button>
        </div>
      </section>
    );
  }

  if (!hero) return null;

  // -------------------------------------------------------------- somebody
  const counts = tally(hero);
  const blood = BLOODS.find((b) => b.id === hero.bloodId);
  const hook = HOOKS.find((h) => h.id === hero.hookId);
  return (
    <section className="rounded-lg border border-border-strong bg-bg-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="label-caps">Going down</p>
          <h2 className="font-display text-xl text-text-hi">{hero.name}</h2>
        </div>
        <div className="flex flex-wrap gap-1">
          {blood && <Pill tone="arcane">{blood.name}</Pill>}
          {counts.nights > 0 && (
            <Pill>
              {counts.nights} {counts.nights === 1 ? "night" : "nights"}
            </Pill>
          )}
        </div>
      </div>

      <p className="num mt-1 text-sm text-text-mid">{oneLine(hero)}</p>
      {hook && <p className="mt-1 text-sm text-text-low">{hook.blurb}</p>}

      {/*
        The life, behind a disclosure rather than in front of it. Somebody about to
        play wants the one line; somebody who has been at this a fortnight wants
        the list, and they are not the same visit.
      */}
      {(hero.nights.length > 0 || hero.scars.length > 0) && (
        <details className="mt-3" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer text-sm text-accent">
            What has happened to {hero.name}
          </summary>

          {hero.scars.length > 0 && (
            <div className="mt-2">
              <p className="label-caps">Scars</p>
              <ul className="mt-1 space-y-1">
                {[...hero.scars].reverse().slice(0, 8).map((scar, i) => (
                  <li key={`${scar.on}-${i}`} className="text-sm text-text-mid">
                    <span className="text-text-low">{scar.where}: </span>
                    {scar.line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hero.nights.length > 0 && (
            <div className="mt-3">
              <p className="label-caps">Nights</p>
              <ol className="num mt-1 space-y-0.5 text-sm">
                {[...hero.nights].reverse().slice(0, 10).map((night, i) => (
                  <li key={`${night.on}-${i}`} className="flex items-baseline gap-2">
                    <span className="text-text-low">{night.label}</span>
                    <span className={night.out ? "text-accent" : "text-danger"} aria-hidden>
                      {night.out ? "✓" : "✕"}
                    </span>
                    <span className="text-text-mid">
                      {night.out ? "out alive" : `stopped on ${night.reached}`}
                    </span>
                    <span className="ml-auto text-text-hi">
                      {night.score}
                      {night.par !== null ? ` of ${night.par}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              forgetHero();
              onChange(null);
            }}
            className="mt-3 min-h-11 text-xs text-text-low underline hover:text-danger"
          >
            Retire {hero.name} and start somebody new
          </button>
        </details>
      )}
    </section>
  );
}
