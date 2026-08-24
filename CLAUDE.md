# Tavern Party — project conventions

A browser fantasy-roleplay game: build a character, survive five Acts with
friends, and exactly one of you walks out with the Hoard. Plus four daily
puzzles. Third site in the network, after Aux Wars and Shareholder Party.

Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · Supabase.

Read `docs/GAME_DESIGN.md` before changing any rule. `FRIDAY.md` is the list of
things that need a paid plan or a login and cannot be done from here.

## Hard rules

- **The engine stays pure.** `lib/game/engine.ts` and its neighbours
  (`draft`, `resolve`, `deck`, `scoring`, `random`) have no React, no I/O, and no
  imports from `app/` or `next/*`. Every mutation goes through an exported action
  that validates membership, phase and deadline, and throws `GameError`.
- **All randomness is injected.** Engine entry points take an optional `rng` so
  tests pin every die and every deal. Never call `Math.random()` in the engine.
- **Server authority is absolute.** Clients never decide a roll, a target number,
  a draft result, a deadline or a standing. A new mechanic is: an engine function
  plus a route handler plus a redaction check in `viewFor` plus a unit test.
- **Never trust a client-supplied player id.** Identity comes from
  `lib/identity.ts` only: the signed guest cookie, or the Supabase session.
- **No answer in a payload.** Dailies check server-side. A client component must
  never import a `lib/daily/*-data.ts` module.
- **Content is data.** Callings, Bloods, Kit, Hooks, scenes, tags and every
  daily's dataset live in `lib/content/` and `lib/daily/`. Never hardcode game
  content in a component.
- **Every tag comes from `lib/content/tags.ts`.** Inventing one silently breaks a
  Hook's Insert guarantee. A test enforces it.
- **No ads during a live Act or an unfinished daily.**

## Conventions

- **Design tokens.** `design/tokens.css` (`--tp-*`), mapped into Tailwind in
  `app/globals.css` under `@theme inline`. Use the semantic classes (`bg-bg-1`,
  `text-accent`, `bg-paper`, `text-paper-ink`), never a raw hex and never a stock
  Tailwind colour like `text-green-500`. `tests/unit/contrast.test.ts` parses the
  token file and fails the build on any pairing below AA.
- **The character sheet is the signature.** Anything about *you* renders on
  `<Sheet>`: parchment, brown ink, hand-ruled boxes. It is the only light surface
  in the product, so it always means "this is yours". Encounters are on the dark.
- **The ledger, never a total.** Every roll is narrated by naming the
  contributions that made it, from `Outcome.mods`. Prose comes out of a join, not
  out of authoring an outcome per scene per approach. If you ever find yourself
  printing a bare number, that is the bug.
- **API routes are thin.** zod → identity → `store.mutate` → engine → JSON.
  Errors surface through `handleError` in `lib/api.ts`.
- **Accessibility is not optional.** 44px targets, real buttons and labels,
  keyboard operation throughout, `aria-live` for anything that changes without a
  click, and **no state communicated by colour alone**: every colour signal needs
  a shape, glyph or word doing the same job. `prefers-reduced-motion` disables
  animation, and no game state may be motion-only.
- **Voice.** British, dry, concrete, grounded. The register of a good one-shot GM:
  it names specific physical things and trusts the reader. Not high fantasy, not
  parody. **No em-dashes in player-facing copy.** Vocabulary: Calling, Blood, Kit,
  Hook, Act, Approach, Reckless, Scar, Renown, Dread, Mark, Laurel, the Hoard, the
  Ballad, the house array.
- **We copy the system and invent the words.** Game mechanics are not
  copyrightable in the US or the UK, so the d20, the six abilities and the rest
  are free. We ship none of anybody else's text: never the D&D marks, never
  Wizards of the Coast product identity, never a published creature, setting or
  deity, anywhere including metadata. See `docs/GAME_DESIGN.md` §9.
- **Deliberate ceilings are marked `ponytail:`** with the upgrade path named.

## Before claiming work is done

```bash
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run build          # next build
npm run dev            # then, against it:
node scripts/smoke.mjs         # a full run through the public API
node scripts/daily-smoke.mjs   # all four dailies, played to completion
```

All five must pass.

**Never run `npm run build` while `npm run dev` is running.** They share `.next`,
the build deletes the route manifests, and the dev server then 500s on every
route. It looks exactly like a real bug and it has cost hours twice on the other
sites in this network.

`npm run db:migrate` applies `supabase/migrations/`. It falls back to the IPv4
session pooler, which is what actually works: the direct Postgres host is
IPv6-only.
