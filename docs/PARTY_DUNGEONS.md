# The party dungeon: recommendation

Verified against the repo. Every count, line number and file below was read, not assumed.

---

## 1. Is it worth building at all?

**Yes, and the first thing it buys you is unblocking the builder.**

`docs/CAMPAIGN_BUILDER.md` is sitting at "agreed, not yet built" with a status block that says Phase 1 cannot start until this question lands, because the engine generalisation is the same line item. So the cheapest deliverable in this whole pile is the answer in section 2, written into that status block, at a cost of zero days.

Beyond that, three concrete reasons it is worth the six days in section 8, and one it is not.

- **The multiplayer surface has exactly one mode and it is a knife fight.** One Hoard, secret Laurels worth 8, and `KEPT_SCAR_NEEDS_MEDIAN` making your payoff a direct function of somebody else's Renown. That is a good game. It is not the only thing people want to do with four friends and twelve minutes, and the product currently cannot offer them anything else.
- **The marginal cost is small because the builder is already paying most of it.** Phase 1 of the builder buys `puzzleFrom(design, seed)`, `dieFor` on a seed rather than a date, variable depth, `run(puzzle, build, steps, defs)` and a `baseVigour` that is already a serialised field nothing reads. A party layer on top of that is one new engine file, three phases and a redaction branch.
- **It is the strongest available answer to the builder's own risk 3.** That risk says the realistic ceiling of the whole creator feature is a player opening one stranger's dungeon because a friend linked it, and never opening the Hall. A party delve is that loop with teeth: the link is not "beat my score", it is "we are doing this Friday, all four of us." Same link, same row, a reason to open it together.

The reason it is not worth it: if you build it before the builder's engine generalisation, you pay for that generalisation twice. Do not.

**It is not a pillar.** It is the second half of the builder, priced at six days against the builder's twenty to twenty-three, and it must not reshape Phase 1.

---

## 2. Does one authored encounter feed both surfaces?

**Yes to the party, no to the Act, and the reason is that the party surface is rooms.**

The hypothesis assumed the party dungeon would be Acts. It is not. A dungeon is a descent, and the content unit for a descent is `RoomDef`. So the compile that matters is the identity function, and the type is the one already agreed in `docs/CAMPAIGN_BUILDER.md` §3:

```ts
// lib/campaign/types.ts, exactly as specified. No change.
export type AuthoredRoom = {
  id: string;
  band: 1 | 2 | 3;
  boss: boolean;
  title: string;
  setup: string;
  options: AuthoredOption[];   // 2..5, >= 2 checks on different abilities, >= 1 brace
};
```

There is no `Encounter` superset, no `toScene`, no `toRoom`, and `Scene` and `RoomDef` both stay exactly as they are. **Party play adds rules on top of the same content, not a new content type. The party dungeon needs zero new authoring.**

The `Scene` direction is dead, and it is dead on measurement rather than taste:

- **Shape.** I counted the pool: 20 rooms, 12 with two checks and 8 with three. `Scene.approaches` is a fixed three-tuple and `tests/unit/content.test.ts:153` additionally requires three distinct abilities. Sixty percent of the shipped room pool cannot become an Act without new authoring, and widening the tuple silently changes the Act screen, the bot's door choice, the scramble fallback at `engine.ts:925` and the "what nobody took" reveal, all of which assume three.
- **`reckless` is a joint numeric invariant, not a flag.** `content.test.ts:274` and `:285` pin it in both directions across all thirty scenes. Yes, it is derivable: I parsed all 90 approaches and every one of the 30 Reckless lines is TN 16 to 18, every safe line is 9 to 15, every Reckless line costs exactly 2 Dread, and `deed` is `tn - 8` give or take one. But derivable reproduces the house style, it does not prove the invariant holds for a stranger's numbers, and the builder's own difficulty table already puts band 3 and boss checks at 16 to 18. A compiled Scene's Reckless line would be indistinguishable from an ordinary deep check.
- **Dead fields both ways.** `deed` and `cost.dread` have no room counterpart; `vigour` has no Act counterpart. Unifying gives every author three fields no surface they can see will ever exercise, which is precisely where authored content rots.
- **Tags are a guarantee.** CLAUDE.md's own hard rule: every tag comes from `lib/content/tags.ts`, and inventing one silently breaks a Hook's Insert guarantee. `buildDeck` promises each player's `insertTag` appears in the deck. Letting authors point at that makes somebody's guarantee leaky in a game the author never played.

