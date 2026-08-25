# SOMEBODY ELSE'S DUNGEON

**A campaign creator for The Deep Run. The spec.**

Verified against the repo on 24 August 2026. Every line number, count and timing below was read or measured, not assumed.

> **Status: agreed. Phase 1 is unblocked.**
>
> The open question was whether a party of players can take on an authored
> dungeon, and therefore whether an authored room has to compile to a `Scene`
> (the multiplayer Act) as well as a `RoomDef`. It is settled in
> `docs/PARTY_DUNGEONS.md`, and the answer is **yes to the party, no to the Act**:
>
> - A party dungeon is made of **rooms, not Acts**, because a dungeon is a descent
>   and the content unit for a descent is a room. So the compile is the identity
>   function, `AuthoredRoom` below needs no change, and **the party mode needs
>   zero new authoring**. Party play is rules on top of the same content.
> - The `Scene` direction is dead on measurement, not taste. Twelve of the twenty
>   house rooms carry two checks and eight carry three, while `Scene.approaches`
>   is a fixed three-tuple whose three abilities must be distinct
>   (`tests/unit/content.test.ts:153`), so sixty percent of the shipped pool could
>   not become an Act without new authoring. `reckless` is a joint numeric
>   invariant pinned by tests rather than a flag an author can tick. And scene
>   tags are a *guarantee*: `buildDeck` promises each player's Insert tag appears
>   in the deck, so letting an author point at one makes a stranger's guarantee
>   leaky in a game the author never played.
>
> So build Phase 1 exactly as written below. The party layer is a separate six
> days on top, and it must not reshape Phase 1.
>
> Verified against the repo rather than assumed, including a correction to this
> project's own file header. At the time of writing the Deep Run pool was FIFTEEN
> rooms across three bands plus five bosses, twenty in total, against a header
> comment claiming twenty-five: every cold-start estimate that quoted the comment
> was a quarter optimistic.
>
> It is TWENTY-EIGHT plus five bosses now. Bands one and two doubled when the deal
> was measured, because the daily takes two cards a night from each of them and
> they were emptying every three days. Count the arrays.


---

## 1. The decision

We are building a **room-first dungeon composer for The Deep Run, gated by a solver**. An author picks or writes three to eight floors, ticks which Callings and Kit are on the table, writes an intro, and publishes. Publishing is a link, not a listing: the dungeon is playable by anyone with the code immediately, appears nowhere, and a human decides later whether it joins a public Hall. What makes it defensible is that the moment the author saves, the existing par search runs over their dungeon and tells them the truth about it: whether anybody can get out, what par is, how many of the characters they allow survive, which floor stops most of them, and which of their doors nobody would ever take. Almost no user-generated-content tool can evaluate its own content. This one can, cheaply, exactly, because every room's die is pinned before the player chooses and there is therefore no probability anywhere in the problem.

That is the product. The Hall, the votes, the ranking and the queue are Phase 2, because at zero users they are furniture.

---

## 2. The authoring model, and no, it is not a decision tree

You asked for decision trees. The answer is no, and the reason is not compute.

I checked: branching is affordable for the solver. `bestFor` in `deeprun-par.ts:132` memoises on `(roomIndex, vigour, knack)`. A directed graph of rooms would key on `(roomId, vigour, knack)` and still be a table rather than a tree. Par survives branching perfectly well. Anybody who tells you branching breaks the maths has not read the file.

**Branching is unaffordable for the author.** A floor already carries three to four options. Making them lead to different rooms means a depth-six binary tree is 63 rooms written and 57 of them never seen by any one player. Six linear floors is already about eighty strings of prose. That is the real ceiling on this feature and it is the reason the notebooks people describe in this hobby die unfinished.

**The decision tree in this product is the room.** Three to four doors, each on a different ability, each with a different price, reconverging on the next floor. That is a genuine branch every twelve seconds of play and it costs one room of writing.

**What delivers the cross-floor feeling for a tenth of the cost is Marks, and it is Phase 3.** Three author-named flags ("wet", "seen", "carrying the lamp"), with `sets` / `needs` / `forbids` on an option. The door you take on floor two changes which doors floor five will even offer. Par stays a table with the state widened to `(floor, vigour, knack, markSet)`, at most eight times a memo that currently holds a couple of hundred entries per character. It is genuinely small **as a mechanic** and genuinely not small **as a change**, because nothing in `run`, `resolveOption`, `movesFor` or the GET payload currently has any concept of an option being unavailable. Priced honestly at two and a half days in Phase 3, not "three optional strings".

### The unit of authorship is the room

This is the decision that makes the difference between a week and a month, and it is the one thing all three judges agreed was right.

- A **room** is about 180 words and fifteen minutes. Somebody can contribute one on their first visit.
- A **dungeon** is about 1,100 words and an evening. Asking a stranger for that on their first visit is where these products die.

So: the pool holds rooms. A dungeon is an ordered list of room ids plus settings. Every floor slot is either **picked from the pool** or **written inline**. The minimum viable publish is title, intro, tick some Callings, tick some Kit, pick a starting Vigour, pick six rooms from the pool. Two minutes, and it is a real dungeon with a real par and a real link.

The pool ships with **thirty-three house rooms**: twenty-eight non-boss (twelve in band one, eleven in band two, five in band three) plus five bosses.

Read that number out of `BAND_1`, `BAND_2`, `BAND_3` and `BOSSES` and never out of a comment. The header at `deeprun-data.ts` has now been wrong twice: it said twenty-five when there were twenty, and it said twenty when bands one and two doubled. Four separate design passes quoted the first wrong number back as fact.

