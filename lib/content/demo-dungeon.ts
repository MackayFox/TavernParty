/**
 * THE STONE WALK. The house's own campaign, and the only dungeon that ships.
 *
 * It exists for one reason: Marks are the best thing in the builder and nobody
 * discovers a mechanic by reading a form. A first visitor gets a dungeon where
 * floor one decides what floor four will even offer, plays it in eight minutes,
 * and then knows what the desk is for.
 *
 * WHAT IT DEMONSTRATES, in order of how hard it is to see from the form:
 *
 *   * A mark you pick up on purpose, at a price. The lantern on floor one costs
 *     Vigour to take and opens a cheap way past floor three.
 *   * A mark you pick up whether you wanted it or not. Getting through the water
 *     leaves you wet, and floor five will not let a wet person near the rope.
 *   * A door that wants you NOT to be carrying something, which is the half of
 *     the mechanic authors forget exists.
 *   * Every floor keeping one way through that always works and always costs, so
 *     arriving with nothing is expensive rather than fatal.
 *
 * Written to be honestly mid-difficulty rather than a showcase nobody finishes.
 * The gate is the judge of that, not this comment: `npm run seed:dungeon` prints
 * what the solver made of it.
 */
import type { RoomDef } from "@/lib/daily/deeprun-data";

/**
 * Fixed, so seeding twice is a no-op. Six from the code alphabet, which has no
 * vowels in it so that nothing spells anything.
 *
 * THE CODE WAS CHOSEN BEFORE THE NUMBERS, and that order is the whole lesson of
 * the desk. A dungeon's dice come from its code, so the code decides which
 * targets are live decisions and which are theatre: this one throws 5, 2, 17, 7,
 * 12, 8, with no 1 anywhere (a 1 never opens anything, so a floor that rolls one
 * has no real checks) and no 20 (a 20 always opens, so the price is the theatre
 * instead). Every target below was then set against the die it will actually meet.
 * The first draft of this file did the opposite and the solver called it a walk
 * that 198 out of 240 characters strolled out of.
 */
export const DEMO_CODE = "LNGWLK";

export const DEMO_TITLE = "The Stone Walk";

export const DEMO_INTRO =
  "A mile of dressed stone under a hill that has no business having a mile of anything under it. Take a light if you get the chance, and stay out of the water if you can manage it. The last party did neither, and the last thing on their list was a rope they never reached.";

