# The Deep Run character

What a persistent character in the solo daily can and cannot be, what it costs,
and the five things it is not allowed to become.

Read `docs/PARTY_DUNGEONS.md` §5 first for the house style on refusals: a
refusal with a measured reason is a design decision, a refusal without one is a
mood.

---

## 1. The complaint

A D&D player played the Deep Run and said this:

> "The character building is so underwhelming, that is mine and most people's
> favourite part of D&D, people get attached to their characters, they are role
> playing as that character. They get attached to them. Here I am making a few
> choices from a very limited selection, then throwing the character away within
> minutes. I want to make their backstory, choose races and classes from a wide
> array, I want to see my character grow."

Three wishes in one paragraph, and they have three completely different prices.

| Wish | Price |
|---|---|
| "throwing the character away within minutes" | free, and it is the one that actually stings |
| "choose races and classes from a wide array" | measured at 21 to 78 seconds a publish. §6.1 |
| "I want to see my character grow" | not a budget problem. §6.2 |

He is right about the first one and it is the cheapest thing in the document.
The other two are refused with numbers.

---

## 2. The decision

Build a runner who outlives the run, in `localStorage`, carrying a name, a
Blood, a Hook and a list of scars, none of which the solver can see.

**And keep it off the wire.** This is the load-bearing choice and every earlier
draft got it wrong. Three separate proposals put `name`, `bloodId` and `hookId`
on `Build`, then spent a page arguing that `characterFor` does not read them and
`parFor`'s dedupe signature does not include them and therefore par is safe.

All of that is true and none of it needs saying, because the fields should not be
on `Build` at all.

```ts
// lib/daily/deeprun.ts, unchanged, and that is the point
export type Build = { callingId: string; placement: number[]; kitIds: string[] };
```

The sheet is client state. It goes into `localStorage`, into the sticky panel,
and into the text the player pastes into a group chat themselves. It never
reaches `app/api/daily/deeprun/route.ts`. Consequences, all of them things that
do not have to be built:

- `validBuild` gains no case. There is no new trust boundary because nothing new
  is trusted. A free-text name that never crosses the wire needs a length cap for
  layout and nothing else.
- The POST body schema is untouched, so a hostile client cannot post a Blood at
  all, never mind a mechanical one.
- Constraint 3 is satisfied by absence. An authored dungeon's stored `par`,
  `difficulty` and `report` (`00003_campaigns.sql:37-39`) were computed against
  the characters the author allowed, and a character with a name is still one of
  those characters, because the name is in a different process.
- No migration, no table, no route.

The one runnable check that guards the whole thing, and note it is an import
test rather than an arithmetic test:

```ts
// tests/unit/deeprun-purity.test.ts
// The daily takes the identity from Blood and Hook and none of the mechanics.
// If either of these ever appears in the daily's import graph, somebody has
// quietly priced the sheet, and every stored par in `dungeons` is now a lie.
for (const f of ["lib/daily/deeprun.ts", "lib/daily/deeprun-par.ts", "lib/campaign/gate.ts"]) {
  expect(read(f)).not.toMatch(/content\/(bloods|hooks)/);
}
```

Add one arithmetic assertion beside it if it makes anybody feel better:
`bestFor(puzzle, build)` returns the same `score` for two calls, which it
already does, and would keep doing whatever a sheet said. `bestFor` is the
exported one (`deeprun-par.ts:172`); `parFor` takes a `Puzzle` and no `Build`,
and `mechanicalKey` is module-private, so the tests two earlier drafts proposed
would not have compiled.

---

## 3. What ships, in order

Three days. Each phase is releasable on its own, which matters because the first
half day is the part worth putting in front of the friend before the other two
and a half are spent.

### Phase 0, half a day. The ledger.

`lib/daily/hero.ts`, one key, sitting beside `tp_daily_done`:

```ts
const HERO_KEY = "tp_hero";
type Hero = {
  name: string;
  bloodId: string;
  hookId: string;
  born: string;              // ISO date
  nights: { date: string; depth: number; out: boolean; score: number; par: number }[];
  scars: { date: string; title: string; text: string; kept: boolean }[];
};
```

Read and write it with `readJson`/`writeJson`, which are already in
`lib/daily/local.ts` and already swallow a blocked or full store without
surfacing an error. `pruneProgress` sweeps only keys starting
`tp_daily_progress:` (`local.ts:70-84`), so a sibling key survives the ninety-day
sweep that eats an unfinished run.