### The author does not have to type a number, but may

The judges split hard here and it is worth stating why.

The buildability lens loved the fixed lookup: band plus a difficulty word gives you the target number, which deletes the numeric validation surface, the balance surface and the one field an amateur cannot fill in, all at once. I verified the table against the shipped content and it is exactly right:

| band | check TN (easy / fair / hard) | cost |
|---|---|---|
| 1, Shallow | 11 / 12 / 13 | 2 |
| 2, Middling | 14 / 15 / 16 | 3 |
| 3, Deep | 16 / 17 / 18 | 4 |
| Boss | 16 / 17 / 18 | 5 |

The existing twenty rooms import into that table without a single number changing.

The craft lens hated it, correctly: if the table is a lock, every band-2 room in the product is mechanically the same object wearing different sentences, and "the author never types a number" stops being a feature and starts being the moment this ceased to be a creator tool.

**Resolution: the word fills the number in, and the number is nudgeable.** The difficulty word is the default. Behind a `<details>` marked "Move the numbers", each option carries an optional `tnNudge` of minus two to plus two and a `costNudge` of minus one to plus one, clamped after resolution to TN 8 to 20 and cost 1 to 6. A first-time author never sees a number. A serious author gets nine base combinations plus a nudge, which is enough range to make a room theirs. And it costs the solver nothing at all, because a target number is a constant per option and does not widen the search by a single state.

### Keep `promise`

One design cut the fourth prose field per option to save a textarea. Do not. `option.promise` is rendered directly under the label on the un-chosen door at `DeepRunGame.tsx:576`, before the numbers, which makes it the single most-read authored line in the product and the only place an author's voice reaches a player while the decision is still open. Four fields per option: label, promise, win, lose. A brace's `lose` is its `win`, exactly as the existing `brace()` helper does it.

### Three to eight floors

Not six fixed. Letting somebody ship a three-floor first dungeon is the cheapest lever on author completion rate anywhere in this design, and it costs almost nothing: `DEPTH` becomes `puzzle.rooms.length`, and the score ceiling becomes a function of depth. Comparability was already per-dungeon, since the share line reads "X of a possible par".

Measured cost of the wider caps, on this machine, warm:

```
callings 3, kit 4,  floors 6:  146ms   (the shipped daily)
callings 4, kit 6,  floors 6:  235ms
callings 4, kit 6,  floors 8:  247ms
callings 4, kit 8,  floors 8:  747ms
callings 8, kit 12, floors 8: 3596ms
14 days of the live daily:    2288ms
```

So the caps are **4 Callings, 6 Kit, 8 floors**, and the worst legal dungeon solves in about 250ms. Going to 8 Kit quadruples it and going to all eight Callings and all twelve Kit is nearly four seconds. That cliff is invisible in the UI and somebody will later widen a cap because it looks small, so **a test asserts the enumeration bound under the worst legal design, and the arithmetic goes in CLAUDE.md next to the rule.**

### Dice are pinned to the code, and there is no robustness band

A dungeon's dice come from its code and never move. That gives the author a fact to tune against, which is the whole gift of this engine: "I moved floor three to 15 and now nine of thirty-six get out" is *true*, not a distribution. It also gives the leaderboard a meaning and makes the link in a group chat the same dungeon forever.

One design re-rolled every campaign's dice at UTC midnight to buy replayability. That buys replay and sells the author's tuning surface and the fixed board, and it means par can never be stored on the row so every finish pays a live solve on a cold function. Rejected.

The twenty-seed robustness band from another design is also cut. It exists to catch an author who got a lucky seed, but with a pinned seed there is no luck: the report describes the dungeon everybody will actually play. At 250ms a seed, twenty seeds is five seconds in one request, which is uncomfortable on Hobby's ten-second ceiling for a check that answers a question nobody asked.

**Replay gets one line instead.** `/d/[code]?again` seeds on `${code}:${today}`, is labelled Practice in the same words the daily archive already uses, and writes nothing to the board. Roughly five lines once `puzzleFrom(design, seed)` exists, and it doubles as the author's test-run button.

### What the author sets, and nothing else

- **Callings on the table**: 2 to 4 of the eight. This is "what character types are allowed".
- **Kit on the shelf**: 3 to 6 of the twelve. This is "what items are allowed".
- **Starting Vigour**: 7 / 9 / 11, labelled *You will not all come back* / *Standard* / *A fair night*. The whole difficulty dial, one integer, and it is already a serialised field on `Puzzle` that nothing currently reads.
- **The intro**: up to 400 characters, mandatory, shown before the build screen. Literally the field you asked for, the one where the author tells the player what to prepare for.
- **The floors**: 3 to 8, last one a boss.

The house array is derived from the code, the same way the daily derives it from the date. Not authored. Six freely-chosen numbers is an unbounded balance hole guarding a knob nobody wants.

**On mobs.** There is no combat loop in this engine and there is not going to be one. In this system **a mob is a room**: the threat is the target number and the price. "Choose the mobs" means pick or write the encounter. Say that to authors in plain words on the form rather than shipping a thin fake of a stat block.

---

## 3. Data model

### Engine changes, in full

Four edits, and I traced each one.