export const DEMO_ROOMS: RoomDef[] = [
  {
    id: "sw-1",
    band: 1,
    title: "The Lantern Room",
    setup:
      "Somebody made a room of it. Bracket on the wall, oil in a jar, a bench worn smooth by people waiting. The lantern is here and it is heavy, and the stair carries on down whether you take it or not.",
    options: [
      {
        id: "sw-1-take",
        label: "Fill the lantern and carry it",
        kind: "check",
        ability: "deft",
        // Die 5, so a target of 9 is live: a decent pair of hands clears it and a
        // clumsy one pays. The lantern has to be reachable, because three floors
        // further down are built on somebody having it.
        tn: 9,
        vigour: 2,
        promise: "Fiddly, and it will be a weight all the way down.",
        win: "The wick catches on the third go. Light, and an arm you cannot use for anything else.",
        lose: "The oil goes over the bench and your sleeve, and the wick will not take. You leave it.",
        sets: ["carrying the lantern"],
      },
      {
        id: "sw-1-read",
        label: "Read the marks on the bench",
        kind: "check",
        ability: "wits",
        tn: 10,
        vigour: 2,
        promise: "People sat here long enough to carve. Worth knowing what they carved.",
        win: "Names, and under the names a count of days, and under that an arrow pointing back the way you came. You go on anyway, and you go on knowing.",
        lose: "Somebody has scratched over the lot of it with a nail. You lose a while working out that there is nothing to work out.",
      },
      {
        id: "sw-1-on",
        label: "Straight past it",
        kind: "brace",
        vigour: 1,
        promise: "The stair is right there.",
        win: "You are past it in seconds and out of the light in a minute. Nothing in this room was going to hurt you, and nothing in it is going to help you either.",
        lose: "You are past it in seconds and out of the light in a minute. Nothing in this room was going to hurt you, and nothing in it is going to help you either.",
      },
    ],
  },
  {
    id: "sw-2",
    band: 1,
    title: "The Long Puddle",
    setup:
      "The floor dips for forty feet and the water sits in it, black and dead still and deeper in the middle than it looks from either end. There is a ledge of sorts on the left, if you are the sort who trusts a ledge.",
    options: [
      {
        id: "sw-2-ledge",
        label: "Along the ledge",
        kind: "check",
        ability: "deft",
        // Die 2. Almost nothing clears against a 2, so the target has to be very
        // low or this floor is a brace with two ornaments beside it. Set at 7
        // first, and the solver still said everybody waded: +5 in one ability is
        // rarer than it looks on an array like 12,15,12,10,8,12. Five works.
        tn: 5,
        vigour: 2,
        promise: "Four inches of wet stone and a wall to lean on. Dry, if it holds.",
        win: "Four inches is more than it sounds when the wall is good. You come off the end of it dry to the knee, which will matter later.",
        lose: "The wall runs out before the ledge does, and you spend a bad while getting back to where you started before taking the long way through.",
      },
      {
        id: "sw-2-nerve",
        label: "Straight through it, quickly",
        kind: "check",
        ability: "nerve",
        tn: 6,
        vigour: 2,
        promise: "It is only water. Probably. Quick, and you will be soaked.",
        win: "Chest deep at the middle and then rising, and nothing in it touches you. You are through in under a minute.",
        lose: "Something the size of a hand goes past your leg and you are back against the wall before you decide to be. Then you go through anyway, slower.",
        sets: ["wet"],
      },
      {
        id: "sw-2-wade",
        label: "Wade it properly",
        kind: "brace",
        vigour: 2,
        promise: "Slow, careful, and you will be soaked to the collarbone.",
        win: "You take it a foot at a time and you get to the far side with everything you started with, wearing about a stone of water.",
        lose: "You take it a foot at a time and you get to the far side with everything you started with, wearing about a stone of water.",
        sets: ["wet"],
      },
    ],
  },
  {
    id: "sw-3",
    band: 2,
    title: "The Turn Nobody Cut",
    setup:
      "The dressed stone stops. What carries on is a crack the width of a person, and the mason who made the mile did not make this and did not want it found. The draught coming out of it is warm.",
    options: [
      {
        id: "sw-3-lit",
        label: "Go in with the light up",
        kind: "check",
        ability: "grit",
        // Die 17 against a target of 10: with the lantern this floor is free, and
        // that is the lantern's whole return on floor one's two Vigour.
        tn: 10,
        vigour: 2,
        promise: "Slow work, and you can see what you are putting your hands on.",
        win: "With light it is only a squeeze. You can see the floor, you can see where the floor stops, and you put your feet accordingly.",
        lose: "You can see it and you still catch a shoulder badly, and it goes on for longer than you would like.",
        needs: ["carrying the lantern"],
      },
      {
        id: "sw-3-blind",
        label: "Feel your way through it",
        kind: "check",
        ability: "nerve",
        // And 20 without it. A 17 clears this only for somebody built for it, so
        // the dark route is a real gamble rather than a slightly worse lantern.
        tn: 20,
        vigour: 3,
        promise: "Hands, and whatever your hands find.",
        win: "Nothing your hands find is worse than stone. That is not nothing, in the dark, and you come out the far side steadier than you went in.",
        lose: "Something gives under your palm that should not have been soft. You are through it and you would rather not think about it.",
      },
      {
        id: "sw-3-back",
        label: "Take the long way round",
        kind: "brace",
        vigour: 4,
        promise: "There is a way round. It is most of an hour and all of it uphill.",
        win: "Most of an hour, and it comes out where you hoped, and you are on the other side with your shoulders unmarked and your legs finished.",
        lose: "Most of an hour, and it comes out where you hoped, and you are on the other side with your shoulders unmarked and your legs finished.",
      },
    ],
  },
  {
    id: "sw-4",
    band: 2,
    title: "The Dry Bridge",
    setup:
      "A span of stone over nothing you can see the bottom of, and the stone is dusty, which after all that water is the strangest thing down here. Halfway across, somebody has left a coil of rope tied off to the rail.",
    options: [
      {
        id: "sw-4-rope",
        label: "Cross on the rope",
        kind: "check",
        ability: "brawn",
        // Die 7, target 11, and closed to anybody soaked. This is what staying
        // dry on floor two was for, and it is the only door in the dungeon that
        // asks what you are NOT carrying.
        tn: 11,
        vigour: 3,
        promise: "Hand over hand, under the span, out of whatever is up on it.",
        win: "Old rope and good knots. You come up on the far side under the rail and nothing on the bridge knew you were there.",
        lose: "Good knots, and a wet grip is still a wet grip. You get across and you do it the hard way.",
        // The half of the mechanic authors forget: a door that wants you NOT to
        // be carrying something. Being soaked is not a punishment on its own, it
        // is a fact that closes a door two floors later.
        forbids: ["wet"],
      },
      {
        id: "sw-4-walk",
        label: "Walk it, quietly",
        kind: "check",
        ability: "deft",
        // Die 7. Eleven, not thirteen: this was the only door on the floor most
        // people could reach once the water had soaked them, and at thirteen they
        // could not reach it either.
        tn: 11,
        vigour: 3,
        promise: "Dust means nothing has come this way in a while. That cuts both ways.",
        win: "Twelve paces of held breath and then the far side, and whatever the dust was keeping still is still keeping still.",
        lose: "Halfway, your foot finds the one loose slab in the span and the noise of it goes down and down and does not arrive anywhere.",
      },
      {
        id: "sw-4-crawl",
        label: "Crawl the whole span",
        kind: "brace",
        vigour: 3,
        promise: "On your front, at the pace of a man who wants to arrive.",
        win: "It takes an age and it costs your knees and your nerve, and you arrive.",
        lose: "It takes an age and it costs your knees and your nerve, and you arrive.",
      },
    ],
  },
  {
    id: "sw-5",
    band: 3,
    title: "The Cold Room",
    setup:
      "It is a room, and it is the coldest thing you have met all day, and the cold is coming off a wall that has been dressed and lettered and then filled in. Whatever the mile of stone was for, it was for this.",
    options: [
      {
        id: "sw-5-read",
        label: "Read the wall",
        kind: "check",
        ability: "wits",
        // Die 12, target 14, lantern only. Reading the wall is how you learn the
        // name, and the name is what floor six's cheap door is made of.
        tn: 14,
        vigour: 3,
        promise: "Somebody wrote it down. People do, when they are frightened.",
        win: "It is an account, and it is dull, and dull is the frightening part: a rota, a count of stones, and a note about who is to stay behind. You know what this room is now, and you know it before it tells you.",
        lose: "You get as far as the rota and the cold gets into your hands, and after that the letters will not hold still.",
        needs: ["carrying the lantern"],
      },
      {
        id: "sw-5-out",
        label: "Straight for the far door",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise: "There is a door. Whatever this is, the door is the answer to it.",
        win: "You do not look at the wall and you do not stop, and both of those are decisions, and you make them well.",
        lose: "You look. Anybody would. It costs you the length of a breath and the breath was expensive.",
      },
      {
        id: "sw-5-wait",
        label: "Wait for your eyes",
        kind: "brace",
        vigour: 3,
        promise: "Stand still, let the room finish being a room, and go on.",
        win: "You give it a minute, which is the longest minute of the day, and then it is only a cold room with a wall in it and you walk out of it.",
        lose: "You give it a minute, which is the longest minute of the day, and then it is only a cold room with a wall in it and you walk out of it.",
      },
    ],
  },
  {
    id: "sw-6",
    band: 3,
    boss: true,
    title: "What The Mile Was For",
    setup:
      "The end of the walk is a shaft, and the shaft goes up, and daylight is a coin at the top of it. Between you and the coin is the thing the last party came down here to check on, and it has been waiting the whole mile.",
    options: [
      {
        id: "sw-6-light",
        label: "Show it the light",
        kind: "check",
        ability: "charm",
        // Die 8, target 12, lantern only. The dungeon's best ending belongs to
        // whoever paid two Vigour on floor one and carried the thing all day.
        tn: 12,
        vigour: 4,
        promise: "It has been in the dark a long time. That is a thing you have and it does not.",
        win: "It goes back from the lantern the way a hand goes back from a kettle, and it keeps going back, and the shaft is clear behind it.",
        lose: "It comes for the light rather than for you, which is better, and it costs you the arm holding it.",
        needs: ["carrying the lantern"],
      },
      {
        id: "sw-6-grit",
        label: "Go past it and up",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 4,
        promise: "It is between you and a coin of daylight. Nothing else about it matters.",
        win: "You take the shaft in the dark with something below you making a noise you will hear again in about a week, and you come out into a field.",
        lose: "You get most of the way and it gets a good hold of your ankle, and the rest of it is a fight you win expensively.",
      },
      {
        id: "sw-6-tell",
        label: "Tell it what is on the wall",
        kind: "brace",
        vigour: 4,
        promise: "It was on the rota. Say the name.",
        win: "You say the name off the wall in the cold room, and whatever it is stops, and stays stopped, and you go up the shaft with your hands shaking so badly you nearly do not make it.",
        lose: "You say the name off the wall in the cold room, and whatever it is stops, and stays stopped, and you go up the shaft with your hands shaking so badly you nearly do not make it.",
      },
    ],
  },
];

