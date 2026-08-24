/**
 * THE DEEP RUN, content. Server-only, and imported only by `deeprun.ts`.
 *
 * Fifteen rooms across three bands, five per band, plus five things at the
 * bottom. Twenty in total. A night takes six of them, so the pool has to be big
 * enough that a week does not repeat and small enough that every room is
 * actually written rather than generated. These are written.
 *
 * This comment used to say twenty-five, and four separate design passes quoted
 * it back as fact when estimating how long the pool lasts. Every one of those
 * estimates was a quarter optimistic. Count the arrays, not the header.
 *
 * THE SHAPE OF A ROOM, and why it is always this shape.
 *
 * Every room offers the same three kinds of answer, because that is the choice
 * the game is actually about:
 *
 *   - two `check` options on DIFFERENT abilities, so your build decides which
 *     door is cheap for you and which is a gamble;
 *   - one `brace` option that always works and always costs Vigour, so there is
 *     never a room you simply cannot get past, only a room you cannot afford.
 *
 * That third option is load-bearing. Without it a bad build plus a bad die ends
 * the run in room one and the player learns nothing. With it, every room is a
 * price rather than a wall, and running out of Vigour is a series of decisions
 * you can see yourself making rather than a thing that happened to you.
 *
 * The prose rule: `promise` says what you are about to try, in your own words,
 * before you know if it works. `win` and `lose` say what happened, in one
 * sentence, and never state a number. The numbers are the ledger's job.
 */
import type { Ability } from "@/lib/game/types";

/** What a Calling's once-a-run move does down here. */
export type KnackKind =
  /** Clear a room without rolling. */
  | "pass"
  /** Clear a room without rolling, and get some Vigour back. */
  | "mend"
  /** Skip a room. No credit, no cost, and you were never in it. */
  | "slip"
  /** Add five to a roll, after you have seen the die. */
  | "boost"
  /** Throw one die again and keep the second. */
  | "rethrow";

export const KNACKS: Record<KnackKind, string> = {
  pass: "Once tonight, walk through a room without throwing anything. It counts as cleared.",
  mend: "Once tonight, clear a room without throwing anything, and get some of your wind back.",
  slip:
    "Once tonight, be somewhere else. The room does not happen to you. It also does not count as cleared, which is the trade.",
  boost: "Once tonight, add five to a roll AFTER you have seen the die. The only safety net down here.",
  rethrow: "Once tonight, pick a die up and throw it again. You keep the second one, whatever it is.",
};

/**
 * Which Calling has which. Two or three each across the eight, and only three
 * Callings are offered a night, so the choice stays varied without eight
 * separate mechanics to learn.
 */
export const KNACK_BY_CALLING: Record<string, KnackKind> = {
  warden: "pass",
  sapper: "pass",
  knife: "slip",
  houndmaster: "rethrow",
  chanter: "boost",
  reckoner: "boost",
  hedgewitch: "mend",
  oathbound: "mend",
};

export type OptionDef = {
  id: string;
  /** Imperative, in your voice: "Get a shoulder under it". */
  label: string;
  kind: "check" | "brace";
  ability?: Ability;
  tn?: number;
  /** What failing a check costs, or what bracing costs outright. */
  vigour?: number;
  /** What you are about to try, before you know whether it works. */
  promise: string;
  win: string;
  lose: string;
};

export type RoomDef = {
  id: string;
  /** 1 shallow, 2 middling, 3 deep. */
  band: 1 | 2 | 3;
  boss?: boolean;
  title: string;
  setup: string;
  options: OptionDef[];
};

const brace = (id: string, label: string, vigour: number, promise: string, win: string): OptionDef => ({
  id,
  label,
  kind: "brace",
  vigour,
  promise,
  win,
  lose: win,
});

// ---------------------------------------------------------------------------
// Band 1: the first few floors, where it is still a job
// ---------------------------------------------------------------------------