1. **`startingVigour(who, base = BASE_VIGOUR)`.** `Puzzle.baseVigour` already exists at `deeprun.ts:124` and is already serialised, and `startingVigour` at line 305 ignores it and reads the module constant. Two call sites, one in `deeprun.ts` and one in `deeprun-par.ts:163`.
2. **`run(puzzle, build, steps, defs = ROOM_BY_ID)`.** `defFor` at `deeprun.ts:476` is the only consumer of the module-level `ROOM_BY_ID` map at line 474, and all it needs is a `Map<string, RoomDef>` for the win and lose prose. A dungeon passes its own. About ten lines. **`parFor` needs no change here at all**: it reads mechanics off `PuzzleOption` and never touches prose.
3. **Extract `puzzleFrom(design, seed): Puzzle`**, with `puzzleFor(date)` becoming a four-line caller. `dieFor` and `secondDie` take a seed string rather than a date; the daily passes the date, a dungeon passes its code. `Puzzle.date` becomes `Puzzle.seed` plus a new `Puzzle.label` for the header, because `DailyHeader` currently runs `prettyDate()` on it and would render a dungeon code as a date.
4. **`PAR_CACHE` keys on `puzzle.seed`**, and `reportFor(puzzle)` is added. This is the one genuinely new algorithm and it is about eighty lines. `parFor` returns only `{ par, best }` and throws away every non-maximal build, and `bestFor` is module-private, so counting who gets out means restructuring the enumeration loop to keep per-build results. It is not free and no design in the pile priced it honestly.

### The client component is not "a prop"

`DeepRunGame.tsx` is 645 lines welded to the daily furniture in six places: `readProgress`/`writeProgress` at 127 and 218, `finishDaily` at 231, `DailyHeader game={GAME} date={data.date}` at 317, `NextUp game={GAME}` at 635, the hardcoded `postJson("/api/daily/deeprun")` at 293, and `kitIds.length === 2` at 239. `DailyGame` in `lib/daily/core.ts` is a closed union of four, so there is no fifth value to pass.

The lazy fix is **one prop, not a split**:

```ts
export type RunSource = {
  url: string;                                   // "/api/daily/deeprun" | "...?c=abc"
  storage: { read<T>(): T | null; write(v: unknown): void };
  header: ReactNode;
  footer: (reply: RunReply) => ReactNode;
  onFinish: (score: number, par: number | null) => Promise<number | null>;
  kitSlots: number;
};
```

The daily page passes the daily source, the dungeon page passes its own, and the component stays one file. Budget **1.5 days including the accessibility re-pass**, not zero.

**And there is a live bug to fix on the way past.** `pruneProgress` in `lib/daily/local.ts` walks every key under the progress prefix, takes the last colon-segment, and deletes the key if that segment is not a kept date. Reuse that helper with a dungeon code and the next finished daily silently wipes every in-progress dungeon run in the browser. It presents as "the site keeps losing my run" and is hell to reproduce. Two lines: dungeon progress gets its own prefix, and `pruneProgress` skips any key that is not one of the four `DAILY_GAMES`.

### Types

```ts
// lib/campaign/types.ts — pure, no I/O, same rules as the engine.

export type Band = 1 | 2 | 3;
export type Difficulty = "easy" | "fair" | "hard";

/** What an author fills in for one door. No target number, unless they want one. */
export type AuthoredOption = {
  id: string;
  label: string;                 // imperative, in your voice, <= 60
  kind: "check" | "brace";
  ability?: Ability;             // required when kind === "check"
  difficulty?: Difficulty;       // required when kind === "check"
  tnNudge?: -2 | -1 | 0 | 1 | 2;
  costNudge?: -1 | 0 | 1;
  promise: string;               // <= 160. Rendered before the door is opened.
  win: string;                   // <= 240
  lose: string;                  // <= 240. A brace repeats its win.
};

export type AuthoredRoom = {
  id: string;                    // "r-screech" (house) | "u-<nanoid>"
  band: Band;
  boss: boolean;
  title: string;                 // <= 60
  setup: string;                 // <= 400
  options: AuthoredOption[];     // 2..5, >= 2 checks on DIFFERENT abilities, >= 1 brace
};

export type Design = {
  v: 1;
  roomIds: string[];             // 3..8, last one boss
  callingIds: string[];          // 2..4 of the eight
  kitIds: string[];              // 3..6 of the twelve
  baseVigour: 7 | 9 | 11;
};

/** What the solver found. Stored on the row, shown to the author and on the card. */
export type Report = {
  version: number;               // bumped when a rule is added, so live rows can be re-run
  par: number;
  ceiling: number;               // best conceivable for this depth, for context
  builds: number;                // deduped build signatures tried
  out: number;                   // how many get out alive on their best line
  stopFloor: number | null;      // where most of the ones that fail run dry
  asks: Ability[];
  floors: {
    index: number;
    clearedBy: number;           // fraction of builds whose best line clears it
    wall: boolean;
    free: boolean;
    dominant: string | null;     // option id taken by > 90% of best lines
    dead: string[];              // option ids no best line ever takes
  }[];
  forcedCalling: { id: string; share: number } | null;
  blocks: string[];              // publishing is refused while this is non-empty
  warnings: string[];            // published on the card, never blocking
  ms: number;
};
```

`applyNudges(option, band)` resolves `difficulty` plus `tnNudge` into a real `tn` and `vigour`, clamped. It lives beside the types and it is the only place the lookup table exists.

### SQL

`00003_campaigns.sql`. Four tables, all following the `00002_contact.sql` model: **RLS on, no policy of any kind, service role only**, so a browser can do nothing with any of them and the route handler is the only writer.