**The design that lost: "Somebody Else's Night"** (campaign as `Scene[]` played through the Act machine). It loses because it asks strangers to author Scenes, which the builder spec has already refused for good measured reasons and which would need a second builder, and because the Act machine has neither a descent nor a run-ending failure state, which are the two things that make a dungeon a dungeon. Its one genuinely valuable finding is unrelated to any of this and should be fixed on its own: see section 8, Phase 0.

---

## 3. Shared die or one each

**One die per room, shared by the whole party, pinned before anybody chooses and revealed when the room resolves.** Not close.

1. **It is what the code already does.** `dieFor(date, roomIndex)` in `deeprun.ts:169` returns one number per room, keyed on nothing from the path. Builder Phase 1 re-keys it on the dungeon code. A party sharing it means the party is playing the same object the solo player is playing, so the `par` and `Report` already stored on the dungeon row at publish time are the party's benchmark for free. Per-player dice would mean the numbers on the card describe a dungeon nobody in a party is playing.
2. **It preserves the property everything hangs off.** `deeprun-par.ts` opens by saying there is no probability anywhere in the problem, which is what turns the search from a tree into a table. A pinned die is the same constant for six people as for one. Head count does not touch it.
3. **It is one room rather than six parallel rooms.** With independent dice the author has not written a room, they have written a paragraph six people read separately. There is no shared moment and nothing to talk about afterwards.
4. **It is cheaper.** One seeded number instead of n, and no per-player die to leak in `viewFor`.

**The obvious objection is already answered by the shipped rule.** "Everybody sees a 2 and braces" cannot happen: the die is pinned before you choose and revealed after. Four blind commitments, then the number.

**The real cost, named: correlated failure.** A low face fails every check at once, and a natural 1 fails every check regardless of build. Two mitigations already exist in the content and need no new rule. A brace does not read the die, which is exactly the property `deeprun-data.ts:16` calls load-bearing, so a bad face is a price rather than a wall. And each player pays for their own door, so a bad face is n small bills and never a wipe. Measure the brace share per head count before shipping, the way `dreadThresholds` was found. If braces are over a third of decisions at six players, the die is buying tension with tedium.

**The counter-argument that lost:** that a shared die re-correlates what `scenes-a.ts` was built to decorrelate, and creates a `dreadThresholds`-shaped supply problem. Both are true only in a design that keeps Dread as a party currency. Mine does not. See section 4.

---

## 4. Co-operative or competitive

**Co-operative. One result, no Hoard, no Laurels, no median gate, and `standingsFor` is not called.**

The Act game is the competitive one and it is good at it. A dungeon that reads as a delve and scores as a knife fight is a worse version of both, and it is not what was asked for: "take bots with you to help" is a co-operative sentence.

Individual credit still exists, and it is deliberately social rather than scored. Two counters, both already derivable from the `Line` array with no new state: doors cleared, and Vigour paid. One sentence each on the end screen. *"TALL FEN got through four. OLD MARGET paid for three of them."* The moment a personal number exists somebody optimises for it and stops bracing, and bracing is the mode.

**What having both costs.** The code half is cheap: a twenty-line `partyResult(room)`, a result screen and a share line, about a day. Two things are not cheap:

- **Identity.** The front page, the rules page and the metadata all promise one competitive night with a Hoard at the end. A co-op delve with no winner is a second promise, and it is the mode most likely to be opened by somebody expecting the first one. That is lobby copy work, not engine work, and it is the actual bill.
- **Anything that reaches for `standingsFor`.** The median gate is what makes the Act game work and it is exactly what a delve must not have. Keep the competitive scorer owned by the Act game, untouched and still tested.

`ponytail: no Hoard in a delve. If playtests say a party wants a winner, feed doors-cleared to standingsFor. One line to add, and impossible to remove once players have learned it.`

---

## 5. Party-size scaling