const BAND_1: RoomDef[] = [
  {
    id: "r-screech",
    band: 1,
    title: "The Screech",
    setup:
      "You are eleven steps in when something screams and comes at you down the passage on all fours, faster than a thing that shape should move. It has its hands out in front of it and the hands are wrong.",
    options: [
      {
        id: "meet",
        label: "Set your feet and meet it",
        kind: "check",
        ability: "brawn",
        tn: 12,
        vigour: 2,
        promise: "Stop it where it is. It weighs less than you do.",
        win: "You take it high and put it into the wall, and it goes limp and stays there.",
        lose: "It gets under your arms and you spend a while on the floor learning what its hands are for.",
      },
      {
        id: "sidestep",
        label: "Wait, then step out of the line",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise: "It is committed. Let it commit.",
        win: "It goes past you into the dark and you hear it hit something that was not you.",
        lose: "You move a beat early, it corrects, and you take the corner of the wall with your shoulder.",
      },
      {
        id: "shout",
        label: "Shout at it like it owes you money",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise: "Whatever it was before, it might still know a raised voice.",
        win: "It stops dead four feet out, looks at you for a long moment, and goes back the way it came.",
        lose: "It does not care about your voice at all, and you find that out at close range.",
      },
      brace(
        "wear",
        "Wear it and keep walking",
        2,
        "Let it have a piece of you and go past while it is busy.",
        "You give it an arm and it takes it, and you are twenty feet down the passage before it looks up."
      ),
    ],
  },
  {
    id: "r-doorbar",
    band: 1,
    title: "The Barred Door",
    setup:
      "The door at the end is barred from your side, which is the wrong side for a door to be barred from. Somebody shut something in here and then thought better of coming back for it.",
    options: [
      {
        id: "read",
        label: "Read the bar and the marks around it",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise: "Whoever barred it left a reason on the frame if they left anything.",
        win: "Three tally scratches and a date. You know what is behind it, and you know which way it opens.",
        lose: "You are still working out the marks when the bar shifts on its own and takes your fingers with it.",
      },
      {
        id: "lift",
        label: "Lift the bar clean out",
        kind: "check",
        ability: "brawn",
        tn: 11,
        vigour: 2,
        promise: "It is oak and it is heavy and that is all it is.",
        win: "Up, out, and down without a sound. The door swings on its own weight.",
        lose: "The bar comes free faster than you expected and the door comes with it, into you.",
      },
      brace(
        "kick",
        "Put your boot through it",
        2,
        "Loud, quick, and nobody has to be clever.",
        "The panel goes on the second kick and you step through the hole. Everything down here now knows where you are."
      ),
    ],
  },
  {
    id: "r-flood",
    band: 1,
    title: "Ankle Deep, Then Not",
    setup:
      "The floor slopes and the water is at your ankles at the top and your thighs at the bottom, and it is moving, which means it is going somewhere. The somewhere is a grating you cannot see the far side of.",
    options: [
      {
        id: "wade",
        label: "Wade it and keep a hand on the wall",
        kind: "check",
        ability: "grit",
        tn: 12,
        vigour: 2,
        promise: "Cold and slow and nothing clever. Just do not stop.",
        win: "You come out the far side shaking and upright, which is the whole of the requirement.",
        lose: "Your foot goes into something that is not floor and the cold takes the breath out of you.",
      },
      {
        id: "grating",
        label: "Get the grating open and go under",
        kind: "check",
        ability: "deft",
        tn: 13,
        vigour: 2,
        promise: "The water is going somewhere. Go with it.",
        win: "Two bolts, a held breath, and you come up in a dry culvert past the whole thing.",
        lose: "The bolts do not give, you do, and you spend it fighting the current back to the slope.",
      },
      brace(
        "swim",
        "Swim it and take the cold",
        2,
        "Straight across. You will be wet either way.",
        "You get across. You are soaked to the collarbone and the cold has taken something out of you that you will not get back tonight."
      ),
    ],
  },
  {
    id: "r-tollman",
    band: 1,
    title: "The Man on the Stair",
    setup:
      "A man is sitting on the third step with a lantern and a ledger, and he does not get up when he sees you. He asks, quite politely, what you are taking out.",
    options: [
      {
        id: "talk",
        label: "Tell him what he wants to hear",
        kind: "check",
        ability: "charm",
        tn: 12,
        vigour: 2,
        promise: "He has a job and a book. Give him something to write in it.",
        win: "He writes down a name that is not yours, thanks you, and moves the lantern so you can see the step.",
        lose: "He writes something down without asking you again, and two floors below somebody starts walking.",
      },
      {
        id: "spot",
        label: "Work out what he actually is",
        kind: "check",
        ability: "wits",
        tn: 13,
        vigour: 2,
        promise: "Nobody sits on a stair in the dark for a wage.",
        win: "The ledger is blank and always has been. You walk past him and he does not turn his head.",
        lose: "You look too long, and whatever is doing the sitting notices that you looked.",
      },
      brace(
        "past",
        "Walk past him without a word",
        2,
        "He is on the third step. There are more steps than that.",
        "You go by close enough to feel the lantern. Something on your arm is bleeding by the top of the flight and you do not remember when."
      ),
    ],
  },
  {
    id: "r-nest",
    band: 1,
    title: "The Nest in the Vault",
    setup:
      "The vault has been somebody's larder for a long time. There is a way through it and the way through it is over a floor that will not be quiet under any weight at all.",
    options: [
      {
        id: "quiet",
        label: "Cross it a foot at a time",
        kind: "check",
        ability: "deft",
        tn: 12,
        vigour: 2,
        promise: "Slow enough and nothing above you has to wake up.",
        win: "Nine minutes for forty feet, and nothing on the ceiling moves at all.",
        lose: "Something under your heel goes off like a snapped stick and the ceiling comes alive.",
      },
      {
        id: "still",
        label: "Wait for it to settle and go in the gap",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise: "Stand in the dark long enough and it stops caring you are there.",
        win: "Eleven minutes of not moving buys you a clear thirty seconds, and thirty is plenty.",
        lose: "You break first. You always know the exact moment you break.",
      },
      brace(
        "run",
        "Run it and let them come",
        2,
        "Forty feet. Nothing on the ceiling is faster than that.",
        "You are through and up the far stair with things dropping behind you. Some of them got a hand in on the way."
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// Band 2: far enough down that it has stopped being a job
// ---------------------------------------------------------------------------

const BAND_2: RoomDef[] = [
  {
    id: "r-choir",
    band: 2,
    title: "The Choir",
    setup:
      "There are eleven of them in the long room and they are all singing the same note, and they have been singing it for a while. They stop when you open the door. They do not turn round.",
    options: [
      {
        id: "join",
        label: "Take up the note",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise: "Eleven of anything wants a twelfth. Be the twelfth.",
        win: "You find the note and hold it, and they start again, and you walk the length of the room inside the sound.",
        lose: "You are half a tone under and they all hear it, and eleven heads come round together.",
      },
      {
        id: "hold",
        label: "Stand in the doorway and do not move",
        kind: "check",
        ability: "nerve",
        tn: 15,
        vigour: 3,
        promise: "They stopped because a door opened. Give them nothing else.",
        win: "The note comes back. By the second verse you are behind them and they never knew the door had stayed open.",
        lose: "The silence goes on longer than you can, and the moment you shift, all eleven of them start walking.",
      },
      {
        id: "cut",
        label: "Go along the gallery above them",
        kind: "check",
        ability: "deft",
        tn: 14,
        vigour: 3,
        promise: "There is a ledge. There is always a ledge.",
        win: "Forty feet of eight-inch stone, above eleven upturned faces that never look up.",
        lose: "The ledge is old and it lets you know, and you finish the crossing on the floor with them.",
      },
      brace(
        "through",
        "Walk down the middle of them",
        3,
        "Straight down the aisle. Do not slow down for anybody.",
        "You get to the far door. They do not stop you and they do not stop singing, and by the stair you have lost more than you meant to."
      ),
    ],
  },
  {
    id: "r-scales",
    band: 2,
    title: "The Weighing Room",
    setup:
      "A pair of brass scales the size of a cart, and a door that is plainly held shut by whatever is on the light pan. There is a pile of things in the corner that people have tried before.",
    options: [
      {
        id: "sum",
        label: "Work out what it wants",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise: "It is arithmetic with brass on it. Do the arithmetic.",
        win: "Four of the small weights and one of yours, and the door opens like it was never shut.",
        lose: "You are wrong twice, and the second time the pan comes up hard enough to take the skin off your forearm.",
      },
      {
        id: "hold-pan",
        label: "Hold the pan down yourself",
        kind: "check",
        ability: "brawn",
        tn: 14,
        vigour: 3,
        promise: "It only has to be down long enough for you to be through.",
        win: "You get it flat, wedge it with a boot, and go through the gap sideways.",
        lose: "It comes back up with your whole weight on it, which tells you something about the scales you did not want to know.",
      },
      brace(
        "give",
        "Put something of your own on it",
        3,
        "It wants weight. You are carrying weight.",
        "The door opens. Whatever you put on the pan is not coming back off it, and you feel the lack of it on the stairs."
      ),
    ],
  },
  {
    id: "r-longdark",
    band: 2,
    title: "The Long Dark",
    setup:
      "Two hundred feet of corridor with nothing in it, and every lamp you carry goes out at the same point and will not relight. You can still walk. You just cannot see.",
    options: [
      {
        id: "count",
        label: "Count it out with a hand on the wall",
        kind: "check",
        ability: "wits",
        tn: 14,
        vigour: 3,
        promise: "It is a straight corridor. Count the paces and trust the count.",
        win: "Two hundred and sixteen paces and your hand finds the frame exactly where you said it would.",
        lose: "Somewhere in the nineties the count goes, and you are a long time working out which way you are facing.",
      },
      {
        id: "keep",
        label: "Just keep walking",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise: "It ends. Everything ends. Walk until it does.",
        win: "You come out the far end with no idea how long it took and no interest in finding out.",
        lose: "Halfway through, the dark starts putting things in front of you, and you spend a while on your knees.",
      },
      {
        id: "listen",
        label: "Go by what you can hear",
        kind: "check",
        ability: "nerve",
        tn: 14,
        vigour: 3,
        promise: "The air moves at the far end. Follow the air.",
        win: "You walk into a draught and then into a doorway, and never once look behind you.",
        lose: "What you can hear is not the air, and you follow it for longer than you should.",
      },
      brace(
        "sprint",
        "Run it flat out",
        3,
        "Straight line. Nothing to hit but the far wall.",
        "You find the far wall with your shoulder and both hands. It is the right wall, and you are badly winded."
      ),
    ],
  },
  {
    id: "r-hands",
    band: 2,
    title: "The Handhold",
    setup:
      "The floor has gone. There is a wall with iron rungs across the gap, and there are things in the shaft below that come up the wall when something is on it.",
    options: [
      {
        id: "fast",
        label: "Go across fast",
        kind: "check",
        ability: "deft",
        tn: 15,
        vigour: 3,
        promise: "Nine rungs. Do not look down and do not stop on one.",
        win: "Nine rungs, no pause, and whatever came up the wall came up behind you.",
        lose: "The sixth rung is loose and you find that out with your whole weight on it.",
      },
      {
        id: "slow",
        label: "Go across strong and let them come",
        kind: "check",
        ability: "brawn",
        tn: 14,
        vigour: 3,
        promise: "One hand for the rung, one for whatever arrives.",
        win: "Two of them get a hand on your boot and neither of them keeps it.",
        lose: "There are more hands than you have boots, and the crossing costs you.",
      },
      brace(
        "drop",
        "Drop into the shaft and climb out the other side",
        3,
        "Down is a way across. It is just a worse one.",
        "You come up the far wall out of the dark with your knuckles open and something's grip still on your calf."
      ),
    ],
  },
  {
    id: "r-market",
    band: 2,
    title: "The Small Market",
    setup:
      "Six stalls under the vault, lit, staffed, and doing business, several floors below where anybody should be doing business. One of the stallholders waves you over by name.",
    options: [
      {
        id: "trade",
        label: "Trade with them properly",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise: "It is a market. Markets have rules and the rules protect you.",
        win: "You buy a light, sell a knife, shake three hands and walk out of the far arch a welcome customer.",
        lose: "You agree to something without hearing the whole of it, and the paying starts immediately.",
      },
      {
        id: "name",
        label: "Work out how it knows your name",
        kind: "check",
        ability: "wits",
        tn: 16,
        vigour: 3,
        promise: "Nothing down here should know that. Find out what does.",
        win: "The name came off your own coat lining, stitched there by your mother. You take the lining out and the market loses interest in you.",
        lose: "You find out how it knows, and knowing costs you something you cannot itemise.",
      },
      brace(
        "ignore",
        "Buy nothing and keep walking",
        3,
        "Do not stop, do not answer, do not look at the stalls.",
        "You are through. Every stallholder watched you the whole way and something followed you to the stair before it gave up."
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// Band 3: the bottom floors
// ---------------------------------------------------------------------------

const BAND_3: RoomDef[] = [
  {
    id: "r-mirrorwater",
    band: 3,
    title: "The Still Water",
    setup:
      "A room-wide pool with no current at all, and your reflection in it is doing what you are doing about a half-second late. The only door out is past the middle of it.",
    options: [
      {
        id: "ignore",
        label: "Cross it without looking down",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 4,
        promise: "It is water. Water does not owe you anything.",
        win: "You are halfway before you register the sound of a second set of steps, and you do not give it the satisfaction.",
        lose: "You look, and the half-second is gone, and it is doing what you are about to do.",
      },
      {
        id: "solve",
        label: "Work out the delay",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 4,
        promise: "Half a second is a measurement. Measurements can be used.",
        win: "You move in the gap it cannot cover, and reach the far door before your reflection has left the near one.",
        lose: "You are still timing it when it stops being late, and then it is early.",
      },
      brace(
        "wade-it",
        "Get in and wade straight across",
        4,
        "Through the middle of it and out the far side. Do not stop for anything.",
        "You come out the far side. Something came out with you, walked three paces, and went back in, and you are shaking."
      ),
    ],
  },
  {
    id: "r-scriptorium",
    band: 3,
    title: "The Reading Room",
    setup:
      "Somebody has been writing down everything that has ever come through this floor, and the newest page has your description on it, in a hand that is still wet.",
    options: [
      {
        id: "unwrite",
        label: "Take the page",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 4,
        promise: "One page. Out of the binding and into your coat.",
        win: "The page comes out clean and the room forgets what it was in the middle of.",
        lose: "The binding holds, the ink dries, and something in the stacks stands up.",
      },
      {
        id: "argue",
        label: "Argue with what is written",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 4,
        promise: "It is a description and it is wrong in two places. Say so.",
        win: "You correct it out loud, twice, and the hand crosses itself out and starts on somebody else.",
        lose: "You are not as unlike the description as you claimed, and the room agrees with the page.",
      },
      brace(
        "burn",
        "Burn the book",
        4,
        "No book, no page. Simple.",
        "It goes up. So does a good deal of the room, and you go down the far stair coughing hard enough to hurt."
      ),
    ],
  },
  {
    id: "r-weight",
    band: 3,
    title: "The Ceiling Comes Down",
    setup:
      "The whole ceiling of the gallery is on four props and two of the props are already out. There is a way through and it is under all of it.",
    options: [
      {
        id: "prop",
        label: "Get a new prop in",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 4,
        promise: "There is a beam on the floor and a gap it will fit. Put it in the gap.",
        win: "It goes in hard and stays, and the ceiling settles onto it and stops arguing.",
        lose: "You take the weight for a moment to seat it, and the moment lasts longer than you have.",
      },
      {
        id: "hold-on",
        label: "Go under it and keep going",
        kind: "check",
        ability: "grit",
        tn: 17,
        vigour: 4,
        promise: "Thirty feet on your elbows and it is over you the whole way.",
        win: "You come out at the far side with stone dust in your teeth and all your limbs.",
        lose: "It comes down in sections and you are under one of the sections.",
      },
      brace(
        "sprint-under",
        "Sprint it before it decides",
        4,
        "It is coming down anyway. Be past it when it does.",
        "You are through and rolling as the third prop goes. Most of you got out on the first attempt."
      ),
    ],
  },
  {
    id: "r-namegate",
    band: 3,
    title: "The Gate That Asks",
    setup:
      "A door with no handle and a voice on the other side of it, and the voice asks you one question over and over in a tone that suggests it has all night. It has all night.",
    options: [
      {
        id: "answer",
        label: "Answer it honestly",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 4,
        promise: "It asked a question. Answer the question.",
        win: "You say the true thing out loud, and the door is open before you have finished saying it.",
        lose: "You say the true thing and the true thing is worse than you had allowed for.",
      },
      {
        id: "lie",
        label: "Give it a better answer",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 4,
        promise: "It wants an answer. It never said a true one.",
        win: "It takes your answer, considers it, and decides it prefers it to the truth. The door goes.",
        lose: "It has heard that one. It has heard all of them, from people who are still here.",
      },
      brace(
        "hinge",
        "Take the hinges off",
        4,
        "It is still a door. Doors have hinges.",
        "Three pins and a bar and the whole thing comes off the frame. The voice keeps asking the question the entire time, and you can still hear it two floors up."
      ),
    ],
  },
  {
    id: "r-lastlight",
    band: 3,
    title: "The Last Light",
    setup:
      "There is one lamp in this room and it is not yours, and the moment you cross the middle of the floor it will go out. Everything else about the room is fine.",
    options: [
      {
        id: "map",
        label: "Learn the room before you cross it",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 4,
        promise: "Look at all of it, once, properly, and then it does not matter if the lamp goes.",
        win: "Nineteen paces, a step up, and a turn to the left. You do all three in the dark without a hand out.",
        lose: "You had the number of paces and not the step, and the step has you.",
      },
      {
        id: "carry",
        label: "Take the lamp with you",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 4,
        promise: "It is a lamp on a hook. Lamps come off hooks.",
        win: "It lifts clean and it keeps burning, and you take the only light in the room out of the room.",
        lose: "It comes off the hook and goes out in your hand, and the room is not fine any more.",
      },
      brace(
        "dark",
        "Let it go out and feel your way",
        4,
        "You do not need to see. You need to get to the other side.",
        "You get there. It takes a long time and you find every hard edge in the room with a different part of yourself."
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// The bottom
// ---------------------------------------------------------------------------

const BOSSES: RoomDef[] = [
  {
    id: "b-keeper",
    band: 3,
    boss: true,
    title: "The Keeper of the Bottom Floor",
    setup:
      "It has been down here longer than the building has been up, and it is sitting between you and the stair with its hands on its knees, entirely willing to wait. It knows how many of you came in.",
    options: [
      {
        id: "fight",
        label: "Go at it",
        kind: "check",
        ability: "brawn",
        tn: 17,
        vigour: 5,
        promise: "It is sitting down. Nothing sitting down is ready.",
        win: "You get to it before it is up and you do not stop, and eventually it stops.",
        lose: "It was ready. It has been ready for a hundred years, and you learn that in the first second.",
      },
      {
        id: "bargain",
        label: "Offer it something",
        kind: "check",
        ability: "charm",
        tn: 16,
        vigour: 5,
        promise: "It counted you in. It wants the count to come out right.",
        win: "You give it a name and a promise and it stands aside, and you keep the promise or you do not.",
        lose: "It does not want what you have. It wants the count, and the count is short.",
      },
      {
        id: "outlast",
        label: "Wait it out",
        kind: "check",
        ability: "grit",
        tn: 18,
        vigour: 5,
        promise: "It is willing to wait. Be more willing.",
        win: "Somewhere in the small hours it gets up and goes elsewhere, and you take the stair at a walk.",
        lose: "It is better at waiting than you. Of course it is. That is the entire thing it does.",
      },
      brace(
        "past-it",
        "Go past it and up",
        5,
        "The stair is right there. It is only one thing.",
        "You reach the stair. It had a hand on you for part of the way and you are going to feel that for a while."
      ),
    ],
  },
  {
    id: "b-thing-in-the-well",
    band: 3,
    boss: true,
    title: "The Thing in the Well",
    setup:
      "The stair up runs round the inside of a well shaft, and the shaft is not empty, and it has all the way up to reach you. You can see the first forty steps and no further.",
    options: [
      {
        id: "climb",
        label: "Climb it fast",
        kind: "check",
        ability: "deft",
        tn: 17,
        vigour: 5,
        promise: "It has to come up. You only have to go up. That is a head start.",
        win: "You take the steps three at a time round eleven turns and come out into grey light on your own.",
        lose: "It is faster in its own shaft than anything has a right to be, and it catches you on the seventh turn.",
      },
      {
        id: "stare",
        label: "Look down at it and go up steadily",
        kind: "check",
        ability: "nerve",
        tn: 18,
        vigour: 5,
        promise: "It wants you to run. Do not run.",
        win: "You watch it the whole way and it never quite commits, and the light gets bigger behind you.",
        lose: "You look down for too long and see the whole of it, and your legs make the decision for you.",
      },
      {
        id: "collapse",
        label: "Bring the stair down behind you",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 5,
        promise: "The stair is bolted to the shaft in eight places. Six would do.",
        win: "Forty feet of stair goes into the dark with it underneath, and you finish the climb on the bare bolts.",
        lose: "You take out the wrong bolts and the section you are standing on is the section that goes.",
      },
      brace(
        "run-up",
        "Just run up",
        5,
        "Up. All the way. Do not think about the shaft.",
        "You come out into the air on your hands and knees. Something let go of you about ten steps from the top."
      ),
    ],
  },
  {
    id: "b-court",
    band: 3,
    boss: true,
    title: "The Court in Session",
    setup:
      "Nine of them behind a long table, and one empty chair on your side of it, and a clerk who asks you to sit. The door you came in by is not there any more.",
    options: [
      {
        id: "plead",
        label: "Take the chair and answer them",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 5,
        promise: "It is a court. Courts can be talked to.",
        win: "You answer nine questions in the order they are asked, and the clerk opens a door that was not there.",
        lose: "You answer eight of nine well, and the ninth is the only one that was ever going to matter.",
      },
      {
        id: "procedure",
        label: "Find the fault in the procedure",
        kind: "check",
        ability: "wits",
        tn: 18,
        vigour: 5,
        promise: "Nine of them and no witness. That is not a court, whatever it is calling itself.",
        win: "You say the word convened and every one of them has to look at the table, and while they are looking you leave.",
        lose: "There is no fault. It has been running a very long time and it has had all the objections already.",
      },
      {
        id: "refuse",
        label: "Refuse to sit",
        kind: "check",
        ability: "nerve",
        tn: 17,
        vigour: 5,
        promise: "Nothing happens until you sit down. So do not sit down.",
        win: "You stand for a long time. Eventually the clerk sighs and shows you out, because none of it works standing up.",
        lose: "You stand for a long time and then your knees go, and the chair is right there.",
      },
      brace(
        "table",
        "Go over the table",
        5,
        "Nine of them and one of you, and one door behind them.",
        "You are over it and through and out. Several hands got to you on the way across and you did not stop for any of them."
      ),
    ],
  },
  {
    id: "b-hoard",
    band: 3,
    boss: true,
    title: "What the Hoard Is Sitting On",
    setup:
      "There it is, all of it, in a heap the size of a cart. And the heap breathes, slowly, about once every twenty seconds, and it has not noticed you yet.",
    options: [
      {
        id: "lift",
        label: "Take what you can carry and go",
        kind: "check",
        ability: "deft",
        tn: 18,
        vigour: 5,
        promise: "Twenty seconds is a long time. Use two of them.",
        win: "Both hands full, out in a single breath's worth, and the heap breathes again behind you having missed the whole thing.",
        lose: "Something shifts under your hand and the twenty seconds ends early.",
      },
      {
        id: "wake",
        label: "Wake it and settle this",
        kind: "check",
        ability: "brawn",
        tn: 17,
        vigour: 5,
        promise: "It is asleep on its back. You will not get a better start than that.",
        win: "You get the first three in before it is properly awake, and the third one is the one that does it.",
        lose: "It comes off the heap far quicker than a thing that size ought to, and you are on the back foot from the start.",
      },
      {
        id: "leave-it",
        label: "Leave every bit of it and walk out",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 5,
        promise: "It is a lot of money. It is not the only money.",
        win: "You get out. You will think about this for years, and you will be alive to do it.",
        lose: "You get halfway to the stair before you turn round, and the turning round is the mistake.",
      },
      brace(
        "grab",
        "Grab an armful and run",
        5,
        "No plan. Arms out, and go.",
        "You are up the stair with more than you can properly hold and it is awake and behind you, and you drop some of it and you keep some of it."
      ),
    ],
  },
  {
    id: "b-door-out",
    band: 3,
    boss: true,
    title: "The Door You Came In By",
    setup:
      "You have come all the way round and here is the door you came in by, from the inside, and it is barred. On your side. And you did not bar it.",
    options: [
      {
        id: "unbar",
        label: "Take the bar off",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 5,
        promise: "It is a bar in two brackets. That is a solved problem.",
        win: "Up and out and the door swings, and the outside air is the best thing that has happened all night.",
        lose: "It is not resting in the brackets. It is grown into them, and it does not want to discuss it.",
      },
      {
        id: "who",
        label: "Work out who barred it",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 5,
        promise: "Somebody did this while you were down there. Find out who is still here.",
        win: "One set of prints, going in, not coming out, and smaller than yours. You know exactly what to expect and you are ready for it.",
        lose: "You work out who barred it and it is standing behind you by the time you have finished working it out.",
      },
      {
        id: "hold-out",
        label: "Sit down with your back to it until morning",
        kind: "check",
        ability: "grit",
        tn: 18,
        vigour: 5,
        promise: "Somebody opens this door in the morning. Be against it when they do.",
        win: "Six hours. You do not sleep and you do not move, and at first light somebody outside lifts the bar and finds you.",
        lose: "Six hours is a long time to have your back to a room like that one.",
      },
      brace(
        "window",
        "Go out through the wall beside it",
        5,
        "The door is the problem. The wall is only stone.",
        "You come out through the render into the yard, filthy and bleeding at the knuckles, and the door stays barred behind you."
      ),
    ],
  },
];

export const DEEP_ROOMS: RoomDef[] = [...BAND_1, ...BAND_2, ...BAND_3];
export const DEEP_BOSSES: RoomDef[] = BOSSES;
