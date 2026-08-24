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

Two to six players. One run of a little over ten minutes. Everybody builds a character, the party
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
| `MUSTER` | 8 | The house array is rolled and the priority order published. Nothing to decide |
| `DRAFT_CALLING` | 35 | Ranked simultaneous commit on eight exclusive Callings |
| `DRAFT_KIT` | 30 | Ranked simultaneous commit on twelve exclusive pieces of Kit, **reverse priority** |
| `ASSIGN` | 70 | Place the six house numbers and choose a Hook. The biggest decision in the game |
| `ACT` ×5 | 60 each | Commit an Approach, and optionally nominate somebody |
| `ACT_RESULT` ×5 | 30 each | The ledger, what nobody took, and keep-or-hide |
| `BALLAD` | 35 | Laurels are cast, the Hoard is awarded |

Total about 630 seconds, so a little over ten minutes. Fixed regardless of
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

**Known hole, to close when the powers are implemented.** Thornborn and Emberkin
both spend themselves to save the *party* a point of Dread, in a game where
exactly one player takes the Hoard. Read strictly, nobody should ever draft
either. Both need a personal kicker: Thornborn's free kept Scar should also
ignore the median gate in §6, and Emberkin's shield should refund its user a
point of Renown. Neither is written yet, because the powers are not wired up
yet, and writing the kicker before the power would be guessing twice.

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

All four run **the real engine with the dice and inputs pinned from the date**,
and publish a **par computed by brute force**. No second codebase, and "two
under" is a better thing to post than "47 out of 62".

1. **The Long Way Down.** Today's five Acts, fixed dice, played solo. Par is the
   best achievable score, found by exhaustive search.
2. **Table of Six.** Six d20 results are published for the day, identical
   worldwide. Assign one to each of six obstacles. A pure assignment problem
   with a knowable optimum and no prose at all.
3. **The Ledger.** A five by five debt grid solved by constraint propagation
   from four true statements. Up to three CHECKS, each of which costs you a
   mark, and the number you used is the score you share.
4. **Muster.** Build a character on a fixed budget to beat today's named
   encounter. Character creation as its own game, because for a lot of people
   it always was.

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