```sql
-- ---------------------------------------------------------------- the pool
create table dungeon_rooms (
  id          text primary key,      -- 'r-screech' (house) | 'u-<nanoid>'
  author_id   uuid references profiles (id) on delete set null,  -- null = the house
  band        smallint not null check (band between 1 and 3),
  boss        boolean not null default false,
  title       text not null check (length(title) between 3 and 60),
  setup       text not null check (length(setup) between 20 and 400),
  options     jsonb not null,        -- AuthoredOption[], nudges already resolved
  shared      boolean not null default true,   -- opt out on the form, not in the terms
  status      text not null default 'live',    -- live | binned | withdrawn
  picked_up   integer not null default 0,      -- how many dungeons use it
  created_at  timestamptz not null default now()
);

create index dungeon_rooms_pool_idx
  on dungeon_rooms (band, boss)
  where status = 'live' and shared;

create index dungeon_rooms_author_idx on dungeon_rooms (author_id);

-- ------------------------------------------------------------- the dungeons
create table dungeons (
  code        text primary key,      -- 10 base64url chars from randomBytes. Also the dice seed.
  author_id   uuid not null references profiles (id) on delete cascade,
  author_name text not null,         -- denormalised, survives a deleted account
  title       text not null check (length(title) between 3 and 60),
  intro       text not null check (length(intro) between 20 and 400),
  design      jsonb not null,        -- Design
  par         integer not null,      -- computed server-side, never accepted from a client
  report      jsonb not null,        -- Report
  status      text not null default 'draft',  -- draft | unlisted | pending | listed | hidden
  plays       integer not null default 0,
  finishes    integer not null default 0,
  marks       integer not null default 0,
  rank_score  real not null default 0,        -- Wilson lower bound, marks over finishes
  chosen_on   date,                           -- 'Chosen for the week', permanent stamp
  created_at  timestamptz not null default now(),
  listed_at   timestamptz
);

create index dungeons_hall_idx  on dungeons (rank_score desc)
  where status = 'listed' and finishes >= 10;
create index dungeons_new_idx   on dungeons (listed_at desc)  where status = 'listed';
create index dungeons_queue_idx on dungeons (created_at)      where status = 'pending';
create index dungeons_mine_idx  on dungeons (author_id, created_at desc);

-- --------------------------------------------------------------- the board
-- Phase 2. Guests are on it; daily_results.user_id is not null references
-- profiles, so guests structurally cannot write there and a dungeon must never
-- touch it. Streaks belong to the four dailies and to nothing else.
create table dungeon_runs (
  code       text not null references dungeons (code) on delete cascade,
  player     text not null,          -- identity id: auth uuid, or the signed guest id
  name       text not null,          -- username, or 'A guest'
  score      integer not null,
  finished   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (code, player)         -- first attempt wins, the same rule as daily_results
);

create index dungeon_runs_board_idx on dungeon_runs (code, score desc);

-- ---------------------------------------------------------------- the marks
-- Phase 2. Upvote only: there is no `value` column, so the schema itself cannot
-- be used to bury a rival.
create table dungeon_marks (
  code       text not null references dungeons (code) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (code, user_id)        -- double voting is impossible in the database
);

alter table dungeon_rooms enable row level security;
alter table dungeons      enable row level security;
alter table dungeon_runs  enable row level security;
alter table dungeon_marks enable row level security;

-- Banning an author is one column, not a table.
alter table profiles add column if not exists banned boolean not null default false;
```

**No reports table.** The report link posts to `/api/contact` with the code in the subject, into an inbox that already exists and is already read. Three reports auto-delisting is a griefing button and dead machinery at zero users. Build the table the first week a report arrives that cannot be handled by hand.

The migration also **seeds the twenty house rooms** with `author_id = null`, generated from `DEEP_ROOMS` and `DEEP_BOSSES` by `scripts/seed-rooms.mjs` so the SQL and the TypeScript cannot drift.

`lib/campaign/` is new and server-only: `types.ts` (pure), `store.ts` (the tables), `gate.ts` (validation), `puzzle.ts` (row to `Puzzle` plus the prose map). The pure engine keeps knowing nothing about any of it.

---

## 4. Validation

This is the feature. Everything else is delivery.

### Instant, on keystroke, no solve

1. **Shape.** 3 to 8 floors, last one a boss, 2 to 5 options per floor, at least two checks on **different** abilities, at least one brace. That last one is not politeness: the header comment at `deeprun-data.ts:16` is explicit that the always-works option is load-bearing precisely so that no room is ever a wall, only a price. The validator enforces it rather than trusting an author to remember, and **it must never be possible to make a floor less of a decision than the house room it came from.**
2. **The arithmetic of despair.** Sum the cheapest brace on every floor. If that total is at or above the highest starting Vigour any allowed build can reach, nobody can walk out even by paying full price at every door. A loop over eight numbers, it catches the commonest authoring failure before a solver runs, and it is the first thing the desk says.
3. **Ability coverage.** At least three distinct abilities asked about across the whole dungeon. Ask about two and the build screen is decoration.
4. **Bounds.** Resolved TN 8 to 20, cost 1 to 6, Callings 2 to 4, Kit 3 to 6.
5. **Text.** Length caps, the blocklist, and a URL regex on title and intro. Any `http`, `www.` or bare `.com` / `.co.uk` / `.net` / `.org` / `.xyz` is a 400. Authors do not need links and this closes the spam vector for one regex.

### The solve, on save, debounced, server-side

