/**
 * The eight Bloods.
 *
 * Not species. There are no pointed ears in this game and no long-lived wise
 * elders. A Blood is where you are from and therefore what you were taught to
 * put up with: the folk of a high valley, a fen, a tide coast, a burnt village,
 * a charcoal stack. Two Bloods differ the way a hill farmer and a gravedigger
 * differ, which is to say in what stopped bothering them years ago.
 *
 * The mechanical rule behind the set is a single line from GAME_DESIGN §3.3: a
 * Blood bends the consequence economy, never the arithmetic. None of these is a
 * flat bonus. They edit what a result COSTS, who it costs, or what you knew
 * before you committed, so choosing one changes the shape of your night rather
 * than the size of your numbers. That also keeps the Calling the loudest choice,
 * which is the whole point of making the Calling exclusive and this not.
 *
 * The eight map one-to-one onto the eight BloodPower variants, so the set is a
 * bijection and there is no filler. Three make failure cheaper for you
 * (Hillfolk, Gravewise, Thornborn) and one makes it cheaper for everybody
 * (Emberkin); one makes it cheaper for you by making it dearer for the party
 * (Ashkin); one buys information (Longshank); one buys a second look at your own
 * build (Fenborn); and one hands you more fuel that other players still control
 * (Tideborn).
 *
 * Three honest caveats, all found by review rather than by writing:
 *
 * Hillfolk's rerollFumble does touch the die, which is the one place the "never
 * the arithmetic" doctrine bends. It survives because a reroll moves variance
 * rather than the expected sum, and because being wrong about your own footing
 * is the whole character of the people.
 *
 * Tideborn is the only genuinely passive one: an extra token at the start, with
 * no decision about when to take it. The decision is displaced into when to
 * spend it, which is a weaker version of the same thing.
 *
 * Thornborn and Emberkin both spend themselves saving the PARTY a point of
 * Dread, in a game where exactly one player takes the Hoard. Read strictly, a
 * rational drafter never takes either, so both got a personal kicker when the
 * powers were wired up: Thornborn's free Scar also pays out at the Ballad
 * whatever their Renown (it ignores the median gate), and Emberkin takes
 * EMBERKIN_RENOWN for the shield. Ashkin needed the reverse treatment, a flat
 * ASHKIN_DREAD rather than a proportional one, because Renown runs to the dozens
 * and Dread tops out at eight.
 *
 * All eight fire. `tests/unit/blood.test.ts` proves each one, including that the
 * set is still a bijection, because six of these were printed on the character
 * sheet and wired to nothing for a while and that is the worst possible state
 * for a drafted ability to be in.
 */
import type { Blood } from "@/lib/game/types";

export const BLOODS: Blood[] = [
  {
    id: "hillfolk",
    name: "HILLFOLK",
    blurb: "High pasture and low cloud. They walk uphill for an hour before they call it a walk.",
    power: { kind: "rerollFumble" },
    powerText:
      "Once a run, if your die comes up a one, pick it up and throw it again. You keep the second throw, whatever it is.",
  },
  {
    id: "longshank",
    name: "LONGSHANK",
    blurb: "Drovers and message carriers, road dust to the knee, home about twice a year.",
    power: { kind: "seeOneReckless" },
    powerText:
      "Once a run, look at the Reckless target number without spending a Torch. Use it on the Act where you cannot tell whether the reward is worth it.",
  },
  {
    id: "fenborn",
    name: "FENBORN",
    blurb: "Eel traps and duckboards. Nothing in a fen stays where you left it overnight.",
    power: { kind: "reassignOne" },
    powerText:
      "Once a run, after an Act has played out, swap one of your six ability numbers with another of your own. Wait until you have seen what this night is actually asking for.",
  },
  {
    id: "ashkin",
    name: "ASHKIN",
    blurb: "From a valley that burned in a single afternoon, and they still sift the ground for hinges.",
    power: { kind: "costToDread" },
    powerText:
      "Once a run, take the Renown cost of a failure as party Dread instead. You pay nothing. Everyone pays a little, including the people who were not there.",
  },
  {
    id: "tideborn",
    name: "TIDEBORN",
    blurb: "Two tides a day tell them when to work and when to sit down, and they have never argued with either.",
    power: { kind: "extraHookToken" },
    powerText:
      "You begin the run with an extra Hook token, so you can spend one early instead of hoarding it and waiting to be singled out.",
  },
  {
    id: "gravewise",
    name: "GRAVEWISE",
    blurb: "They wash and box the dead in a town that keeps its cemeteries inside the walls.",
    power: { kind: "freeHide" },
    powerText:
      "Once a run, hide a Scar and pay no Renown for it. Nobody at the table finds out it happened, which is the part you are actually paying for.",
  },
  {
    id: "thornborn",
    name: "THORNBORN",
    blurb: "Hedge-layers. You can read every hedge they have ever laid off the backs of their hands.",
    power: { kind: "keepScarFree" },
    powerText:
      "Once a run, keep a Scar in public and add no Dread to the party. The best Scar you will ever take, so hold it for a bad one.",
  },
  {
    id: "emberkin",
    name: "EMBERKIN",
    blurb: "Charcoal burners who sleep in shifts, because a stack that goes out is a fortnight wasted.",
    power: { kind: "dreadShield" },
    powerText:
      "Once a run, stop the party taking Dread from a result. Save it for the Act that would tip the Night over.",
  },
];

/** Two or three sentences each, for the creation screen. */
export const BLOOD_DETAIL: Record<string, string> = {
  hillfolk:
    "Nine months of the year the track to their village is a stream. They are not braver than anyone else, they have simply been wrong about their footing so many times that being wrong once more is not an event. A Hillfolk who slips gets up mid-sentence and finishes the sentence.",
  longshank:
    "They carry other people's goods and other people's news along roads with nothing on them for a day at a stretch, and they are paid for arriving rather than for arriving well. So they read the ground ahead out of habit, the way you would check a purse. Ask one whether a door is trapped and they will tell you before they have finished looking at it.",
  fenborn:
    "A fen has no fixed geography. The channel that was there in spring is silt by autumn, the path is under a foot of water, and the only people who make a living out of it are the ones who never fully commit to a footing. A Fenborn will let you finish explaining the plan, and then move.",
  ashkin:
    "The fire took the valley between noon and dusk, and the ones who walked out have a particular relationship with cost: it never went away, it only ever moved. An Ashkin will not carry something twice. They will find someone else's pocket for it, cheerfully, and they will not consider this a betrayal because in their view the cost was always going to be shared.",
  tideborn:
    "Everything on that coast happens twice a day or not at all. Tideborn work in the gap the water leaves them, then stop dead when it comes back, and it makes them oddly generous with what they have because they know it returns. They spend early. It unnerves people who have been saving.",
  gravewise:
    "Their town buries inside the walls, so somebody has to wash the dead, box them and stand with the family. Gravewise learn young that the truth is usually not the kind thing to hand over, and that most things can be closed and carried out quietly if you keep your hands steady. They are very good company, and there is always something they have not mentioned.",
  thornborn:
    "Laying a hedge means putting both arms into blackthorn for a whole winter, and the pay is that in thirty years it will still be standing where you put it. Thornborn show their hands to strangers as a matter of course. A wound they chose is not a wound to them, it is a receipt.",
  emberkin:
    "A charcoal stack has to be watched for eight days without ever being allowed to catch properly alight, so Emberkin sleep in halves and wake at the wrong smell. They are the ones who notice the room going quiet. Whatever the rest of the party is doing at the edge of the light, an Emberkin has already put a hand out to it.",
};