Three rules. One of them is a function, one of them is a proof that no second function is needed, and one of them is a list of things that must never scale.

### The one function

```ts
// lib/game/rules.ts, next to dreadThresholds, for the same reason.

/**
 * How many of you have to get through for the room to count.
 *
 * The same class of problem as dreadThresholds. There, the SUPPLY of Dread
 * scaled with head count against a fixed ceiling. Here the supply of ATTEMPTS
 * scales with head count against a fixed room, so a room that is a price at two
 * players is a formality at six unless what the room ASKS scales too.
 *
 * Half of you, rounded DOWN. Down rather than up because ceil() asks an odd
 * table for two thirds where an even one is asked for a half, which means the
 * third and the fifth person to turn up make the run harder. floor() never asks
 * for more than half, so the integer error runs the other way and a friend
 * arriving reads as help. n = 1 gives 1, which is the solo daily unchanged.
 *
 * The threshold decides only whether the room COUNTS. It never decides whether
 * you descend, and it never decides what anybody pays.
 */
export function clearedBy(players: number): number {
  return Math.max(1, Math.floor(players / 2));
}
// 1 -> 1   2 -> 1   3 -> 1   4 -> 2   5 -> 2   6 -> 3
```

### The pot, and why there is no second function

Vigour becomes one pool on the room rather than n pools on n players. This is the load-bearing choice of the whole design and it does four jobs at once: it removes elimination structurally rather than with a special case, it creates the failure state the Act game has never had, it makes the shared resource the thing the mode is about, and it keeps the carried state a scalar.

```ts
// lib/game/delve.ts
room.vigour = players.reduce((t, p) => t + startingVigour(characterOf(p)), 0);

// per floor
const through = lines.filter((l) => l.cleared).length;
const counted = through >= clearedBy(n);
room.vigour -= lines.reduce((t, l) => t + l.vigourSpent, 0);
```

**You pay for your own door whatever the party did.** That is the rule that makes the arithmetic head-count neutral by construction rather than by tuning: the pot is roughly `11n`, and the per-floor bill is `(failures + braces) * price`, both of which scale with `n`. The ratio is independent of head count, which is why there is no `partyVigour(n)`, no new constant, and nothing to re-measure when a fifth friend turns up.

Two cost rules that look reasonable and are not, both of which a designer reached for before the arithmetic corrected them: a shortfall bill charged to the party rather than the individual (bracing then gets double-charged and becomes strictly worse than failing, and large parties never fail at all), and putting the pot on `room.dread` to reuse `dreadThresholds(n).max` as the ceiling (a `4 + 3n` ceiling grows slower than a per-head bill). Neither survives contact with a simulation. Do not reason about this rule, measure it.

**Scoring, on the solo scale, so the dungeon's stored par is a real comparison:**

```ts
score = roomsCounted * ROOM_CLEARED
      + (bossCounted ? BOSS_BEATEN : 0)
      + (out ? OUT_ALIVE + Math.floor(room.vigour / n) : 0);
```

Six people leaving with 36 in the pot are exactly as comfortable as one person leaving with 6, so *"the best one person managed down here was 47, and four of us came back with 39"* is an honest sentence.

### What must never scale

Target numbers, per-door prices, floor count, the boss. Those are authored, and the dungeon's stored `par`, `out/builds` and derived difficulty word were computed against them at publish time. Move them per head count and the number on the card stops describing the dungeon. Scaling target numbers additionally reads as the game cheating because your friends turned up.

**Dread does not come down here.** No cost doubling, no turn, no thresholds. One proposal reused `dreadThresholds` in the delve and, to keep one runner, pushed Dread back into the solo Deep Run daily. That is a real balance change to a shipped, tuned, exactly-par'd surface in order to serve a mode nobody has played yet. Refused. The solo daily comes out of this feature byte-identical, and there is a test for it.

---

## 6. Bots

**What they do.** `reachOn(p, ability)` at `engine.ts:154` already scores a door as ability modifier plus affinity plus Kit, and rooms carry abilities, so the existing policy transfers with a type change. Two lines on top:

```ts
// Take the door you are best at. Brace only when the door is genuinely out of
// reach: faceNeeded is already shared with the "so a 12 or better" line the
// daily prints, so a bot's judgement and the player's are the same judgement.
const best = options.filter(o => o.kind === "check")
  .sort((x, y) => reachOn(p, y.ability) - reachOn(p, x.ability))[0];
const choice = faceNeeded(best.tn, reachOn(p, best.ability)) >= 15 ? brace : best;
```

**What stops it being a way to make a hard dungeon easy.** Three things, none of them a new mechanic.

1. **`clearedBy` counts bots.** A bot is an attempt and, at every even boundary, half a raised bar. One argument to one function, and that is the entire anti-cheat.
2. **A bot brings a pot share and a bill share.** Its `startingVigour` goes into the pool and its failures and braces come out of it. Neutral by exactly the construction in section 5.
3. **Bots are mediocre by drafting.** `applyCallingDraft` at `engine.ts:525` gives a bot two shuffled wants. It is not going to be trained for the door it needs.

**What they deliberately do not do:** read the party. A bot never braces because somebody else failed, never covers the threshold, never spends a token. Coordination is the human layer and the bots are there to be coordinated around. That is also what keeps them legible: you can look at BRAY's sheet and know which door BRAY is taking, which makes planning around a bot a real and slightly annoying part of the puzzle rather than an oracle.

**Measure before the front page sells it:** the one-human-five-bots table, separately. It is the shape most likely to feel like solitaire, and if it does, the fix is one line capping bots at half the party, which changes what the lobby can promise.

---

## 7. What changes in the engine

Everything below assumes builder Phase 1's engine generalisation has landed: `puzzleFrom(design, seed)`, `dieFor` on a seed, `startingVigour(who, base)`, `run(puzzle, build, steps, defs)`, variable depth. That is one day of the builder's own Phase 1 and either effort can pay for it.

**1. `lib/game/rooms.ts` (new, but it is a move, not new logic).** Lift `Character`, `characterFor`, `startingVigour`, `resolveOption` and `knackApplies` out of `lib/daily/deeprun.ts`, which currently keeps `resolveOption` module-private. `deeprun.ts` imports them back. This matters for one reason and it is a hard rule: `lib/game/*` is imported by client components (`Act.tsx` imports `lib/game/resolve`), so `lib/game/delve.ts` importing `lib/daily/deeprun.ts` would put room content one import away from a bundle. The move keeps the direction `daily -> game` and keeps both new files taking a `Puzzle` plus a prose `defs` map, which is the shape builder Phase 1 is already giving `run()`.

While in there, move `reachOn` from `engine.ts:154` into `rules.ts`. It deletes two duplicate copies of the same arithmetic, at `deeprun.ts:449` and `deeprun-par.ts:65`, both of which hardcode `2` where `AFFINITY_BONUS` lives. `deeprun.ts:33` already carries a comment about exactly this happening with `DIE_SIDES`, `CRIT` and `FUMBLE`. Three implementations become one and the diff is negative.

**2. `lib/game/rules.ts`.** `clearedBy(players)`, above. Nothing else.

**3. `lib/game/delve.ts` (new, about 180 lines, pure, rng injected).**
- `beginDelve(room, now, rng)` draws `runSeed` from the injected rng, loads the floors, sets `room.vigour`.
- `characterOf(player, puzzle)` maps a `Player` to a `Character`. About ten lines, and the honest reuse point.
- `commitDoor(room, playerId, optionId, useKnack, now)` validates membership, phase and deadline and throws `GameError`, same contract as `commitApproach`.
- `resolveFloor(room, now, rng)` fills in bot commits, applies deadline defaults, draws one die from `dieFor(runSeed, floor)`, calls the moved `resolveOption` once per player, counts clears against `clearedBy(n)`, subtracts the bills from the pot.
- `endFloor(room, now)` descends, or finishes when the pot hits zero or the last floor is done.
- `partyResult(room)` out, floors counted, per-head Vigour, score, and the two per-player counters.

**4. `lib/game/types.ts`.** `Phase` gains `"BUILD" | "DELVE" | "DELVE_RESULT"`. `Room` gains `dungeonCode?`, `vigour?`, `runSeed?` and `delve?: DelveState`. `Player` gains `knackLeft?`. `DelveState` mirrors `ActState` and reuses `Line` from the Deep Run.