/** Wide enough that the solver has real characters to compare, and no wider. */
export const DEMO_CALLINGS = ["warden", "knife", "hedgewitch", "oathbound"];
/**
 * Five things on the shelf, and every one of them can matter.
 *
 * The first version put Whetstone, Four Pitch Torches and Cracked Hand Mirror on
 * here, all three of which are charges rather than ability bonuses and none of
 * which the Deep Run reads. So "take two of these five" had one real answer, on
 * the dungeon the front page sends people to.
 */
export const DEMO_KIT = [
  "tarred-rope",
  "corrected-map",
  "short-flask",
  "wire-signet",
  "brass-tinderbox",
];
/**
 * Eight, not nine, and the reason is a chain worth recording.
 *
 * The shelf used to carry three items that do nothing in a Deep Run, so "take two
 * of five" had one real answer. Fixing that made every character on this dungeon
 * genuinely better equipped, which took the share who get out from 59% to 72% and
 * tripped the test that says this must be neither a walk nor a wall.
 *
 * One point of starting Vigour puts it back: Fair, par 54, 58% out. Chosen over
 * raising the targets because every target here was set against the die that
 * floor will actually throw, and moving them would undo that work for a change
 * that has nothing to do with any individual door.
 */
export const DEMO_BASE_VIGOUR = 8;