Wiring is one call. `DeepRunGame.tsx:303-311` already has the block that fires
once on finish and already holds everything the ledger wants:

```ts
recordNight(reply);   // next to the existing finishDaily(...)
```

**Archive practice does not count.** `local.ts:8-11` says `done` records archive
completions deliberately, because the calendar question is "have I played this
day?". The ledger's question is different and the answer is the opposite: a
practice run on an old night whose seven dice you already know is not a night
this character went down. `reply.archive` is in the payload. One boolean, but
somebody has to choose it, and without it "eleven nights down" is a number built
on the one path the codebase has already conceded does not count.

Above card one, one line of text, and nothing else changes on the screen:

> MAERD. Eleven nights down, six out alive. Best 51.

Plus the name in `shareText`, which currently heads on the date and does not
mention the character at all. Add the runner, keep the date, and add the Calling
while in there, because the Calling is the one thing in the build that par is
actually computed over and it is absent from the share today.

At this point there is no creation screen. The name is one text input with an
empty placeholder, and until it is filled the strip shows the ledger and no
name. Zero content bill, and the half of the complaint that stings is answered.

### Phase 1, one day. The creation screen.

A card above "One. Who is going down", called "Zero. Who this is". Three lines
in it: a name, a Blood, a Hook.

The prose is already written and already rendered. `BLOOD_DETAIL`
(`bloods.ts:120-137`, eight entries) and `HOOK_DETAIL` (`hooks.ts:185-226`,
twenty entries) exist at exactly the length a creation screen wants, and
`app/characters/shared.tsx` already has the `Entry` component that renders them
for `/characters/origins` and `/characters/backstories`. Its own header comment
says this prose "was rendered by nothing at all" until those pages existed. So
this is the third consumer of a component that already ships, not a lift from
`components/room/Assign.tsx`.

Blood is dealt. Hook is chosen. §5.

The design risk, stated plainly because it is the only real one in the document:
the build screen is a `max-w-2xl` column holding three cards and a ninety second
promise. Twenty more buttons in it kills the daily. That is why Phase 0 ships
first and separately, and why the Blood costs no buttons at all.

### Phase 2, one day. The scar and the memo.

At the bottom of a run that cost something, one prompt lifted from
`decideScar` (`engine.ts:1061-1080`): keep it in public, or say nothing. Kept
scars print on the sheet and in the share. Hidden ones stay in the logbook.

The scar text is already written. §4.

### Half a day of docs and tests.

The import test above, `titlesOf` if titles are wanted, the refusal in
§6 copied into `docs/CAMPAIGN_BUILDER.md` §8 beside the two at `:492`, and one
six-word fix to `app/characters/origins/page.tsx` (§7).

---

## 4. The scar is already written, all fifty of them

This is the finding that changes the price, and it is why the estimate is three
days rather than the four an earlier draft arrived at.

Every option in the Deep Run has an authored `lose` sentence, and every one of
them is written as a wound rather than as a log line:

```
"It gets under your arms and you spend a while on the floor learning what its
 hands are for."
"You move a beat early, it corrects, and you take the corner of the wall with
 your shoulder."
"It does not care about your voice at all, and you find that out at close range."
```

And the runner already carries it:

```ts
// lib/daily/deeprun.ts:705
text: cleared ? def.win : def.lose,
```

`Line.text` is in the payload the client already has. So a scar is not derived,
generated or concatenated. It is the sentence Adam wrote for that door, retrieved.

An earlier draft proposed minting a scar from `{room.title} · {option.label}`,
priced it at zero, and illustrated it with a phrase the dataset cannot produce.
That version renders "The Long Dark · Just keep walking", which is a CSV row in
a fantasy jacket, and a skeptic correctly killed it and then correctly priced the
fix at forty-eight new phrases. Both were reasoning about the wrong field. The
prose is one field over and it is finished.

**Two things follow that are worth more than the saved half day.**

`gate.ts:166` refuses to publish an option whose `win` or `lose` is blank. So
every authored dungeon carries its own scar prose, written by its own author, for
free, forever, with no new author field, no new required input on the desk and no
second moderation surface. That is the opposite of the failure mode
`CAMPAIGN_BUILDER.md:491` refused by name when it turned down the bestiary.