Skipped entirely when the **mechanical hash** is unchanged: settings, plus per option its kind, ability, resolved tn and resolved vigour. Prose cannot move par, so typing prose never triggers a solve. Four lines, and it removes about ninety percent of the load, because prose is what an author is doing most of the afternoon.

Rate limited through the existing `rateLimit()` at ten solves an hour per identity. `nodejs` runtime, and it is a button-plus-status, never a spinner alone.

Everything below falls out of one pass over the enumeration `parFor` already performs, because the loop already visits every deduped build and already recovers its optimal step list. The extra cost is recording what the loop computes and throws away.

**Blocks. Publishing is refused, and the message names the floor.**

- **Nobody gets out.** Zero allowed builds reach `out` on their best line.
  > Nobody gets out of this one. The best character you allow, playing perfectly, runs out of Vigour on floor four. Give them more wind to start with, or make one door on floor four cheaper.
- **Fewer than three distinct builds get out.**
  > Only one kind of person survives this. That is a lock, not a dungeon.
- **More than ninety percent of builds reach par.**
  > Everybody scores the same. There is nothing to post.
- Any instant check above.

**Warnings. Never blocking, shown to the author, published on the card, and shown to the reviewer.** Sometimes a hard dungeon is the point, and a validator that refuses taste is a validator people route around.

- **A wall.** No check on that floor clears for any allowed build, so every player braces and pays. Names the floor and suggests allowing a Calling trained in the ability it asks.
- **A dominant door.** One option is taken by over ninety percent of best lines. *"Floor 3: everyone takes Cut the rope. The other two are furniture."*
- **A dead door.** An option no optimal line ever takes. One is fine, a trap should exist. Three on one floor and the floor is one choice wearing a hat.
- **A formality floor.** Every option resolves identically for every build. It is prose with no decision in it.
- **A forced Calling.** Over eighty percent of the builds at par share one Calling. *"Everybody who does well here is a Chanter. That is not a choice, it is a requirement."* On the card, because a player deserves to know before they build.
- **Very few get out.** Under a tenth finish. Allowed, and labelled honestly.

**And the report it always prints, pass or fail:**

> Par is 41. Nine of the thirty-six characters you allow get out alive. Floor three is where most of them stop. This one is Stiff.

The denominator is the deduped build count, which is already computed and is the honest number: two placements that agree on the modifiers this dungeon actually asks about are the same character.

**Difficulty is derived, never authored.** `out / builds` becomes one of *A walk / Fair / Stiff / Brutal / Only just*. An author cannot label a walkover as brutal or a meat grinder as gentle. This is the one thing on the browse card a player can trust, and it is why owning a solver is worth more than any star rating.

The stored `Report` carries the rule version that produced it, so adding a rule later means one batch re-run rather than a schema migration.

### Two prerequisite fixes, both real, both cheap

- **The username has no wordlist.** `profiles_read_all` at `00001_initial_schema.sql:47` is `using (true)`, and `/api/auth/signup` validates the username with `regex(/^[a-zA-Z0-9_]{3,20}$/)` and nothing else. The moment a byline goes on a public page, that is an unguarded moderation surface. The REFUSE list has to run at signup, and it has to land **before** anything is listable. This is a bug fix, not a feature.
- **The boost knack is committed blind.** `choose(option, true)` at `DeepRunGame.tsx:586` posts before any die is shown, while `KNACKS.boost` promises "add five to a roll **AFTER** you have seen the die. The only safety net down here." That affordance does not currently exist. Either implement a two-step commit for boost, or change one string. Change the string. Fix it before authors start balancing floors around a safety net that is not there, because the first wave of user dungeons will be calibrated to whatever the copy says.

---

## 5. Moderation

**The rule the whole flow is built on: nothing a user wrote is visible to a stranger without a human having read it.** Three tiers, and the queue sits on only one of them.

**Tier 1, unlisted.** Created instantly, playable instantly, reachable only at an unguessable ten-character code built the same way as the guest cookie id. No review, because the audience is exactly the people the author sent the link to, which is the same blast radius as a text message. This is what makes the product useful on day one with one author and no Hall, and it is what lets the queue shed load.

**Tier 2, the Hall.** Submitting for listing and marking is the reviewed step. `status` goes to `pending`. Phase 2.

**Tier 3, Chosen for the week.** Adam picks one from the top of the Hall. Already-approved content, one human decision a week.

**Automatic, in the route, no human:**

1. Account required to publish. Guests play, score and appear on the board; they cannot author. This is the one place in the product where an account is genuinely required, and the reason is precise: publishing text to strangers needs something to attach a reputation to and something to ban.
2. Rate limits through the existing helper: five creations an hour per identity, three Hall submissions a day per account, fifty unlisted dungeons per author with the oldest reaped.
3. The blocklist, in `lib/moderation/words.ts`, matched after normalising (lowercase, strip diacritics, map leetspeak digits back to letters, strip non-letters, substring). **REFUSE** returns 400 and stores nothing: slurs, sexual content involving minors, and the marks this project must never touch anywhere, which per `GAME_DESIGN.md` §9 means the D&D marks and abbreviations, Wizards of the Coast product identity, and any published creature, setting or deity name. **FLAG** saves but forces the queue with the hit highlighted: other publishers' settings and properties, plus ordinary profanity. Refusal names the offending term, because a silent rejection produces a support email.
4. The gate. A dungeon that fails a block cannot be submitted, so no human ever reads an unplayable one. This is the largest single moderation win in the design and it costs nothing, because the code already exists.

