/**
 * The twelve pieces of Kit.
 *
 * Kit is drafted second and in reverse priority, so whoever won the Calling they
 * wanted picks here last. That only works if the last pick is still worth having,
 * which fixes the shape of the set: twelve things of roughly equal value, no dud
 * at the bottom and nothing at the top worth trading a Calling for.
 *
 * So the set splits rather than scales. Five items are a flat +2 to one ability,
 * one ability each, and they are the safe pick: they help every Act and they
 * never run out. Five are a charge, two uses of a thing that fires when you
 * choose, which is worth more than +2 in the Act you spend it on and nothing at
 * all in the Act after that. Two carry a little of both at reduced strength, for
 * players who would rather not commit to either. Grit is only ever +1, because
 * the thing that keeps you going in the cold is also a light, and it should not
 * be the best item in the game for holding both.
 *
 * Every one is an ordinary object somebody on the road would actually be
 * carrying, described by the detail that makes it that object and not the generic
 * version of it: the knot every arm's length, the pick that is bent on purpose,
 * the two mouthfuls left. Nothing here is enchanted. It is all just gear that
 * somebody has looked after, which is a better story than a glow.
 */
import type { KitItem } from "@/lib/game/types";

export const KIT: KitItem[] = [
  {
    id: "tarred-rope",
    name: "Tarred Rope, Forty Foot",
    blurb: "Knotted every arm's length, so there is always something to put a hand on.",
    bonus: { ability: "brawn", value: 2 },
    charge: null,
  },
  {
    id: "pick-roll",
    name: "Roll of Picks",
    blurb: "Six in an oiled leather fold, and a seventh that is bent on purpose.",
    bonus: { ability: "deft", value: 2 },
    charge: null,
  },
  {
    id: "corrected-map",
    name: "Somebody Else's Map",
    blurb: "Corrected twice in a second hand, which is how you know where the cellars are.",
    bonus: { ability: "wits", value: 2 },
    charge: null,
  },
  {
    id: "short-flask",
    name: "Flask, Two Mouthfuls Left",
    blurb: "Enough to stop your hands, not enough to make you stupid about it.",
    bonus: { ability: "nerve", value: 2 },
    charge: null,
  },
  {
    id: "wire-signet",
    name: "Signet Ring on a Wire Loop",
    blurb: "Hand it over before anybody asks and nobody reads the seal twice.",
    bonus: { ability: "charm", value: 2 },
    charge: null,
  },
  {
    id: "pitch-torches",
    name: "Four Pitch Torches",
    blurb: "Wrapped in waxed cloth, so the rain gets the cloth and not the pitch.",
    bonus: null,
    charge: { kind: "torch", uses: 2 },
  },
  {
    id: "whetstone",
    name: "Whetstone in an Oiled Rag",
    blurb: "A minute on this and the blade forgives you the first swing.",
    bonus: null,
    charge: { kind: "reroll", uses: 2 },
  },
  {
    id: "spare-bowstring",
    name: "Spare Bowstring, Waxed",
    blurb: "Coiled flat and kept dry, so it will not be the string that fails you twice.",
    bonus: null,
    charge: { kind: "reroll", uses: 2 },
  },
  {
    id: "cracked-mirror",
    name: "Cracked Hand Mirror",
    blurb: "Silvered on the good half, and it looks round a corner so you do not have to.",
    bonus: null,
    charge: { kind: "reveal", uses: 2 },
  },
  {
    id: "sounding-line",
    name: "Lead Sounding Line",
    blurb: "Drop it in first and the dark tells you exactly how far down it goes.",
    bonus: null,
    charge: { kind: "reveal", uses: 2 },
  },
  {
    id: "brass-tinderbox",
    name: "Brass Tinderbox",
    blurb: "Dented, kept in a breast pocket, and it has never once refused to light.",
    bonus: { ability: "grit", value: 1 },
    charge: { kind: "torch", uses: 1 },
  },
  {
    id: "names-ledger",
    name: "Pocket Ledger of Names",
    blurb: "Who owes whom, in pencil, so you know whose name to say and when.",
    bonus: { ability: "charm", value: 1 },
    charge: { kind: "reveal", uses: 1 },
  },
];

/** Two sentences at most, for the creation screen. */
export const KIT_DETAIL: Record<string, string> = {
  "tarred-rope":
    "Hemp, tarred black, stiff with it and stinking. The knots are the whole point: you can hold it, haul on it, or hand the end to somebody who is further down than you are.",
  "pick-roll":
    "A tinker sold you five of them and you made the sixth. The bent one is for wards that were fitted badly, which is most of them.",
  "corrected-map":
    "Drawn by a surveyor who was paid by the mile and corrected by somebody who actually walked it. The second hand is the one worth trusting.",
  "short-flask":
    "Pewter, dented, and the stopper is a whittled cork. Two mouthfuls is a decision about when, not whether.",
  "wire-signet":
    "The ring belonged to a man who no longer needs it, and the wire is so you can produce it fast. Confidence does most of the work; the seal only has to survive a glance.",
  "pitch-torches":
    "Ash handles, tow heads, pitch that has gone hard in the cold. Four is generous and you will still be counting them by the third Act.",
  whetstone:
    "A grey block worn hollow in the middle, in a rag that keeps the oil off everything else. It is a small ritual, and it buys you the swing you should have taken first.",
  "spare-bowstring":
    "Waxed, coiled flat, carried against the skin so the damp never finds it. It is not for a bow, particularly. It is for the moment something snaps.",
  "cracked-mirror":
    "Palm sized, silvered, with a crack across one corner that you have learned to look past. Held at the right angle it tells you what is round the turn before the turn tells you.",
  "sounding-line":
    "Thin cord, lead weight, a knot at every fathom. Fishermen use it on rivers and you use it on anything you are thinking of climbing into.",
  "brass-tinderbox":
    "Flint, steel and a wad of charred linen, in a box that lives in a breast pocket and is warm because you are. Fire when you want it, and something to walk towards when you do not.",
  "names-ledger":
    "A palm-sized book of names, debts and who fell out with whom, kept in pencil so it can be revised. Say the right name in the right room and the room rearranges itself around you.",
};