Which line becomes the scar: the highest-`vigourSpent` line that did not clear.
A run where nothing failed leaves no mark. That is the threshold an earlier draft
left unspecified when it wrote "eleven nights, four scars", and it is the right
fiction as well as the right arithmetic: a clean night down there is a night you
came back whole.

Content bill for the scar: zero words.
Content bill for the whole feature: about eighty words of UI copy.

---

## 5. The Blood is dealt. The Hook is chosen. They are not the same thing.

Two of the eight-and-twenty look interchangeable on a creation screen and are
not, and getting this backwards is the one place an earlier draft made a promise
the code contradicts.

**The Blood is dealt, from a hash of the guest id.** The pattern is
`suggestedHookId` (`Assign.tsx:71-73`), one line.

Three reasons, in ascending order of how much they matter.

1. Eight buttons leave the ninety second screen. That was the expensive half of
   the design day.
2. The party game deals it and says why in the code:

   ```ts
   // lib/game/engine.ts:467-471
   // Bloods are not scarce, so they are dealt rather than drafted: it keeps the
   // Calling the loudest choice and saves a whole phase.
   ```

   `docs/GAME_DESIGN.md` §3.3 is headed "The Blood, eight, not exclusive", and
   `/characters/origins` already ships a section titled "Why these are dealt"
   which argues that being handed one is the better half of the deal: "You get
   somewhere to be from that you would not have picked, and then you have to make
   it true." Offering a Blood *choice* in the daily puts the same eight items in
   the product with the opposite affordance and makes a live public page argue
   against a live screen.
3. The cross-game promise is false for Blood. An earlier draft's payoff was that
   the sheet's Blood "goes mechanical the moment he sits at a multiplayer table".
   `startRun` overwrites `player.bloodId` from a shuffle on every run. Maerd the
   Fenborn sits down and is dealt Gravewise. The arc is contradicted at the exact
   moment it was supposed to pay off. Do not fix this by honouring the sheet at
   the table either: that deal exists to spread eight distinct powers across a
   table, and letting five players all be Thornborn is a rules change bought
   with a nicer sheet.

**The Hook is chosen, from all twenty.** Suggested by hash, with browse-all
behind a disclosure, which is exactly the shape `Assign.tsx:337-381` already
ships. And here the cross-game promise is true: `assign` (`engine.ts:597`)
validates a freely chosen `hookId` against all twenty, so pointing
`suggestedHookId` at `tp_hero` means the runner walks into a multiplayer table
with their own past, where a Hook inserts a scene into everybody's night. That is
two lines and it is the best thing in the document after §4.

So the friend's "I want to make their backstory" is answered by the twenty Hooks
and a name. "I want to choose my race" is answered with a place he is from that
he did not pick, and a public page that already explains why that is better.

---

## 6. What is refused

### 6.1 Ancestry and backstory as mechanical axes. Refused, measured.

His literal ask. Eight ancestries times twelve backstories is ×96 on the solve.

Measured on this machine, an eight floor design at the caps (4 Callings, 6 Kit,
all six abilities asked across the floors), five seeds, because the cost depends
on how many duplicate values the array holds and not on the machine:

| seed | array | `parFor` |
|---|---|---|
| ZZZZZZ | 15,13,11,11,12,11 | 225 ms |
| AAAAAA | 12,14,7,12,14,16 | 568 ms |
| HIGHVR | 15,14,8,8,10,12 | 613 ms |
| QWERTY | 10,4,10,12,14,13 | 623 ms |
| STONEW | 9,17,10,13,13,15 | 811 ms |

The daily, six floors, real rooms: 35 ms (2026-01-01, array
13,12,13,10,12,12), 156 ms, 223 ms, 463 ms (2025-12-31, array 11,8,15,6,12,15).
Both the brief's ~400 ms and an earlier draft's 661 ms sit inside the authored
range; a later draft's 1,756 ms does not, and was measured on something else.

×96 on 225 to 811 ms is **21 to 78 seconds a publish**, against a builder that
recomputes while somebody is typing. Refused. This is the same refusal as
`CAMPAIGN_BUILDER.md:492` on author-invented Callings and Kit, for the same
reason: every new axis is a direct tax on publishing latency.

The lazy shape if it is ever wanted anyway is already sitting there. Add the
factor to `enumerationBound` and let `instantProblems` police it, so an author
who wants ancestries pays for them by allowing less Kit. Do not add a fourth cap.

### 6.2 Growth as power. Refused, structurally.