**Never "DM" and never "Dungeon Master", anywhere, including route names and metadata.** It is a registered mark. The author is a **Keeper**, and the byline reads "written by".

**Human, at `/admin/queue`, behind a `TP_ADMIN_IDS` env allowlist checked against `getIdentity()`.** Pending newest first, the report inline, every string in the dungeon in one scrollable column, and a link that plays it. Three buttons: **List**, **Return with a note**, **Return and ban**.

**Takedown** is a status change to `hidden`. Existing scores keep their numbers, the link stops working, the author is told which rule and why. **Binning a dungeon does not bin its rooms**, because a bad intro does not make six good rooms bad, and binning a room removes it from the pool but leaves it inside dungeons already published, so nothing that worked yesterday breaks today.

### The honest risk

The blocklist is trivially evaded. `D&D` becomes `D and D` and the filter never sees it. It is there to catch the accidental ninety-five percent and to make the deliberate case a documented breach of terms rather than something we hosted innocently. **Prior human review is the actual control, and it is one person who will at some point be on holiday, ill, or asleep.** The mitigation is structural rather than procedural: a stalled queue costs discovery and not play, so the worst case is a slow Hall rather than a dead product.

Two things follow from that and both are uncomfortable.

**A queue that is never drained looks identical to nobody writing anything.** The Hall shows an honest queue position and "usually within a day", and when the queue is over a day old it says so on the page. If the queue is routinely over three days, the honest response is to stop taking submissions rather than to keep a pending pile that reads as ignored.

**The legal position is mine and not advice.** Tavern Party becomes a user-to-user service under the Online Safety Act 2023 the moment strangers can encounter user content, and there is no small-service exemption, only proportionality. The design discharges most of it structurally, because prior human review of everything a stranger can see is the strongest illegal-content control available. What still has to be written is four short pages, not a legal product: an acceptable-content clause in `/terms` naming what is not allowed, a licence-to-display clause, a stated reporting route and response time (the contact form, one working day), and one page in `docs/` recording that an illegal-content risk assessment was done. The service has no direct messages, no images, no uploads and no free-form chat between users, which keeps it well away from the highest-risk duties. Have somebody qualified read it **before** the Hall opens, not after. Phase 1 does not open the Hall, which is another reason Phase 1 ships first.

---

## 6. Screens and routes

**Phase 1**

- **`/write`** — the desk index. Your drafts and your published dungeons with their numbers, and your rooms with how many dungeons have picked each one up. Account required.
- **`/write/[code]`** — the desk. One column, three sections, no canvas and no drag.
  - *The settings*: Callings as toggles, Kit as toggles, three Vigour radios, title, intro with a character count.
  - *The floors*: an ordered list, reordered by **up and down buttons** rather than drag with a keyboard fallback bolted on. Each slot is a native `<details>`: search the pool by title, band and author, or **Write this one**, which discloses the fields. "Move the numbers" is a second `<details>` inside that.
  - *The reckoning*: the gate's verdict, in a `<ul>` inside `aria-live="polite"` so changing a difficulty word announces the new verdict, every pass and fail carrying a word and a glyph as well as a colour. Two buttons: **Keep it and take the link**, and (Phase 2) **Send it to the Hall**.
  - Accepts `?from=<code>` to open pre-loaded from an existing dungeon, which is the on-ramp from the daily.
- **`/d/[code]`** — the door, and the URL that goes in the group chat. Title, author, the intro, the rules of this one in plain words ("Three Callings. Four things on the shelf. Vigour 9, which is standard."), par, the public half of the report including the derived difficulty word and any warnings, room credits where a room is somebody else's, and **Go down**. The run plays inline on this page. One page, no second route.
- **`/d/[code]?again`** — the same dungeon on today's re-seed, labelled Practice, board untouched.

**Phase 2** adds `/dungeons` (the Hall: **New**, **Well thought of**, **Yours**), the board on the door page, the mark button, the report link, `/admin/queue`, and a "Dungeons other people wrote" card on the daily hub.

**Routes.** All thin: zod, identity, store, engine, JSON, errors through `handleError`.

```
POST   /api/dungeons                 create a draft (account required)
PUT    /api/dungeons/[code]          save a draft
POST   /api/dungeons/[code]/report   run the gate. Rate limited 10/hour.
POST   /api/dungeons/[code]/publish  re-runs the gate server-side, refuses on a block
GET    /api/dungeons/[code]          the door page's data
GET/POST /api/daily/deeprun?c=code   PLAY. The existing handler, one branch.
POST   /api/dungeons/[code]/mark     Phase 2. One per account, after a finished run.
POST   /api/admin/dungeons/[code]    Phase 2. list | return | ban
```

**Play does not get its own route pair, and this is the best single call in the whole pile.** `/api/daily/deeprun` already carries the entire server-authority story for this game: the GET is the dungeon without its dice, the POST replays every step so far and returns only the floors committed to. A second copy of that handler is how you eventually ship one that forgets to strip the dice. One branch at the top, `const puzzle = code ? await dungeonPuzzle(code) : puzzleFor(date)`, and one `if (code)` at the bottom to bump `plays` and `finishes` instead of nothing. The daily branch is otherwise untouched, and **a dungeon never writes `daily_results`.**

Par is read off the row rather than recomputed, so a cold instance never burns 250ms per finish for a number that cannot change.

---

## 7. The plan, priced

### Phase 1: the desk. Ten to twelve days. Ships on its own.

