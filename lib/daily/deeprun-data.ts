/**
 * THE DEEP RUN, content. Server-only, and imported only by `deeprun.ts`.
 *
 * Twenty-eight rooms across three bands, plus five things at the bottom: twelve
 * in band one, eleven in band two, five in band three. A night takes six of them,
 * so the pool has to be big enough that a week does not repeat and small enough
 * that every room is actually written rather than generated. These are written.
 *
 * This comment used to say twenty-five when there were twenty, and four separate
 * design passes quoted it back as fact when estimating how long the pool lasts.
 * Every one of those estimates was a quarter optimistic. Count the arrays, not the
 * header.
 *
 * WHY BAND ONE AND TWO GREW AND BAND THREE DID NOT. `roomsFor` deals two cards a
 * night from each of bands one and two and one from band three, so those first two
 * pools were emptying every three days and were the whole of the repeat problem:
 * ninety per cent of days used to share a room with the day before. Band three and
 * the bosses turn over slowly enough already.
 *
 * ON THE ABILITY SPREAD, because it is easy to get wrong twice. Wits is the
 * natural third door for any room that is a puzzle, so it accumulates without
 * anybody deciding it should: the first fifteen rooms had it on a fifth of all
 * doors, and the first draft of these thirteen pushed it to a quarter. Three doors
 * were rewritten to bring it back. Grit stays the lightest on purpose, and that is
 * not an oversight to correct: Grit already pays twice, once as starting Vigour and
 * again as the Vigour you carry out, so a Grit door is a third payment on the stat
 * that is already the strongest thing on the sheet.
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

  /**
   * MARKS. What you are carrying, and what it opens or shuts further down.
   *
   * Author-named words: "wet", "seen", "carrying the lamp". The only mechanic in
   * the dungeon where floor two changes floor five, and the thing that turns six
   * rooms in a row into a descent rather than a list.
   *
   * Not the same thing as a mark in the Hall, which is somebody saying a dungeon
   * was worth their time. Same word, different floor of the building.
   *
   * Three rules, each shaped deliberately:
   *
   *   sets     you come away with these, but only from a door that WORKED. A
   *            failed check leaves you nothing but the bill, which is the only
   *            version where "carrying the lamp" means you got the lamp.
   *   needs    all of these, or the door is not open to you.
   *   forbids  any one of these, and it is not open to you.
   *
   * A mark is never taken back once held. Not laziness: it keeps the state
   * monotone, which is what keeps the par search a table instead of a tree, and
   * it means nobody can write a dungeon where one door is open, then shut, then
   * open again.
   */
  sets?: string[];
  needs?: string[];
  forbids?: string[];
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
  {
    id: "r-toll",
    band: 1,
    title: "The Toll",
    setup:
      "Somebody has put a table across the passage. Behind it sits a man in a coat too good for the job, with a ledger, a lamp and a strongbox, and he asks for the fee as though there has always been a fee.",
    options: [
      {
        id: "argue",
        label: "Ask to see the schedule of charges",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise: "A man with a ledger can be beaten with a ledger.",
        win: "He turns three pages, finds nothing, and waves you past with the weary air of a man who will be having words with someone.",
        lose: "He produces a schedule of charges. It is long, it is signed, and reading it in that light costs you more than the fee would have.",
      },
      {
        id: "flatter",
        label: "Tell him the coat is a fine coat",
        kind: "check",
        ability: "charm",
        tn: 11,
        vigour: 2,
        promise: "Nobody wears a coat like that down here to go unremarked.",
        win: "He stands up to show you the lining, and you are past the table before he sits back down.",
        lose: "He agrees at length about the coat, the tailor, and the tailor's brother, and you lose a piece of the night to it.",
      },
      {
        id: "table",
        label: "Move the table",
        kind: "check",
        ability: "brawn",
        tn: 13,
        vigour: 2,
        promise: "It is a table. You have moved tables.",
        win: "You walk it aside one-handed with the ledger still open on it, and he watches you go without a word.",
        lose: "The table is bolted through to the rock, which you learn with your shins.",
      },
      brace(
        "pay",
        "Pay the fee",
        2,
        "It is not a large fee. It is the principle, and the principle is expensive tonight.",
        "You pay, he writes it down, and he thanks you by name, which he should not know."
      ),
    ],
  },
  {
    id: "r-stair",
    band: 1,
    title: "The Wet Stair",
    setup:
      "The stair goes down under an inch of moving water and does not stop where you can see. Something upstream of it has been opened and nobody came back to close it.",
    options: [
      {
        id: "feel",
        label: "Go down feeling for each tread",
        kind: "check",
        ability: "deft",
        tn: 12,
        vigour: 2,
        promise: "Slow is a speed. Nobody has ever fallen slowly.",
        win: "You find the two that are missing before they find you, and step over both.",
        lose: "The fourth one from the bottom is not there, and you arrive at the bottom in the manner of a dropped sack.",
      },
      {
        id: "brace-rail",
        label: "Jam yourself across it and go down braced",
        kind: "check",
        ability: "brawn",
        tn: 11,
        vigour: 2,
        promise: "A hand on each wall and none of your weight on the treads at all.",
        win: "You come down it like a man lowering himself into a well, and the missing treads are somebody else's problem.",
        lose: "The wall on the left is wetter than the wall on the right, and your arms find that out at the halfway point.",
      },
      {
        id: "quick",
        label: "Take it fast before you can think about it",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise: "Momentum solves a stair. Thinking solves nothing on a stair.",
        win: "You are down and out the arch at the bottom with your boots full and nothing broken.",
        lose: "You get halfway on nerve alone, and the second half happens to you rather than the other way round.",
      },
      brace(
        "sit",
        "Sit down and go down on your backside",
        2,
        "Undignified. Also survivable, which beats dignified.",
        "You come off the bottom step soaked to the ribs and grazed the whole length of one arm, and entirely alive."
      ),
    ],
  },
  {
    id: "r-queue",
    band: 1,
    title: "The Queue",
    setup:
      "Thirty of them standing single file along the passage wall, facing front, not talking. Nobody at the head of it is doing anything and nobody in it seems to mind. The passage past them is entirely clear.",
    options: [
      {
        id: "ask",
        label: "Ask what the queue is for",
        kind: "check",
        ability: "charm",
        tn: 12,
        vigour: 2,
        promise: "Somebody in a queue this long has an opinion about it.",
        win: "The third one back tells you at length, and by the end of it you know which door matters and he has taken your place.",
        lose: "Nobody in it knows and all of them resent being asked, and you are still asking when you notice you are standing in it.",
      },
      {
        id: "wait",
        label: "Join it and wait your turn",
        kind: "check",
        ability: "grit",
        tn: 13,
        vigour: 2,
        promise: "Queues move. It is the one thing they do.",
        win: "It moves. It takes a while and it costs you nothing but the while, and you come off the front of it through the door.",
        lose: "It does not move, and standing in a line that does not move takes something out of a person that walking never would.",
      },
      {
        id: "past",
        label: "Walk straight up the outside of it",
        kind: "check",
        ability: "nerve",
        tn: 12,
        vigour: 2,
        promise: "It is not your queue. You did not agree to it.",
        win: "You go the whole length at a working pace, and thirty of them watch you do it and not one says anything.",
        lose: "One of them says something. Then all of them do, and the passage is not clear any more.",
      },
      brace(
        "front",
        "Buy your way to the front of it",
        2,
        "Everybody in a queue has a price and the ones at the front have the highest.",
        "You are through the door inside a minute, and what it cost to get there was not money."
      ),
    ],
  },
  {
    id: "r-inventory",
    band: 1,
    title: "The Inventory",
    setup:
      "The room is racks and racks of other people's gear, sorted, labelled and dusted. Somebody has been bringing everything down here and writing it all up, and the last three labels are in fresh ink.",
    options: [
      {
        id: "shelf",
        label: "Find the shelf your name would be on",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise: "If it is sorted, it is sorted by something, and you can read a system.",
        win: "You find the gap where you would go, take the lamp off the hook above it, and leave before anybody files you.",
        lose: "You find your name already written, in a hand you recognise, and you spend a while not being any use to yourself.",
      },
      {
        id: "quiet",
        label: "Cross it without disturbing the dust",
        kind: "check",
        ability: "deft",
        tn: 13,
        vigour: 2,
        promise: "Whoever dusts this will know if you have been in it.",
        win: "You go through on the balls of your feet and leave the room exactly as tidy as you found it.",
        lose: "You catch a rack with your hip, and the sound of eleven labelled things going over follows you for a while.",
      },
      {
        id: "take",
        label: "Take what you came for and be quick",
        kind: "check",
        ability: "grit",
        tn: 12,
        vigour: 2,
        promise: "It is a store room. Stores are for taking.",
        win: "You are out the far door with an armful and the racks still standing, which is better than you deserved.",
        lose: "Something objects to the taking, at length, and you keep the armful but pay for it.",
      },
      brace(
        "leave",
        "Touch nothing and walk straight through",
        2,
        "The one thing in here that is definitely not a trap is the floor.",
        "You cross it with your hands behind your back like a man in a shop he cannot afford, and it lets you, and the walking alone takes something out of you."
      ),
    ],
  },
  {
    id: "r-narrow",
    band: 1,
    title: "The Squeeze",
    setup:
      "The passage closes down to a gap the width of a shoulder, and the draught coming through it is warm. Nothing warm should be down here, which is either the way out or the reason nobody uses it.",
    options: [
      {
        id: "through",
        label: "Turn sideways and force it",
        kind: "check",
        ability: "brawn",
        tn: 12,
        vigour: 2,
        promise: "Rock gives before ribs do, most of the time.",
        win: "You go through it in three shoves and come out the other side with your coat behind you.",
        lose: "You get to the shoulders and stop, and getting back out costs more than getting in did.",
      },
      {
        id: "empty",
        label: "Put everything down and go through thin",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise: "You will have to reach back through for it, which is a problem for the other side of the gap.",
        win: "You fold through it like a letter and pull your kit after you one piece at a time.",
        lose: "You are halfway through and thin when you find out what the warm draught is coming from.",
      },
      {
        id: "hold",
        label: "Go through head first and keep going",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise: "The only bad moment is the one where you stop.",
        win: "You are out the far end before the part of you that objects has finished objecting.",
        lose: "You stop. In the dark, in the rock, with your arms pinned, and it is a while before you start again.",
      },
      brace(
        "widen",
        "Take the edge off it with whatever you have",
        2,
        "Loud, slow, and it works.",
        "You knock a hand's width off the near side and go through easily, and every single thing in the passage behind you now knows where you are."
      ),
    ],
  },
  {
    id: "r-clerk",
    band: 1,
    title: "The Clerk",
    setup:
      "There is a desk in the passage with a man asleep at it, and the passage runs straight past him. There is a bell on the desk, a form on a spike, and a sign saying all visitors must be recorded.",
    options: [
      {
        id: "past",
        label: "Go past him quietly",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise: "He is asleep. The sign is not.",
        win: "You are twenty feet down the passage before the desk creaks, and it creaks on its own.",
        lose: "The floor by the desk is laid to creak, which is a thing a clerk would do, and he is awake and reaching for the bell.",
      },
      {
        id: "fill",
        label: "Fill the form in and leave it on the spike",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise: "Give the system what it wants and the system stops caring about you.",
        win: "You put down a name, a purpose and a time of entry, all three untrue, and the passage lets you through on the strength of it.",
        lose: "The form asks for something you cannot answer, and by the time you have stopped trying he is awake and has the bell in his hand.",
      },
      {
        id: "wake",
        label: "Wake him and tell him you are expected",
        kind: "check",
        ability: "charm",
        tn: 13,
        vigour: 2,
        promise: "A man woken up will believe almost anything for about four seconds.",
        win: "He apologises, stamps something, and points you down the passage himself.",
        lose: "He is entirely awake, has been for some time, and was waiting to see which of you spoke first.",
      },
      brace(
        "bell",
        "Ring the bell yourself and walk on",
        2,
        "Something will come. You would rather choose when.",
        "You ring it, and you are well past the desk by the time the answer arrives, and the answer follows you a long way and takes a piece."
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
  {
    id: "r-audit",
    band: 2,
    title: "The Audit",
    setup:
      "Three of them are waiting at a long table with your kit laid out on it, itemised, and they want to go through it with you. None of them is armed and none of them is going to move until you sit down.",
    options: [
      {
        id: "account",
        label: "Account for every item",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise: "You know where you got all of it. Mostly.",
        win: "You go down the list item by item, and at the end the one in the middle nods and slides the whole lot back across the table.",
        lose: "There is one thing on the list you cannot place, and they have all night, and you do not.",
      },
      {
        id: "refuse",
        label: "Decline to be audited",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise: "They have no authority down here. Neither has anyone.",
        win: "You take your kit off the table in front of all three of them and none of them stands up.",
        lose: "You find out what happens when nobody stands up and the room does it instead.",
      },
      {
        id: "cooperate",
        label: "Be their favourite person for ten minutes",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise: "Nobody at a table like this has been thanked for the work.",
        win: "You ask about the process, sound interested, and leave with a stamped chit and everything you came in with.",
        lose: "They enjoy it, and enjoy it, and are still enjoying it when you realise what the ten minutes cost.",
      },
      brace(
        "abandon",
        "Leave them the kit and go",
        3,
        "It is only things. You can carry on without things.",
        "You walk out with your hands empty and the going is harder every step, and behind you they keep writing."
      ),
    ],
  },
  {
    id: "r-restructure",
    band: 2,
    title: "The Restructure",
    setup:
      "The passage you came down is not the passage behind you. The whole floor has been reorganised while you were in it, and somewhere a long way off you can hear more of it being reorganised.",
    options: [
      {
        id: "map",
        label: "Work out the pattern and get ahead of it",
        kind: "check",
        ability: "wits",
        tn: 16,
        vigour: 3,
        promise: "Something is moving these walls to a plan. Find the plan.",
        win: "You spot the sequence, wait one beat in a doorway, and step through into a corridor that was not there and is going your way.",
        lose: "There is a plan and you are not in it, and the wall you were counting on arrives somewhere else.",
      },
      {
        id: "run",
        label: "Move faster than the walls do",
        kind: "check",
        ability: "deft",
        tn: 15,
        vigour: 3,
        promise: "It is slow. You are not.",
        win: "You take three gaps in a row as they close and come out into the stairwell with the floor still shuffling behind you.",
        lose: "The fourth gap closes on schedule rather than on yours, and you take the whole weight of it on one side.",
      },
      {
        id: "stand",
        label: "Stand still and let it finish",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise: "It will stop. Everything down here eventually stops.",
        win: "It goes quiet with you in a room that has a door, and the door is the one you wanted.",
        lose: "It goes quiet with you in a room that has no door at all, and the waiting to be moved again is its own kind of cost.",
      },
      brace(
        "wreck",
        "Break something load-bearing and go through the hole",
        3,
        "It cannot reorganise what is not there.",
        "You put a hole in the plan and go through it, and the floor above you settles onto the hole and onto you on the way past."
      ),
    ],
  },
  {
    id: "r-lantern",
    band: 2,
    title: "The Lantern Keeper",
    setup:
      "One lamp in the whole gallery and a woman sitting under it with a book. She has been down here long enough to have a chair, and she says the lamp is the last one and asks what you are going to do about it.",
    options: [
      {
        id: "share",
        label: "Offer to sit with her a while",
        kind: "check",
        ability: "charm",
        tn: 15,
        vigour: 3,
        promise: "She has not talked to anyone in a long time and it shows.",
        win: "She reads you two pages of it, laughs at something, and walks you to the far end with the lamp held up.",
        lose: "She talks. She talks for a long time, and it is dark at the end of it and she is not there.",
      },
      {
        id: "dark",
        label: "Go on into the dark without it",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise: "You had no lamp before you saw hers.",
        win: "You feel your way the length of the gallery and out, and behind you the light stays exactly where it was.",
        lose: "You get far enough in to be committed, and then find out what the last lamp was being kept lit for.",
      },
      {
        id: "read",
        label: "Look at what she is reading",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise: "A woman with one lamp is spending it on that book for a reason.",
        win: "It is a register of everybody who has come through, and the last page tells you which of the three arches has been used and which two have not.",
        lose: "You read your own name near the bottom with a date on it, and the date has not happened yet.",
      },
      brace(
        "take",
        "Take the lamp",
        3,
        "She is one person and it is one lamp.",
        "You take it and she lets you, and she says something as you go that you will be thinking about for the rest of the descent."
      ),
    ],
  },
  {
    id: "r-machine",
    band: 2,
    title: "The Works",
    setup:
      "Something enormous is running in the dark on the far side of the gallery, and it has been running so long the rock is polished where it turns. The walkway across goes over the middle of it.",
    options: [
      {
        id: "time",
        label: "Time the turn and cross on the beat",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 3,
        promise: "It is regular. Regular can be walked on.",
        win: "You go across in four strides between beats and it never comes closer to you than a hand's width.",
        lose: "It is regular until it is not, and you find the irregularity from the walkway.",
      },
      {
        id: "stop",
        label: "Feel along it in the noise until you find the shaft",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise: "It is hot, it is loud, and it will take a while. Nothing about that is a reason not to.",
        win: "You find the shaft with your hands, jam it with something you were not going to need, and cross a silent gallery.",
        lose: "You are still feeling for it when the heat off the housing decides how long you are staying.",
      },
      {
        id: "haul",
        label: "Go under it hand over hand",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 3,
        promise: "The underside is still and the underside is enough.",
        win: "You come up on the far lip with your arms burning and the whole thing turning over your head untroubled.",
        lose: "Your grip goes with a third of it left, and you finish the crossing the fast way.",
      },
      brace(
        "wait",
        "Wait for it to come round and take the hit",
        3,
        "It is a machine. It does not aim.",
        "You go across on the back of it and step off at the far side, and it took the price out of you on the way past without noticing."
      ),
    ],
  },
  {
    id: "r-quota",
    band: 2,
    title: "The Quota",
    setup:
      "A door with a slot in it and a tally chalked beside the slot, and the tally is one short. Whoever is on the other side is not opening anything until the number is right.",
    options: [
      {
        id: "talk",
        label: "Talk to whoever is behind it",
        kind: "check",
        ability: "charm",
        tn: 15,
        vigour: 3,
        promise: "There is somebody in there and somebody can be reasoned with.",
        win: "You get them talking about the quota, who set it, and what it is like being held to it, and the door comes open on its own.",
        lose: "They will not be drawn on the quota. They are very clear that they will not be drawn on the quota.",
      },
      {
        id: "forge",
        label: "Add to the tally yourself",
        kind: "check",
        ability: "wits",
        tn: 14,
        vigour: 3,
        promise: "It is chalk. It is a wall. You have hands.",
        win: "You match the hand and the angle, add the one that was missing, and the bolts go back on the other side.",
        lose: "The chalk is counted from the far side as well, and the mismatch is noticed while your hand is still on the wall.",
      },
      {
        id: "force",
        label: "Take the door off",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 3,
        promise: "The quota is not your quota.",
        win: "It comes off the frame in one piece and whatever was counting goes quiet immediately.",
        lose: "The door holds, the frame holds, and the noise brings the count up to date without your help.",
      },
      brace(
        "make",
        "Make up the number the way they mean it",
        3,
        "You know what the missing one is. You are not going to enjoy it.",
        "The tally goes right, the bolts come back, and you go through carrying what it cost to make the number work."
      ),
    ],
  },
  {
    id: "r-mirror",
    band: 2,
    title: "The Long Gallery",
    setup:
      "A gallery of the people who came down here before you, standing along both walls, dressed and posed and perfectly still. They are all facing the way you are going, and the last one on the left is wearing your coat.",
    options: [
      {
        id: "walk",
        label: "Walk the length of it and do not stop",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise: "They are exhibits. Exhibits do not do anything.",
        win: "You go the whole length at one pace and not one of them is in a different position when you look back.",
        lose: "One of them is in a different position when you look back, and then so are the rest.",
      },
      {
        id: "study",
        label: "Look at how each of them died",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise: "Every one of these is a mistake somebody made once.",
        win: "You read six deaths off six poses and know exactly what is waiting at the bottom of the stair.",
        lose: "You read your own, off the one in your coat, and it takes something out of you that does not come back tonight.",
      },
      {
        id: "coat",
        label: "Take your coat off and leave it with them",
        kind: "check",
        ability: "grit",
        tn: 14,
        vigour: 3,
        promise: "Give the gallery what it is expecting and it may not need the rest.",
        win: "You hang it on the empty one at the end, and the gallery stops being interested in you entirely.",
        lose: "It was never the coat, and going the rest of the way cold has its own price.",
      },
      brace(
        "eyes",
        "Go down the middle looking at the floor",
        3,
        "You do not need to see them to get past them.",
        "You come out at the far arch having looked at nothing but your own boots, and the effort of not looking has taken a real piece out of you."
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