Nothing on the sheet ever makes the character stronger. Not one point, not ever.

This is constraint 1 and no budget touches it: a character who is stronger than
mine is not playing my puzzle, and "two under par" is the only reason a score is
worth posting. It is also constraint 3: the moment a runner is stronger than the
set an author's card was measured against, "nine of the thirty-six who could come
here get out alive" is a lie, and that sentence is the only thing on a browse card
a player can trust.

What the sheet accumulates is history and disfigurement. Say that to him out loud
rather than dressing a record up as progression. If growth-as-power is the actual
wish then it lives in the party game, which has an arc, a Ballad and Renown, and
the daily is where the character is kept between nights.

The only version of tiered power that does not lie is a separate stored par per
tier, which is N solves per publish instead of one. Not worth it.

### 6.3 Blood powers in the daily. Refused, and this one has a specific culprit.

Six of the eight `BloodPower` variants have no referent in a solitaire run. There
is no Dread (`costToDread`, `dreadShield`), no Scars during play (`freeHide`,
`keepScarFree`), no Hook tokens (`extraHookToken`), and no hidden target numbers,
because the daily prints every TN before you choose. Only `rerollFumble` and
`reassignOne` mean anything down there.

`reassignOne` is the one that ends the conversation. It makes the character stop
being constant across floors, which is the premise `bestFor`'s memo rests on: the
DP key is `(roomIndex, vigour, knackLeft, marksHeld)` and would have to carry the
placement. No cap fixes that; it is a different solver.

Blood as a chosen 3-of-8 axis is ×3 on top, so 675 ms to 2.4 s at the caps,
which is over the typing budget on its own before any of the above.

**Refused, and written down here as the third refusal beside the two in
`CAMPAIGN_BUILDER.md:492` and `PARTY_DUNGEONS.md:150-154`: the daily takes the
identity from Blood and Hook and none of the mechanics.** The import test in §2
is what enforces it.

### 6.4 Mechanical Hooks in the daily. Refused, and it is not the price.

The shape is genuinely cheap. `insertTag`/`callTag` are a permutation of the
twenty-tag vocabulary, so each tag is the `callTag` of exactly one Hook and the
other nineteen dedupe into one no-op class. The factor is small.

It is refused because there is nothing to wire it to. `RoomDef` and `OptionDef`
have no tag field, and `lib/daily/deeprun-data.ts` contains zero `sets:`, zero
`needs:` and zero `forbids:` across all twenty rooms, so the house dungeon reads
no marks at all. Marks are author-named free words ("wet", "carrying the lamp"),
not the tag vocabulary. A mechanical Hook is a new field on twenty rooms, a new
required author surface and a new axis in `enumerationBound`. Three costs for a
bonus.

### 6.5 A hero mode walking the Hall. Refused, and it is worse than it looks.

The most ambitious proposal on the table was a persistent character walking
authored dungeons one at a time, graded against `bestFor(puzzle, herBuild)`
rather than the world's par, with a graveyard. Six days. Two parts of it are
good and named in §8.

It does not survive the Hall's actual contents. `lib/campaign/seed.ts:14`:
"ONE DUNGEON, WRITTEN PROPERLY. The Stone Walk, six floors." One listed row.
`demo-dungeon.ts:322` allows four of eight Callings. With the strict Calling
filter that mode requires in order to keep the card honest:

- Chanter, Reckoner, Houndmaster and Sapper have zero doors on launch day. Half
  the Callings on the two-day creation screen terminate in an empty Hall.
- The other four get one door, walk it once, and then also have zero doors. A
  character's entire life is six floors, which reproduces "throwing the character
  away within minutes" verbatim with a graveyard attached.
- The hand of three cannot deal three.

And the supply is not renewable by doctrine: `CAMPAIGN_BUILDER.md:494` and `:496`
refuse both editing a published dungeon and re-rolling its dice, because the
dice are pinned to the code. Consumption is per player per lifetime; supply is
human authoring. The mode is offered as the reason the Hall gets deep and needs a
deep Hall to be playable. That circle is the same one
`CAMPAIGN_BUILDER.md:491` already refused once when it turned down thirty
hand-written bestiary adversaries as a cold-start answer.