Delivers full value with one author and no audience, which is the load-bearing claim: you write six rooms, a machine reads them and tells you your floor-four brace costs more than anyone is carrying, that nine of thirty-six characters get out, and that everybody takes the same door on floor three. That is a satisfying two hours with an audience of nobody. Every other tool of this kind gives an author nothing until strangers arrive, which is exactly why most of them never get strangers.

| | days |
|---|---|
| Engine generalisation: `puzzleFrom`, `defs` param, `baseVigour`, variable depth, seed on `dieFor`, `Puzzle.label`. Plus the identity test: a dungeon assembled from the rooms a given date would pick, on that date's seed, produces byte-identical `Result` and `par` to `/daily/deeprun`. That test is the proof the reuse is real. | 1 |
| `reportFor` and `gate.ts`: the enumeration rewrite, the three blocks, the six warnings, the messages, fixture tests over three dungeons (one fine, one unfinishable, one all tolls). Plus the enumeration-bound test. | 1.5 |
| Migration 00003, `scripts/seed-rooms.mjs`, `lib/campaign/{types,store,puzzle}.ts` | 1 |
| Five route handlers, zod, rate limits | 1 |
| `/write/[code]`, the whole desk including the pool picker and the disclosure | 2.5 |
| `DeepRunGame` `RunSource` prop, the `pruneProgress` fix, accessibility re-pass | 1.5 |
| `/d/[code]`, `/write`, share text, `?again` | 1 |
| Blocklist, the username fix at signup, the boost copy fix | 0.5 |
| Two house dungeons built in the real desk (which is also its usability test), `scripts/dungeon-smoke.mjs` (create, fail the gate, fix it, publish, play to the bottom through the public API), keyboard and 44px pass, then the five-command gate | 1 |

### Phase 2: the Hall. Five to six days.

`dungeon_runs` and `dungeon_marks`, the board, the mark button gated on a finished run, Wilson ranking with a ten-finish floor (1.5). `/dungeons` with three tabs (1). `/admin/queue` (1). Report link, terms copy, the risk-assessment page in `docs/` (1). Chosen-for-the-week stamp and the hub card (0.5).

Do not start this until Phase 1 has produced at least one dungeon written by somebody who is not Adam.

### Phase 3: craft. Five days.

Marks, the mechanic (2.5): `sets` / `needs` / `forbids` on an option, the runner, the DP memo key, the redaction contract (mark state comes back per `Line` so the client can tell which door vanished), the play UI, and **one extra validation rule that no design in the pile had: at least one brace per floor must be ungated**, or a marks system turns a floor into the wall the whole engine exists to prevent.

The log (2): store `steps` per play, aggregate per floor, and put the gate's **predicted** clear rate next to the **observed** one. *"You said sixty percent would get out. Thirty-one percent did."* That is the author's most interesting number, it turns the solver's one honest limitation into a feature, and it is the only mechanism anybody proposed that gives an author a reason to open the site tomorrow.

Room pickup counts and credits (0.5).

**Total, all three phases: twenty to twenty-three days.** One design in the pile closed with "this is not a lot of technical work". It is. It is about a month, and Phase 1 is about half of it.

---

## 8. What we are deliberately not building

- **Branching dungeons.** Par survives it; authoring does not. Every branch is prose most players never read. Add when an author asks twice.
- **Combat rounds, hit points, mobs as stat blocks, a bestiary.** There is no combat loop in this engine. A mob is a room. Say so plainly to authors rather than shipping a thin fake of it. One design proposed thirty hand-written bestiary adversaries as the cold-start answer, which is more prose than the entire shipped `deeprun-data.ts`, written by Adam, before launch. That is the item that slips, and the design that leans on it collapses when it does.
- **Author-invented Callings, Kit, abilities and knacks.** Every one widens the space the solver enumerates and is a direct tax on publishing latency, plus a second balance surface and a second moderation queue. Authors choose which of ours are on the table, which is the interesting half of the decision anyway.
- **Six freely-chosen array numbers.** Derived from the code. Free numbers is an unbounded balance hole guarding a knob nobody asked for.
- **Editing a published dungeon.** The code is the dice seed, so an edit silently invalidates par, the board and everyone's share text. Unlist and publish a new one. This cut buys immutability for one branch.
- **A robustness band across twenty seeds.** Pinned dice mean there is no luck to detect. Five seconds in one request to answer a question nobody asked.
- **Nightly dice re-rolls.** Buys replay, sells the fixed board and the author's ability to tune against a fact, and makes par unstorable so every finish pays a live solve.
- **Comments.** A second unbounded prose surface with no solver behind it, doubling the moderation bill for nothing at ten users.
- **Downvotes.** Upvote only, and the schema has no `value` column, so it cannot be used to bury a rival.
- **A reports table with auto-delisting.** Auto-hide is a griefing button. The contact inbox already exists and is already read.
- **Rewriting `/daily/deeprun` to serve user content.** One design auto-rotated the official daily out of the campaigns table, which puts a database read in the path of the purest deterministic module in the product, against the project's own stated architecture, guarded by an eligibility floor that is inert on a site with no traffic. Chosen-for-the-week is a curated link and a permanent stamp. *ponytail: the upgrade, if a chosen dungeon out-plays the house daily for two weeks running, is a `daily_features` table read in the route handler and never in `lib/daily/`.*
- **Guest authorship.** Play, score, mark and report as a guest. Publishing needs an account, for attribution, enforcement and takedown.
- **A rooms browse page, remix and fork, follows, feeds, notifications, search, images, maps, uploads, rich text, draft version history, creator payouts.** All of it is machinery for an audience that does not exist, and every upload is a storage bill plus the one moderation surface a wordlist cannot touch.
- **Multiplayer campaigns.** The live five-Act game is a different engine with drafts, simultaneous commit and deadlines. A dungeon is a solo crawl and saying so plainly is what keeps this shippable.
- **Anything generated by a language model, at authoring time or at play time.** `GAME_DESIGN.md` §7 already refuses it for dailies on determinism grounds, the reasons are identical here, and non-AI content written by a person is the thing you are actually selling.

