# Tavern Party — game design

The spec. Read this before changing a rule. Every number here is a balance
decision and belongs in `lib/game/rules.ts`, never inline in a component.

Four independent designs were written against different pressures and scored by
two judges, one on game design and one purely on whether the thing could be
built. They disagreed, usefully: the design judge picked a consequence-driven
design, the engineer picked a draft-driven one and priced the other's content
bill as multiplicative. This document is the graft — the draft design's content
architecture carrying the consequence design's spine — plus the fifteen
individual mechanics both judges independently said were worth stealing.

A rotating-GM design was disqualified by both judges on the same grounds: it
needed a specific named human to be present and responsive at a specific moment
or the game stopped. On a 2.5 second poll that is not a game, it is a hostage
situation.

---

## 1. What this is

Two to six players. One run of a little under twelve minutes. Everybody builds a character, the party
takes on five Acts together, and exactly one of you walks out with the Hoard.

The pitch, in one line: **roll a character, survive the night, and find out
which of you your friends were prepared to sacrifice.**

### The three things it has to get right

Taken from what people who actually love this hobby say about it:

1. **Class is the identity.** Roughly half of players pick class first, and the
   quote that keeps recurring is "a character is about 90% class, then 10%
   race". So the Calling is the first, loudest and most expensive choice, and
   everything downstream defaults from it.
2. **Character creation is not the preamble, it is the product.** People make
   characters for games they will never play, and enjoy it on its own terms.
   There is an entire game about doing exactly that. So creation gets over two of
   the ten minutes, it is competitive, and one of the four dailies is
   nothing but creation.
3. **A background has to be spendable, resolvable, or the thing that gets
   attacked.** Backgrounds die in practice because they are social features that
   only fire if somebody remembers them. The systems where they work — Beliefs
   that pay out when the table makes the game about them, Instincts that pay
   when following them gets you in trouble, Bonds that grant XP on resolution —
   all make the background into currency. §4 does all three.

---

## 2. The shape of the run

The figures below are the ones in `lib/game/rules.ts`, not an intention. Change
them there and this table is wrong.

| Phase | Seconds | What happens |
|---|---:|---|
| `MUSTER` | 16 | The house array is rolled and the priority order published. Nothing to decide, but a lot to read |
| `DRAFT_CALLING` | 35 | Ranked simultaneous commit on eight exclusive Callings |
| `DRAFT_KIT` | 30 | Ranked simultaneous commit on twelve exclusive pieces of Kit, **reverse priority** |
| `ASSIGN` | 70 | Place the six house numbers and choose a Hook. The biggest decision in the game |
| `ACT` ×5 | 60 each | Commit an Approach, and optionally nominate somebody |
| `ACT_RESULT` ×5 | 45 each | The ledger, what nobody took, a Signature or a Blood, and keep-or-hide |
| `BALLAD` | 35 | Laurels are cast, the Hoard is awarded |

Total about 710 seconds, so a little under twelve minutes. It was 630 and two of
those beats were too short to read: eight seconds of MUSTER did not reach sentence
two, and thirty seconds of `ACT_RESULT` had to cover your own itemised roll, up to
five other people's, two spendable once-a-night moves and a keep-or-hide decision
whose default on timeout costs you Renown. A beat nobody can read is not worth the
second it saves. Fixed regardless of
table size, because every phase is simultaneous: a six-player run takes the same
time as a two-player one, which is the main practical reason this shape was
chosen over anything turn-based. Nothing waits on a specific human: every phase resolves on
its deadline whether or not everybody acted, and the default action is a real
move rather than a skip (§5.4).

---

## 3. Building a character

### 3.1 The house array — ending the oldest argument in the hobby

The server rolls **six numbers once, from the room seed**, and every player at
the table assigns *those same six numbers* to their own abilities.