**5. `lib/game/engine.ts`, four branches and nothing else.**
- `startRun` forks on `room.dungeonCode`: a delve goes to `BUILD`, everything else goes to `MUSTER` as today.
- One new action, `buildCharacter(room, playerId, {callingId, kitIds, scores}, now)`, validating against the dungeon's allowed pools and reusing `assign`'s existing multiset check at `engine.ts:600`.
- `tick` gains three cases that delegate to `delve.ts`.
- `viewFor` gains a delve branch. **The redaction contract, in full, because this is the part that is a security bug if it is wrong:** `runSeed` is the whole dungeon's dice and must go in the `Omit` on `RoomView`, with a test asserting `JSON.stringify(viewFor(...))` contains no seed. `choices` are redacted until `lines !== null`, exactly as `act.choices` are. The die is null until the floor resolves. A declared knack is public before the roll, exactly as `act.boosted` is at `engine.ts:1729` and for the reason that docblock gives.

**Drafts do not come down.** In a delve the Calling and Kit are not exclusive: two Wardens is fine, because a delve is a party of adventurers rather than a competitive draft, and the exclusivity justification in `types.ts:43` ("being denied your first pick is what makes a draft a game") is a competitive-game justification. This is not a simplification for its own sake: it makes the party's builds a subset of the builds the stored `Report` already enumerated, so the dungeon's par and difficulty word still describe what the party is playing. It also deletes `MUSTER`, both draft phases and `ASSIGN` from the delve in favour of one 90-second `BUILD` phase which is the Deep Run's existing build screen with n people filling it in at once. Everybody's sheet fills in live, because with no exclusivity there is nothing to gain from hiding it and seeing it is how you cover the party's gaps.

Bloods and Hooks do not come down either. A delve is Calling plus knack plus Kit, exactly as the daily is.

**6. Routes.** `POST /api/room/[code]/build` and `POST /api/room/[code]/door`. Two thin handlers, zod, identity, `store.mutate`, engine, JSON. `createRoom` accepts `?d=<dungeonCode>`. One extra read from `lib/campaign/store.ts`, which builder Phase 1 already built. No new table.

**7. Does not change at all.** `resolve.ts`, `scoring.ts`, `draft.ts`, `deck.ts`, `random.ts`, `resolveAct`, `rollApproach`, `costMultiplier`, `settleNominations`, `standingsFor`, `dreadThresholds`, every Signature, every Blood, `Scene`, `ApproachDef`, all thirty scenes, every existing Act test, and `lib/daily/` behaviour. The delve never calls `rollApproach` and never touches `room.dread`, so none of the Act economy is reachable from it and none of it needs a guard.

**Nothing exponential in head count at request time, ever.** The dungeon's `par` and `Report` are read off the row. Do not compute a party par. The shared pot means you could later (the carried state is `(floor, pot, knacks)`, a table rather than a vector), which is the ponytail note to leave in `delve.ts`, but the honest benchmark is the one already on the card: *"the best one person managed down here was 47."*

---

## 8. The plan, priced

### Phase 0. Today. Zero days of party work.

Write section 2 into the status block of `docs/CAMPAIGN_BUILDER.md` and start builder Phase 1. It has been blocked on this and it is the ten to twelve days that matter most.

**One unrelated fix this review turned up, worth half a day whatever you decide about the party mode.** `components/room/Act.tsx:12` and `components/room/Result.tsx:14` are client components importing `SCENES_BY_ID`, so **every hidden Reckless target number in the game currently ships in the JavaScript bundle**. The UI honours the redaction (`Act.tsx:377` reads `act.recklessTn`), the bundle does not. That means the Torch, Longshank's `seeOneReckless` and the Reckoner's Signature are all selling information the player can read in devtools, against `types.ts:115` and against CLAUDE.md's own "no answer in a payload". Fix: put the redacted scene on `ActView`, delete the two client imports. One change, and it also removes thirty scenes from the bundle.

### Phase 1. The party delve, on house rooms. Six days. Ships alone.

