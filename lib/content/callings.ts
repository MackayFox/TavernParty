/**
 * The eight Callings.
 *
 * This is the loudest choice in the game (GAME_DESIGN §3.2), so the set is built
 * as eight verb lists rather than eight stat spreads. Two Callings with the same
 * Signature would be the same Calling wearing a different name, so the eight
 * Signature variants in types.ts are used exactly once each: hold the door, take
 * the credit, calm the party, lift the room, price the unknown, try again, come
 * at it another way, take the wound for somebody else. Read the list of
 * Signatures top to bottom and you have read the whole design.
 *
 * The affinities are chosen second, to serve that verb, and then checked for
 * coverage: no two Callings share a pair, and every ability shows up at least
 * twice, so a bad house array never leaves a Calling unpickable and no ability
 * is ever the dump stat by consensus. Brawn, Grit, Wits and Nerve appear three
 * times; Deft and Charm twice, because they are the two that Kit and Hooks
 * already reward heavily and the draft does not need a third nudge.
 *
 * The Failings deliberately do not name the dangerous tags. A Failing on `beast`
 * or `dark` would be a tax on the scenes everybody already fears. These name the
 * tag that makes each Calling *irrelevant*: a crowd with no doorway to hold, a
 * ledger that will not balance, a fire no dog will walk towards. Being useless
 * is a more interesting problem than being hurt.
 */
import type { Calling } from "@/lib/game/types";
import type { Tag } from "@/lib/content/tags";

/** Keeps the Failing tag checked against the closed vocabulary at compile time. */
const fail = (tag: Tag, text: string) => ({ tag, text });

export const CALLINGS: Calling[] = [
  {
    id: "warden",
    name: "WARDEN",
    blurb: "Get behind me and stop arguing about it.",
    affinities: ["brawn", "grit"],
    signature: { kind: "shieldParty", label: "Behind Me" },
    failing: fail(
      "crowd",
      "A doorway is a thing one person can hold. A press of bodies goes round you, and there is nothing left to stand in front of."
    ),
  },
  {
    id: "knife",
    name: "KNIFE",
    blurb: "I was never in the room, and you will not remember me leaving.",
    affinities: ["deft", "nerve"],
    signature: { kind: "stealDeed", label: "Whose Idea It Was" },
    failing: fail(
      "patrol",
      "Everything you do looks worse by lantern light, and they always want to see hands."
    ),
  },
  {
    id: "hedgewitch",
    name: "HEDGE-WITCH",
    blurb: "I know what the marks on that lintel are for. You do not.",
    affinities: ["wits", "grit"],
    signature: { kind: "clearDread", label: "Salt The Threshold" },
    failing: fail(
      "clergy",
      "They have a word for what you do and a set of written instructions for what to do about it."
    ),
  },
  {
    id: "chanter",
    name: "CHANTER",
    blurb: "Give me a bar and a half and the whole room is mine.",
    affinities: ["charm", "nerve"],
    signature: { kind: "addFive", label: "Everyone Joins In" },
    failing: fail(
      "corpse",
      "You cannot work a room that has stopped listening, and a body on the floor stops a room dead."
    ),
  },
  {
    id: "reckoner",
    name: "RECKONER",
    blurb: "Everything has a price. I have written most of them down.",
    affinities: ["wits", "charm"],
    signature: { kind: "revealReckless", label: "Price The Door" },
    failing: fail(
      "uncanny",
      "It does not balance. Nothing you know how to count applies to it, and you can hear yourself still trying."
    ),
  },
  {
    id: "houndmaster",
    name: "HOUNDMASTER",
    blurb: "She has the scent. Try to keep up.",
    affinities: ["brawn", "wits"],
    signature: { kind: "rerollOwn", label: "Cast Again" },
    failing: fail(
      "fire",
      "Smoke takes the scent, and no dog worth having will go towards a burning door for you."
    ),
  },
  {
    id: "sapper",
    name: "SAPPER",
    blurb: "Doors are a suggestion. Walls are a schedule.",
    affinities: ["deft", "brawn"],
    signature: { kind: "secondApproach", label: "The Other Way In" },
    failing: fail(
      "water",
      "Everything you dig fills up, and nothing you prop stays where you put it."
    ),
  },
  {
    id: "oathbound",
    name: "OATHBOUND",
    blurb: "I said I would. That is the end of it.",
    affinities: ["grit", "nerve"],
    signature: { kind: "takeScarFor", label: "On My Word" },
    failing: fail(
      "trade",
      "A bargain assumes you will move on your terms, and you said out loud what your terms were."
    ),
  },
];

/**
 * The character-creation copy. Three sentences each: what you do, what the two
 * abilities feel like in play, and the honest cost of picking it.
 */
export const CALLING_DETAIL: Record<string, string> = {
  warden:
    "The Warden is what a party has instead of a plan. You go first into the stairwell and last out of the burning room, and once a night you can simply refuse to let everybody else pay for something. Brawn and Grit means you are rarely the clever answer, and the table will notice how often the clever answer needed somebody holding a door.",
  knife:
    "The Knife works alone, in a game about a party, which is the point. Deft and Nerve carry you through locks, ledges and the half second after somebody looks up, and your Signature takes the credit for a Deed that was never yours, in public, with nothing anyone can do about it. You will not be the best liked character at the table. You may well be the richest.",
  hedgewitch:
    "The Hedge-Witch knows the small practical things. Which leaf stops a bleed, why that door is nailed shut from the outside, what the chalk under the step was put there to keep out. Wits and Grit make you the one who understands the room and then outlasts it, and once a night you take the fear out of the whole party's night with salt, a word, and a very steady hand.",
  chanter:
    "The Chanter turns a room. Charm and Nerve are the two abilities that work on people rather than on objects, and your Signature is the moment the whole taproom comes in on the chorus and a roll that was going to fail quietly does not. You are the reason the party talks its way out of trouble, and usually the reason it was in it.",
  reckoner:
    "The Reckoner counts. Debts, exits, odds, the number of guards on a wall and what each of them is paid to be there. Wits and Charm make you the only Calling that can work out the answer and then get it believed, and your Signature buys the one thing this game keeps behind glass, which is the number on the Reckless line before anybody has to commit to it.",
  houndmaster:
    "The Houndmaster is never quite alone. Brawn and Wits are the leash and the trail, holding something that badly wants to be let go while reading ground nobody else has bothered to look at. Once a night the dogs cast again over lost ground and you throw the die a second time, which is the only honest second chance in the run.",
  sapper:
    "The Sapper does not open doors. Brawn and Deft, a short bar, and firm opinions about which walls are load-bearing. Your Signature is the whole trade in one action: the first way in was wrong, so take a different one, in the same breath, before the scene has finished with you.",
  oathbound:
    "The Oathbound gave their word to something, and the game never tells you what. Grit and Nerve are the two abilities for staying put long after staying put stopped being sensible, and your Signature takes another player's Scar onto your own body. It is the only genuinely selfless act in a game that pays exactly one person, which makes it either the noblest Calling here or the best disguised long game.",
};