This is deliberate. The point-buy versus rolling argument is a fight between
process fairness ("the dice were fair") and outcome fairness ("we started
equal"), and it is unwinnable because each side is defending something
different. One shared rolled array satisfies both: real dice, identical
starting material, and the interesting decision — *where* the 17 goes and who
is prepared to live with the 6 — is entirely yours.

It also costs nothing to build: one seeded roll, no per-player redaction, no
fairness arithmetic.

The six abilities are **BRAWN, DEFT, GRIT, WITS, NERVE, CHARM**. Six, because
six is the shape people expect. Renamed, because the names are ours.

### 3.2 The Calling — eight, exclusive, first priority

Only one of each per table. Two players cannot both be the Knife, and being
denied your first choice is the point: it is the moment the draft becomes a
game rather than a form.

`WARDEN · KNIFE · HEDGE-WITCH · CHANTER · RECKONER · HOUNDMASTER · SAPPER ·
OATHBOUND`

A Calling gives: two ability affinities, one Signature (a once-per-run action)
and one Failing (a named weakness that a scene tag can exploit).

### 3.3 The Blood — eight, not exclusive

`HILLFOLK · LONGSHANK · FENBORN · ASHKIN · TIDEBORN · GRAVEWISE · THORNBORN ·
EMBERKIN`

Deliberately *not* scarce, and deliberately not a bag of stat bonuses. A Blood
bends the consequence economy rather than the arithmetic: Gravewise may Hide a
Scar for free once; Ashkin turn one Cost into Dread; Fenborn may re-assign one
house number after seeing the first Act. Structural, not numerical, so it
changes what you do rather than what you add.

All eight are wired. Five fire on their own, because there is no decision worth
a prompt in them: **Hillfolk** rerolls the first natural 1 of the run (a 1 always
fails, so declining is never right), **Longshank** reads the first Reckless
target number without a Torch, **Tideborn** starts one Hook token up, and
**Thornborn** and **Gravewise** resolve inside the keep-or-hide decision they
already belong to. The other three are a real choice at `ACT_RESULT`, against the
Act you just played, and share one engine action (`useBloodPower`): **Fenborn**
swaps two of their own numbers, **Ashkin** moves their Renown loss onto the party,
**Emberkin** gives the party back the Dread this result added.

**The altruism hole, closed.** Thornborn and Emberkin both spent themselves to
save the *party* a point of Dread, in a game where exactly one player takes the
Hoard. Read strictly, nobody should ever have drafted either. Both got a personal
kicker: Thornborn's free kept Scar also ignores the median gate in §6, and
Emberkin takes `EMBERKIN_RENOWN` for the shield. Small on purpose, so it reads as
a thank-you from the table rather than as the reason you did it.

**Ashkin needed the opposite fix.** "Take the cost as Dread instead" cannot be a
conversion rate: Renown runs to the dozens and Dread tops out at eight, so any
proportional rate lets one bad Act end the night. It is a flat `ASHKIN_DREAD`
against a full refund of whatever the failure actually took, which is enough that
the table notices and argues about it.

That refund is exact rather than nominal, and paying for it is why `resolveAct`
rewrites each `Outcome`'s deltas to what landed after the clamps at zero Renown
and at `DREAD_MAX`. A player with no Renown loses none, so a refund of the
*intended* cost would hand them Renown they never had.

### 3.4 The Kit — twelve, exclusive, reverse priority

Whoever won first crack at the Callings picks **last** on the Kit, and vice
versa. One reversed array in the code, and it turns a strictly-better draft
position into a genuine fork: the best Calling or the best gear, not both.

### 3.5 Ranked simultaneous commit

Every draft is the same interaction: submit up to **three ranked choices**, and
the lazy tick resolves them in priority order, granting each player their
highest surviving choice. Nobody waits for anybody. A player who submits
nothing is assigned their highest-ranked *available* option, and if they
submitted nothing at all, the first free one.

**The party list is public throughout.** Everyone can see what everyone else
has taken while they are still choosing, which is what makes a draft a read on
people rather than a menu. It costs nothing to build: it is the absence of
redaction.

---

## 4. The Hook — how a background actually changes the outcome

Twenty Hooks, not exclusive. Each one does three things, and it is all three
together that stops it being flavour text.

### 4.1 It inserts a scene into everybody's night

Every Hook names a **scene tag the server guarantees to place** into the
five-Act deck. Pick `DEBTOR` and a creditor turns up, for the whole table, in
somebody's Act. Pick `DESERTER` and there is a patrol.

Your background is not a note on your sheet. It is an edit to the adventure
everyone else has to play, and they can see whose fault it was.

Implementation is a constraint on the encounter generator, satisfied greedily,
not authored content.

### 4.2 It is a power supply your opponents control

Each Hook carries **two Hook tokens**, worth +5 each. They refresh **only when
your Hook tag is called against you.**

This is the whole trick, lifted from the systems where backgrounds actually
work. Your fuel is in other people's hands. Being singled out stops being
something that happens to you and becomes the thing you were hoping for, and
the player who leans into their own worst trait is rewarded for it rather than
quietly punished.

### 4.3 It makes you the cheapest volunteer, in public

At the top of every Act the server prints which players' Hook tags are live.
Being Marked pays you **+2 Renown** for taking the Act at all, and costs you
**−1** for flinching from it. The table can see the Mark, so it is also a
target: everybody knows who ought to be going through that door, and everybody
knows what it is worth to them.

---

## 5. An Act

### 5.1 Assembly, not authorship

A scene is assembled from tags rather than written per outcome. This is the
decision that makes the game shippable by one person: the alternative priced
out at thirty scenes times four approaches times four outcomes of hand-written
prose, which is a content bill that multiplies. Ours is additive — a flat pool
of scenes, a flat pool of tags, and a generator.

### 5.2 Three Approaches

Each Act offers exactly three, each with a named ability, a target number, a
Deed value and a Consequence. One is the **Reckless** line: it pays most, its
target number is **hidden** unless somebody spends to reveal it, and **only one
player per Act may take it.** Information is purchasable, which stops every Act
being a solved sum, and exclusivity is what makes nomination a hostile act
rather than a suggestion.

**The Reckless line is deliberately a bad bet for a player with no claim on it,
and that is not a balance failure.** Measured across all thirty scenes, a
normally-trained character (+4) has lower expected Renown on the Reckless line
than on the best safe line in every single one. The same character, Marked for
the Act or spending one Hook token, has it as the best line in every single one.

So the door has a natural claimant each Act rather than being a free lunch, the
Mark publicly says who that is, and nomination is a way of shoving somebody who
is *not* the claimant into a bet they should not take. If a future change makes
the Reckless line good for everybody, exclusivity, the Mark, the hidden number
and nomination all stop mattering at once.
`tests/unit/content.test.ts` pins both halves of that.

One consequence: **the Reckless line is exempt from the Dread cost doubling.**
It already carries the worst cost in the scene against a fixed reward, so
doubling it as Dread climbed made the one contested door strictly worse exactly
in the Acts where the table is arguing about who takes it. Your own Failing tag
still doubles it, because your weakness is your weakness.

### 5.3 The itemised ledger

**Never print a total. Print the named sources that made it.**

> You needed 14. You rolled 11.
> **+2** Deft. **+1** the tarred rope. **+5** you have done this before.
> Nineteen. The door gives.

Modifiers are already `{ label, value }` objects, so this is a join rather than
authored prose. It is also the entire narration budget: the game reads as
written prose without anybody writing prose per outcome. Every number the
player sees can be traced to a word.

### 5.4 Flinch — what happens when somebody closes the tab

The deadline default is **not** a skip, a stall or a bot. It is a real move
called Flinch: **−1 Renown, +1 party Dread**, narrated as the character
hesitating. It scores badly and it taxes everyone, which means an absent player
is a problem the table can see and reason about rather than a stalled phase.
One branch in the engine, and it is the complete answer to a closed tab.

**Flinching scales with Dread, like every other cost.** It used to be flat,
which made standing still the arithmetically correct play the moment Dread
crossed the threshold: a failed middle line cost four to six Renown and not
moving cost one. A design that needs "everybody flinches" to be an unstable
equilibrium cannot also make flinching the cheapest option once things go
wrong.

### 5.5 Nomination

Before committing, you may **nominate** another player for the Reckless line.
Nominators split half their prize if they pull it off, and each eat **2 Renown**
if they do not. You can shove somebody through a door, and it costs you if they
do not come back.

### 5.6 Contention

Shared resources — Torches — are resolved by the version column that already
exists for optimistic concurrency. Two players grab the last one, the lower
version wins, the loser is refunded and takes **+1 Dread**, and it is narrated
as *you both grab for it in the dark*. The race condition is the mechanic.

### 5.7 Scars: keep or hide

Every failure leaves a **Scar**, and a Scar is both a wound and an asset. One
dice-free decision, every Act:

- **Keep it.** Public. It pays at the Ballad, and it raises your Dread.
- **Hide it.** Private. It costs Renown now, and no Dread.

### 5.8 Dread

One integer on the room row, collective, with **published hard thresholds**
rather than a soft divisor nobody fears:

- **At 3** every Cost doubles.
- **At 5** the Night turns, and the last Act is drawn from a worse deck.

Dread is what makes *everybody flinches* an unstable equilibrium. Somebody has
to go through the door.

### 5.9 After the Act

The reveal shows **the Approaches nobody took**, and what they would have paid
or cost. One extra field in the resolve payload, and it is where the regret
lives.

---

## 6. The Ballad

- **Renown**, accumulated.
- **Kept Scars**, which pay *only if your Renown is at or above the table
  median*. Without that gate a player can win by never taking a risk, which is
  the degenerate strategy every consequence economy has to clamp.
- **Laurels.** One secret vote each, worth 8, never for yourself. It means the
  player who is out of contention by Act IV still holds something the leaders
  want, right up to the last second.
- The **Hoard** goes to exactly one player. The party survived together; one of
  you got paid.

---

## 7. The four dailies

All four pin **the dice and the inputs to the date** and publish a **par computed
exactly**, not sampled. "Two under" is a better thing to post than "47 out of 62".

The four are deliberately four DIFFERENT SHAPES, and that constraint has already
cost one of them its place. The original set had both The Long Way Down and Table
of Six, which were the same puzzle in different coats: here are N dice you can
already see, assign them to N targets. Table of Six was the barer of the two and
it went.

1. **The Long Way Down.** Today's five Acts, fixed dice, played solo, every
   number visible up front. Assignment under perfect information, and par is the
   best achievable score by exhaustive search.
2. **The Deep Run.** A dungeon, six floors and something at the bottom. Build a
   character on tonight's six numbers, then choose a door per floor, and here is
   the whole point: **each room owns its die and you only see the number once you
   are in the room.** The dice are still pinned to the date, so everybody in the
   world meets the same seven numbers in the same order and two scores mean the
   same thing, but you are choosing blind. That makes it the only daily where the
   variable is nerve rather than arithmetic.

   Every room offers two ability checks on different abilities plus one option
   that always works and always costs Vigour, so no room is ever a wall, only a
   price. Par stays cheap to compute for a nice reason: because the die is fixed
   before you choose, there is no probability in the problem at all, so the whole
   search collapses to a table over (floor, Vigour, knack still in hand, marks).

   **You are told what you are trying and what it costs to get it badly wrong.
   You are told no numbers at all.** A door names the action, why somebody would
   pick it, and what a catastrophe on that particular door leaves on you. It names
   neither the ability it leans on nor the number it wants.

   Both redactions were made for the same reason, and the second reversed an
   earlier decision, so it is worth writing down properly. The first: with "Deft,
   you bring +4, needs 11" on every door, the fastest way to play well was to
   ignore every word of the writing and take the biggest number, which is the
   wrong incentive for a game about a dungeon. At a table you say what you are
   going to do and the person running it tells you what to roll, so the fiction
   comes first and the stat is a consequence.

   The target number survived that cut on the argument that this is a bet rather
   than a riddle. That argument assumed the number sat on top of a real choice,
   and counting the pool showed it did not: **every room prices all of its checks
   identically**, so the target was the only thing separating one door from
   another, and "read three numbers, take the smallest, never read a word" was
   still the whole optimal strategy. Adam's question, shown "the room wants an
   11", was "eleven what, and do I just pick the lowest number?". Yes, and so
   would anybody.

   What replaced it is not a difficulty word. That was tried, and it read "Looks
   fair" on all three doors of a floor wanting 11, 12 and 13, which is noise
   dressed as signal. What replaced it is the **stake**: what going badly wrong on
   this door leaves on you, authored per door. It is a fact about the fiction, it
   cannot be sorted into an order, and it says nothing whatsoever about whether
   you personally will make it. Risk you can picture instead of a number you can
   rank.

   The number is not hidden, it is **deferred**. The reveal prints the whole
   itemised sum and "it wanted 14" the moment the floor resolves, which is where
   it teaches you what you should have read rather than letting you skip the
   reading. Working out that "set your feet and meet it" is Brawn and "wait, then
   step out of the line" is Deft *is* the game.

   **A failure has degrees, and they cost differently.** A check that misses by
   three or less is a graze and is forgiven a point of the bill. An ordinary miss
   costs the door's price plus one. A 1 on the die, or a miss by eight or more, is
   a *ruin*: two more than an ordinary miss, its own authored sentence, and on
   most doors its own mark left on you. Before this, missing by one and missing by
   nine were the same sentence and the same bill, which is most of why three doors
   read as three routes to one fixed outcome.

   Grading was affordable for the same reason par is: **the die is thrown before
   anybody chooses**, so the margin is a constant per door per character, and the
   band is as knowable up front as "does it clear" always was. The par search
   gains no dimension, the memo table does not widen, and the solve stays exact.
   That was the one thing that could have made this unaffordable, and it does not.

   A sharper version of the same point, measured rather than assumed: **the
   gradient is invisible to par.** Zeroing the near-miss relief and the ruin
   surcharge, and removing the fumble rule, produces an identical par on eight
   sampled days and on the demo dungeon, because par's optimal line never eats a
   failed check at all. Everything the gradient does, it does strictly below par,
   which is exactly where it should do it: it changes what a bad night feels like
   without moving the number a good one is measured against.

   The flat gradient underneath is still there and still deliberate. A brace costs
   its price and clears the floor; a failed check costs the price plus one and
   clears nothing, so it forfeits four points as well.
   Before the extra point the two Vigour figures were equal and the screen read
   "same cost, free upside", which is a fair reading of what it said and a wrong
   reading of the game: valuing leftover Vigour at the point each is worth, the
   break-even was already "gamble only if you are better than two thirds likely to
   clear". The extra point moves that to about 71% on a shallow floor and, more
   importantly, makes the gradient visible without algebra. It costs nothing
   anywhere else: a perfect player knows the die and never fails a check, so par
   and the winnability guarantee do not move. Measured: the daily's clear rate
   under perfect play is unchanged, and The Stone Walk keeps par 50 while the
   share of characters who get out falls from 142 of 240 to 130. It is a tax on
   guessing wrong, which is the only thing it should be.

   **Marks** are the fourth term and the only mechanic where one floor changes a
   later one. A door may leave a word on you ("wet", "carrying the lamp"), and
   another door further down may want it or refuse it. Three rules hold the whole
   thing up:

   - You come away with a mark from a door that **worked**, or from one that went
     catastrophically wrong. An ordinary miss leaves you the bill and nothing
     else. That keeps "carrying the lamp" meaning you got the lamp, while letting
     a disaster on floor two be the reason a door on floor five is shut.
   - A mark is **never taken back**. That keeps the state monotone, which is what
     keeps par a table rather than a tree, and it means nobody can write a
     dungeon where a door is open, then shut, then open again.
   - **At least one option per floor that always works must be ungated.** A gated
     brace is a wall, and the whole engine exists so that a floor is a price.

   **Every day can be finished, and that is checked rather than hoped for.**
   Every room carries fixed targets and every floor throws a die pinned to the
   date, and for a while nothing connected the two: about one day a month dealt
   six poor dice, every door in the dungeon was shut, and nineteen Vigour of
   tolls against a starting nine meant nobody on earth could finish that day.
   Nine days in two hundred and forty, found by playing it rather than reading
   it. The assembly now re-draws the dice until at least one sensible character
   can get out, which costs one cheap pass per candidate and no search at all:
   because the die is fixed before you choose, the least a character can spend on
   a floor is zero if any door clears for them and the cheapest brace otherwise,
   so "can anybody get out" is a sum rather than a search. Three other fixes were
   tried and thrown away, and one of them is instructive: deriving the targets
   from the die is exactly right at the desk and a **leak** here, because the
   target is printed before you choose, so a target that came from the die would
   tell you the die.

   The cost of that guarantee is measured: the share of characters who get out
   under perfect play goes from 84% to 87%, and no day is impossible.

   Adding the failure gradient and the marks moved that figure back to **84%**,
   measured the same way over thirteen sampled days a month apart (1129 of 1350
   enumerated characters), with par landing between 48 and 61. Three points is the
   price of a ruin costing two more than an ordinary miss, and it is the right
   direction: the tax falls on guessing badly rather than on guessing. What that
   means for a **human**, who does not play perfectly, is still unknown, and the
   play log is what will answer it. A first pass with a probe that reads the
   numbers off the screen scored 32 against a par of 51 and did not come back,
   where a probe that ignored them scored 8, which is at least the right shape.

   The house daily uses marks, but **only the half of the mechanic a dealt pool
   can support**, and the distinction is exact.

   For its whole life before this the pool used none of them, while this document
   described them as the thing that turns six rooms into a descent. The descent
   really was a list. The stated reason was that rooms are shuffled per band, so a
   door wanting the lamp would land in dungeons where nothing hands one out. That
   reasoning is correct, and it applies to `needs` only.

   - **`needs` is an authored-dungeon feature.** It is sound when somebody fixed
     the floor order and can guarantee the mark is handed out above. It is dead
     content in a dealt pool, and the campaign gate blocks it as such: six `needs`
     doors were written into the pool during this pass, and the gate caught them
     on a day that dealt a floor wanting "lit" with nothing above it handing a
     light out.
   - **`forbids` has no such problem**, because carrying nothing leaves every door
     open. A fresh run can never meet a wall, and the only way to shut a door is to
     have picked up the thing that shuts it. That is where all of the bite is.

   Four marks, and four is a budget rather than a round number: par memoises on the
   subset of marks some door tests, so the table is bounded by two to the power of
   the marks read. `lit` is a thing you win; the other three happen to you.
3. **The Ledger.** A five by five debt grid solved by constraint propagation
   from four true statements. No dice in it anywhere. Up to three CHECKS, each of
   which costs you a mark, and the number you used is the score you share.
4. **Muster.** Build a character on a fixed budget to beat today's named
   encounter. Character creation as its own game, because for a lot of people it
   always was.

**On generating a daily with an LLM at request time: no.** Two hard reasons
rather than a cost one. A daily has to be the identical puzzle for everybody or
the score is not worth posting, and a score has to be checked server-side against
something deterministic, which a language model is not. Using one offline to help
author more rooms is a different thing entirely and is worth doing.

---

## 8. Deliberate ceilings

Marked `ponytail:` in the code, with the upgrade path named.

- **Two players is thin.** Every scarce pool is floored at its four-player size
  regardless of table size, so a duo still gets denied things. It is a
  mitigation, not a fix, and a two-player table will always have less draft
  tension than a five-player one.
- **No free text anywhere.** The one thing app versions of this hobby genuinely
  lose is permission to try the idea you just had and have it adjudicated. We
  cannot adjudicate free text, so we do not pretend to: every choice is a real
  option with a real number, and the Reckless line's hidden target number is
  where the unknown lives instead.
- **The Deep Run repeats a room across a pass boundary.** Rooms are dealt rather
  than drawn: slot `n` of an endless deal is card `n % N` of pass
  `floor(n / N)`, each pass its own shuffle, so inside a pass a repeat is
  impossible. Two passes meeting are two independent shuffles, so the same card
  can land either side of the join. Measured: drawing fresh each day repeated a
  room from the previous day on ninety per cent of days, dealing took that to
  forty-two, and doubling bands one and two took it to fourteen. Closing the
  join exactly would need every pass to know every pass before it, which a
  function addressed by a date cannot do without keeping state. The upgrade path
  is more rooms, not more cleverness: band one is dealt two a night, so a pool of
  twelve empties in six days and a pool of twenty in ten.
- **No daily room uses a mark.** `sets` / `needs` / `forbids` is the mechanic
  that makes six rooms a descent rather than a list, and only authored dungeons
  use it. The daily cannot yet, because rooms are dealt per band independently:
  a floor that `needs` the lamp could be dealt with no floor above it that hands
  one out, which is the dead end the brace rule exists to prevent. The upgrade is
  a deal that guarantees a setter above every reader, which is a design change
  rather than a fix, so it wants a plan before code.

---

## 9. Intellectual property

**We copy the system and invent the words.**

Game mechanics are not copyrightable in either the US or the UK, and the case
law is not marginal: `Baker v. Selden`, `Allen v. Academic Games`,
`DaVinci Editrice v. ZiKo Games` (a mechanically identical reskin of a
published card game did not infringe), and in England `Nova Productions v
Mazooma Games`, where copied gameplay was held to be ideas and principles
rather than a substantial part. Copyright Office Circular 33 is explicit that
copyright does not protect the method of playing a game.

So the d20 against a target number, the six abilities, the (score − 10) / 2
curve, advantage, saving throws, hit points and the rest are all free, with no
licence and no attribution.

What we do **not** do is ship anybody else's *text*. The SRD is available under
CC BY 4.0 and using it would be legal, but the obligation travels with the
asset forever and it permanently brands the product as derived from someone
else's game. Every Calling, Blood, Hook, scene and line of copy here is ours,
which is cheaper, better branding, and lets the numbers be tuned for a
fifteen-minute browser session rather than a four-hour table.

Never in this product: the D&D marks anywhere including metadata and ad copy,
Wizards of the Coast Product Identity creatures, any named setting or deity,
any art or typeface from a published product, and anything scraped from a wiki,
a fan compendium or a virtual tabletop.