One more thing that mode got wrong, and it matters beyond the mode. Its
containment proof covers `par` and nothing else on the card. `reportFor` derives
`builds`, `out`, `difficulty` and the "everybody who does well here is a Warden"
note from `enumerate` (`gate.ts:409-451`), which walks six **rotations** of the
array, not `arrangements(6, r)`. Measured on the eight-floor fixture above:
`enumerationBound(4,6)` returns 360, `reportFor` reported `builds: 144`, and
`parFor` solved thousands of distinct characters for the same design. So the
survival share on a browse card is a statement about a rotation sample, and a
rank-ordered character is essentially never in it. That is a pre-existing
inconsistency rather than a bug in par, `gate.ts`'s own docstring overclaims it,
and it is now written down. Do not build a difficulty ramp on that number until
somebody reconciles the two loops.

### 6.6 A `heroes` table. Not refused, deferred, with the trigger named.

`localStorage` reaches everybody, including the guests who are most of the
audience, and it is where the whole product's per-player daily history already
lives. A table reaches nobody extra today.

The honest limit, and it is not the one an earlier draft claimed. That draft
argued `tp_hero` is "exactly as durable as the signed `tp_guest` cookie". It is
not: `tp_guest` is server-set and `httpOnly` (`identity.ts:63-66`), and Safari's
ITP purges script-writable storage after seven days without a first-party visit
while leaving a server-set cookie alone. So on iOS the cookie can outlive the
ledger, and the symptom presents as "the site forgot me" rather than as a device
migration, which means a deferral triggered on "somebody asks to move devices"
never fires.

```
ponytail: tp_hero is localStorage and iOS may purge it after a week idle. The
upgrade is one `heroes` row keyed on `player_key`, the same column shape as
dungeon_runs and dungeon_marks (00004_hall.sql:14-47), plus a guest-to-account
claim on signup. Build it the first time somebody says the site forgot their
runner, not the first time somebody says they changed phone.
```

---

## 7. One existing page needs six words

`app/characters/origins/page.tsx:58-62` renders every Blood's power as
`facts={[["Once a run", b.powerText]]}` on a public, internally linked page.

Today that is harmless. The moment a daily player has LONGSHANK printed on their
sheet, they follow the site's own nav and read "Once a run, look at the Reckless
target number without spending a Torch" about a power that never fires down
there. The mitigation an earlier draft proposed, "the sheet must not print
`powerText`", does not cover it, because the leak is on a different page.

Change the fact label to scope it: `["At the table, once a run", b.powerText]`.
Six words, and the page keeps its whole argument.

---

## 8. What this changes about the daily

For a player who ignores all of it: one line of text above card one, and one more
line in the share. The three cards are untouched, the descent is untouched, the
arithmetic is byte-identical, and the ninety second promise is intact.

For a player who fills it in: they meet a person on the first night and send that
same person down a different hole every night after, because the Calling is dealt
as three of eight by the date. That inversion is the answer to the complaint. The
daily currently makes you invent a stranger and bin them.

Two ideas kept from the mode refused in §6.5, both cheap, both later:

- **Their own ceiling.** `bestFor(puzzle, theirBuild).score` is one memoised DP
  walk, roughly 0.1 ms, already exported. "The best line you had in you was 39"
  is a better teaching signal than "two under par" because it is about them, and
  it scales nothing and lies about nothing. Half a day, any time.
- **The report sentence on a door.** `gate.ts:368-374` already computes and
  stores "everybody who does well here is a Warden". Print it. Free, and it is
  the first time picking a Calling costs anything. Do it after somebody
  reconciles `enumerate` with `parFor`, per §6.5.

---

## 9. The bill

| | days |
|---|---|
| Phase 0, the ledger, `lib/daily/hero.ts` plus one call | 0.5 |
| Phase 1, the creation screen, reusing `characters/shared.tsx`'s `Entry` | 1.0 |
| Phase 2, the scar and the memo | 1.0 |
| Import test, docs refusal, the six-word origins fix | 0.5 |
| **total** | **3.0** |

New prose: about eighty words of UI copy. New tables: none. New routes: none.
New migrations: none. New author surfaces: none. Solver multiplier: ×1, by
construction rather than by argument, because nothing new crosses the wire.

What is not in the three days, named so nobody assumes it: the `heroes` table and
the guest-to-account claim (§6.6), titles derived from the ledger, and a written
backstory. A paragraph of free text is a moderation queue, and the only free text
in the product today is a display name.

```
ponytail: no written backstory, twenty Hooks and a name instead. Add when the
dungeon submit queue is a real moderation surface, which it nearly is.
```