---

## 9. The three biggest risks

**1. Nobody writes anything, and the pool stays twenty house rooms forever.**

Then this is a playlist builder, the creator market never opens, and the honest response is to delete it rather than keep adding to it.

*Early signal, week one:* **rooms written, not dungeons published.** A room is the cheap contribution and the one somebody makes on a first visit. If the daily's finish screen carries "That was ours. Build one of your own" pointing at `/write?from=house`, and two weeks of daily traffic produces zero rooms by anybody who is not Adam, the answer has arrived. Do not start Phase 2.

**2. Authoring is writing, and most people who want to make a dungeon do not want to write eighty short strings.**

This is the real killer and it is not moderation and it is not the technical work. Six floors is roughly eighty strings of prose. The mitigations are already in the design: the pool means the minimum publish is a pick rather than a write, three floors is a legal dungeon, and every slot opens on **Take one from the house** rather than a blank card. Nobody abandons an edit; plenty of people abandon a blank form.

*Early signal:* **the ratio of started drafts to published dungeons**, visible on the desk from day one. If the median author stops at floor two, the answer is more house rooms and a shorter form, not more validator. If they stop at floor six with the gate refusing them, that is the opposite problem and a much better one.

**3. A dungeon is solved after one run, and the browse page never gets used.**

The shipped module comment already concedes that after a run you know all seven numbers. Pinning the dice to the code makes that permanent. The realistic honest ceiling for this whole feature is: a player opens one stranger's dungeon because a friend linked it, and never opens the Hall. That private group-chat loop is the only one that works at this scale, and it is the one loop that never populates a browse page.

*Early signal:* the **ratio of plays arriving at `/d/[code]` directly against plays arriving from `/dungeons`**, from the day the Hall exists. If direct links are ninety percent of it after a month, the Hall is furniture and the product is a link generator, which is a smaller and perfectly respectable thing. Build for the link and stop investing in the ranking.

---

## 10. Where the judges disagreed, and how it was settled

| Question | The split | Settled |
|---|---|---|
| Fixed target numbers behind a difficulty word | Buildability said it deletes three problem surfaces at once. Craft said it deletes the craft surface and makes every band-2 room the same object. | The word is the **default**, with a clamped nudge behind a disclosure. Costs the solver nothing, since a TN is a constant per option. |
| Cutting `promise` | Buildability liked one fewer field, times four options, times six rooms. Craft found it rendered at the moment of decision at `DeepRunGame.tsx:576`. | **Keep it.** It is the only place an author's voice reaches a player while the choice is still open. |
| Marks | Craft called them the single best idea and priced them as three optional strings. Buildability traced them through the runner, the DP memo key, the redaction contract and the play UI. | **In, at Phase 3, priced at 2.5 days.** Craft is right that they are the only thing giving a dungeon a shape. Buildability is right that they are not a field. Plus one rule neither named: at least one brace per floor must be ungated. |
| Nightly re-seeding | One design's only answer to "play it twice". Craft showed it destroys tuning against a fact; buildability showed it makes par unstorable. | **Pinned dice, plus `?again` as labelled practice.** Five lines, no board write, and it doubles as the author's test run. |
| Six fixed floors | Craft and player both wanted 3 to 8. Buildability was neutral. | **3 to 8.** Measured at 247ms for the worst case. The cheapest lever on author completion rate in the whole pile. |
| Forced commons | Player judge said handing an author's room to a stranger with no opt-out will annoy exactly the population being courted. | **A checkbox, defaulted on, stated at the top of the form.** One boolean. |
| Auto-rotating the daily from user content | One design wanted it as the creator carrot. Buildability showed it puts a DB read in the purest module in the product. | **Chosen for the week is a curated link and a permanent stamp.** `lib/daily/` stays pure. |
| A reports table with auto-delist | Two designs wanted it, one said reuse `/api/contact`. | **Reuse contact.** Auto-hide is a griefing button and dead machinery at zero users. |
| Twenty-five house rooms | All four designs said twenty-five, quoting the file's own header comment. | **Twenty** at the time: five per band plus five bosses. The comment was wrong and got fixed. Every cold-start plan in the pile was a quarter optimistic. Now **thirty-three**, after bands one and two doubled to cut the repeat rate. Count the arrays. |

---

## 11. Two files to open first

`C:\Users\Adam\Documents\projects\TavernParty\lib\daily\deeprun-par.ts` is the product. Read `bestFor` and understand why the memo key is the whole argument, then work out how to keep per-build results out of the same loop without a second pass. That function is `reportFor`, and it is the eighty lines everything else in this spec hangs off.

`C:\Users\Adam\Documents\projects\TavernParty\lib\daily\deeprun.ts:476` is `defFor`, the only consumer of the module-level room map. Give it a `defs` parameter and the engine will serve somebody else's dungeon without knowing it has.