This is the important structural claim: **phase one needs the builder's engine generalisation and nothing else from the builder.** No desk, no `/write`, no Hall, no authored content. `roomsFor` is reused with a run seed instead of a date, against the twenty rooms that already exist. If you want the multiplayer win before the creator win, this can go first and the builder inherits the generalisation.

| | days |
|---|---|
| `lib/game/rooms.ts` (the move), `reachOn` into `rules.ts` deleting two duplicate sums, `clearedBy`, plus the identity test that the solo daily is byte-identical afterwards | 0.75 |
| `lib/game/delve.ts`: `beginDelve`, `commitDoor`, `resolveFloor`, `endFloor`, `partyResult` | 1.5 |
| `engine.ts`: three phases, `buildCharacter`, four branches, the `viewFor` delve branch and the `runSeed` omit | 1 |
| Two route handlers, `createRoom` taking a dungeon code | 0.5 |
| Client: the build screen for n players, the floor screen, the pot, the threshold sentence, the commit list, the ledger column, the result. Reuses the room panel through the `RunSource` prop builder Phase 1 is already adding | 1.5 |
| Bots: door policy and brace-when-out-of-reach | 0.25 |
| Tests: a pinned dungeon at every head count 2 to 6 asserting the pot only falls, that `clearedBy` counts bots and that the run ends at zero pot rather than at a failed floor; the `runSeed` redaction assertion; `scripts/delve-smoke.mjs` polling like a real client and acting on the buzzer | 0.5 |

**Total six days.** Then the five-command gate, and never `npm run build` while `npm run dev` is up.

### Phase 2. Authored dungeons in a party. One day.

One branch: `roomsFor(runSeed)` becomes `dungeonPuzzle(code)`, which builder Phase 1 already wrote for `/api/daily/deeprun?c=`. Plus a lobby card carrying the dungeon's title, byline, stored solo par and derived difficulty word.

**Gate: do not start this until builder Phase 1 has shipped and at least one dungeon exists that Adam did not write.** That is the builder doc's own gate and it applies here unchanged.

### Phase 3. Measure, then tune. Two days, before it goes on the front page.

The harness in the shape `tests/unit/dread.test.ts` already uses, a few thousand runs per head count from two to six. Three numbers: out-rate by head count, brace share by head count, and the one-human-five-bots table measured on its own. Then tune, and the first lever is the authored starting Vigour dial (7 / 9 / 11, already a field), not `clearedBy` and never the target numbers.

**Nine days total, six of which ship alone.**

---

## 9. The three things most likely to make this a mistake

**1. The shared pot turns one person's bad round into everybody's bill, and it reads as blame.**

This is the central mechanic and it is the one that could be actively unpleasant, particularly with strangers from Quick Match rather than four friends on a call. The mode also assumes a coordination conversation the site does not host.

*Early signal, six playtests, no instrumentation needed:* count how often somebody apologises out loud, and count braces as a share of decisions at five and six players. Over a third bracing and the shared die plus the shared pot is buying tension with tedium. The first lever is the starting Vigour dial. The honest structural answer, if it comes to it, is that the delve is a private-table mode and never appears in Quick Match, which costs nothing to decide and a lot to reverse.

**2. It is a second identity for a product that has one.**

The front page, the rules page and the metadata all say one competitive night with a Hoard at the end. A co-op delve with no winner is a different promise, and the mode most likely to be opened by somebody expecting the first one.

*Early signal, from the day it is behind a lobby toggle:* the share of tables choosing the delve, and the completion rate of each mode. If delve tables start and abandon at a materially higher rate than Act tables, the mode is being opened by the wrong expectation. The fix is lobby copy, not rules, and it is cheap if you catch it in week one and expensive once the mode has a reputation.

**3. The builder never produces a dungeon anybody but Adam wrote, and the party mode has nothing to eat.**

This is the builder's risk 1 and the party mode inherits it whole. It has its own version, and its own signal is better.

*Early signal, three months after builder Phase 1:* the ratio of party delves on house rooms to party delves on authored dungeons. If ninety-five percent are house content, the party mode is a second house mode. That is a perfectly respectable thing to have built for six days, but it means the party mode is not the reason the builder exists, and the right response is to stop investing in the creator side rather than in the party side.