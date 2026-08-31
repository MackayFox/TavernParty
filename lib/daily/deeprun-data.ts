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
  slip: "Once tonight, be somewhere else. The room does not happen to you. It also does not count as cleared, which is the trade.",
  /**
   * IT IS SPENT BEFORE THE DIE, NOT AFTER IT.
   *
   * This used to read "add five to a roll AFTER you have seen the die", with
   * the AFTER capitalised, and it was the one promise a player would plan a
   * whole run around. You arm it, then choose a door, and the die is only
   * revealed once you have committed to both -- so somebody arming it on a
   * hard door and rolling a natural 20 burned their only safety net for
   * nothing, having been told in capitals that could not happen. Naming a die
   * you have already seen would be a better move and a better game; it is also
   * a change to how a knack resolves, which the par solver prices, so it is a
   * design change rather than a copy fix. The copy now says what the game does.
   */
  boost:
    "Once tonight, name a door before you open it and add five to whatever the die gives you. The only safety net down here.",
  rethrow:
    "Once tonight, pick a die up and throw it again. You keep the second one, whatever it is.",
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
   * IT WENT VERY BADLY. Optional, and `lose` stands in when it is absent.
   *
   * The sentence for a 1 on the die, or for missing by eight or more. Not a
   * harsher rewording of `lose`: a different event. `lose` is the barked shin,
   * this is the bottom of the shaft. An authored dungeon may leave it out and
   * keep the old flat failure, which is why nothing in the gate demands it.
   */
  ruin?: string;
  /**
   * What a ruin leaves ON you, the way `sets` is what a win leaves on you.
   *
   * This is the whole of "a previous decision comes back": you got hurt on floor
   * two and the shaft on floor five is not open to somebody who is hurt. Marks
   * are never taken back, so this stays monotone and the par search stays a
   * table. See `sets` below for the rest of the rules, which are identical.
   */
  ruinSets?: string[];

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

/**
 * THE FOUR MARKS THE HOUSE POOL USES, and why there are only four.
 *
 * A mark is the one mechanic that lets floor two change floor five. It was
 * fully built, fully solved for, documented at length as "the thing that turns
 * six rooms in a row into a descent rather than a list", and then used by
 * exactly zero of the thirty-two rooms. The descent really was a list, and this
 * is the fix.
 *
 * FOUR, and not five, for a measured reason. `bestFor` keys its memo on the
 * subset of marks that some door READS, so the table is bounded by 2^(marks
 * read). Four is sixteen and the solve stays milliseconds; a dozen would be four
 * thousand and the daily's winnability check sits in the path of every request
 * for tonight's puzzle. Flavour marks that no door tests are free, because
 * `marksRead` never puts them in the key, but these four are tested and so these
 * four are the budget.
 *
 * A ROOM IS NEVER A WALL. Rooms are dealt from three bands independently, so any
 * band-one room can precede any band-two room and no room may assume a mark it
 * did not set itself. Two rules keep that safe, and a test enforces both:
 *
 *   * the brace is NEVER gated. Whatever you are carrying, the slow certain way
 *     through is open, so every floor stays a price rather than a wall.
 *   * `needs` is only ever used on a door that is a BONUS route. Nothing that a
 *     run depends on is ever behind one.
 */
export const MARKS = {
  /** You are carrying something you can see by. Won, and worth winning. */
  LIT: "lit",
  /** Soaked. Cold, heavy, and bad for anything that needs a grip or a flame. */
  WET: "wet",
  /** Something down here knows you are here. Doors that want surprise are shut. */
  SEEN: "seen",
  /** You are carrying an injury. It is not Vigour; it is a door being shut. */
  HURT: "hurt",
} as const;

export type Mark = (typeof MARKS)[keyof typeof MARKS];

/**
 * A line the room only says if you arrive carrying something.
 *
 * THE REASON THE DESCENT READ AS A LIST. `setup` is one fixed string, so a room
 * read identically whether it was your first floor or your sixth and whether you
 * turned up dry and unnoticed or soaked, bleeding and already heard. The marks
 * were doing real work underneath - thirty-seven doors are shut by them - but
 * nothing on screen ever said so, so the only way the past showed up was an
 * option quietly missing, with no explanation. Adam, on his third run: "there's
 * no connection to the floor before, it's like 6 unconnected random events."
 *
 * FREE, IN THE ONLY SENSE THAT MATTERS HERE. `marksRead` keys the solver's memo
 * on the marks that some DOOR tests, and the table is 2^that - which is why the
 * house pool is capped at four marks. An aside is prose: it gates nothing, it
 * never enters `marksRead`, and it costs the par search exactly nothing. So the
 * connective tissue can be as thick as the writing allows.
 */
export type Aside = {
  /** Shown only if every one of these is held. */
  when?: string[];
  /** Hidden if any one of these is held. */
  unless?: string[];
  text: string;
};

export type RoomDef = {
  id: string;
  /** 1 shallow, 2 middling, 3 deep. */
  band: 1 | 2 | 3;
  boss?: boolean;
  title: string;
  setup: string;
  /**
   * What the room adds when it can see what happened upstairs.
   *
   * Written to be true of the room rather than of the mark: a wet floor is a
   * different problem in The Long Dark than it is in The Works, and an aside
   * that would fit any room is not worth having.
   */
  asides?: Aside[];
  options: OptionDef[];
};

/**
 * The slow certain way through, which every room has and no room may gate.
 *
 * `lose` mirrors `win` because a brace cannot fail, and it takes no `ruin` for
 * the same reason. `sets` is optional and last: a few braces do hand you
 * something, and wading a flooded passage on purpose should leave you as wet as
 * falling into it did.
 */
const brace = (
  id: string,
  label: string,
  vigour: number,
  promise: string,
  win: string,
  sets?: string[],
): OptionDef => ({
  id,
  label,
  kind: "brace",
  vigour,
  promise,
  win,
  lose: win,
  ...(sets && sets.length ? { sets } : {}),
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
      "You are a dozen steps in when something screams and comes at you down the passage on all fours, faster than a thing that shape should move. It has its hands out in front of it and the hands are wrong. The walls are scored either side at hip height, a long way back up the passage, as though it has run this same line for years.",
    asides: [
      {
        when: ["seen"],
        text:
          "It does not slow down when it sees you, and it does not look surprised. Whatever passed the word down passed it this far.",
      },
      {
        when: ["wet"],
        text:
          "You are dripping, and every drop is loud in a stone passage. It knew your distance before it started running.",
      },
    ],
    options: [
      {
        id: "meet",
        label: "Set your feet and meet it",
        kind: "check",
        ability: "brawn",
        tn: 12,
        vigour: 2,
        promise:
          "It weighs less than you do. Put it into the wall before it gets inside your reach.",
        win: "You take it high and it goes into the stone shoulder first, and stays down with its wrong hands folded under it.",
        lose: "It gets under your arms and you spend a while on the floor learning what the hands are for.",
        ruin: "It comes in low and takes your legs, and you meet the wall yourself, and the noise the pair of you make carries a long way down a stone passage.",
        sets: ["seen"],
        ruinSets: ["hurt", "seen"],
      },
      {
        id: "sidestep",
        label: "Wait, then step out of the line",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise:
          "It is committed and cannot turn at that speed. Let it commit, and be elsewhere.",
        win: "It goes past you into the dark and hits something that is not you, hard, twice.",
        lose: "You move a beat early, it corrects, and you take the corner of the wall with your shoulder.",
        ruin: "Your heel finds the gutter channel cut along the wall, the ankle goes over, and you are sitting down in the dark with it still coming.",
        ruinSets: ["hurt"],
        forbids: ["wet"],
      },
      {
        id: "shout",
        label: "Shout at it like it owes you money",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise:
          "Whatever it was before, it worked for somebody. A raised voice might still land.",
        win: "It stops dead just outside your reach, looks at you for a long moment, and goes back the way it came.",
        lose: "It does not care about your voice at all, and you learn that at close range.",
        ruin: "Your shout comes out wrong and does not stop when you stop, and something a long way further down answers it in the same voice.",
        sets: ["seen"],
        ruinSets: ["seen"],
      },
      brace(
        "wear",
        "Wear it and keep walking",
        2,
        "Give it a piece of you and be past it while it is busy with the piece.",
        "You give it an arm and it takes the arm, and you are well down the passage before it thinks to look up.",
        ["hurt"],
      ),
    ],
  },
  {
    id: "r-doorbar",
    band: 1,
    title: "The Barred Door",
    setup:
      "The stair ends at a door barred from your side, which is the wrong side for a bar. The oak is scarred around the bracket and whoever set it meant it to stay set. There are scratches beneath the door, not on the inside of it but on the floor: something has been dragged across the stone recently. From the other side, nothing, which is not the same as nobody.",
    asides: [
      {
        when: ["hurt"],
        text:
          "The bar is oak and it is going to want both arms, and one of yours is not answering properly.",
      },
      {
        when: ["lit"],
        text:
          "By your own light the scarring round the bracket reads clearly. It was done from this side, repeatedly, by somebody in a hurry.",
      },
    ],
    options: [
      {
        id: "read",
        label: "Read the bar and the marks around it",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise:
          "Whoever barred it wrote the reason on the frame. Read that before you undo their work.",
        win: "Tally scratches, a date, and a name gone over twice with the point of a knife. You know what is behind it, and which way it opens.",
        lose: "You are still working out the marks when the bar shifts in its bracket on its own and takes your fingers with it.",
        ruin: "You get far enough into it to understand that the bar is not what is holding the door shut, and whatever is holding the door shifts its weight against the wood while you are still reading about it.",
        ruinSets: ["seen"],
      },
      {
        id: "lift",
        label: "Lift the bar clean out",
        kind: "check",
        ability: "brawn",
        tn: 11,
        vigour: 2,
        promise:
          "Oak and iron and nothing cleverer. Take the weight, lift clean, set it down quiet.",
        win: "Up, out and down without a sound. The door swings open on its own weight, which tells you the hinges have been kept greased by somebody.",
        lose: "The bar comes free faster than you had it weighed and the door comes with it, into you.",
        ruin: "The bracket tears out of the frame and the bar drops across your foot, and the sound of oak on stone goes down the whole stairwell ahead of you.",
        ruinSets: ["hurt", "seen"],
      },
      brace(
        "kick",
        "Put your boot through it",
        2,
        "Loud and quick, and nobody involved has to be clever about it.",
        "The panel goes on the second kick and you step through the hole in it. Everything down here now knows where you are.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-flood",
    band: 1,
    title: "Ankle Deep, Then Not",
    setup:
      "The floor slopes and the water is at your ankles at the top and your thighs at the bottom, and it is moving, which means it is going somewhere. The somewhere is a grating you cannot see the far side of. A rope is tied off at the top of the slope and runs down into the water, taut and steady, and nobody is holding the other end of it.",
    asides: [
      {
        when: ["wet"],
        text:
          "You are already soaked to the chest, so the water has nothing left to take from you but warmth.",
      },
      {
        when: ["lit"],
        text:
          "Keep the flame high. The water is going somewhere and you would rather see where before you are in it.",
      },
    ],
    options: [
      {
        id: "wade",
        label: "Wade it and keep a hand on the wall",
        kind: "check",
        ability: "grit",
        tn: 12,
        vigour: 2,
        promise:
          "Cold and slow, a hand on the wall the whole way, and do not stop moving.",
        win: "You come out the far side shaking and upright, which is the whole of the requirement.",
        lose: "Your foot goes into something that is not floor, and the cold takes the breath straight out of you.",
        ruin: "The wall gives out into a side channel, the current has you sideways before you can set your feet, and you come up hard against the grating with that rope wrapped round your knee.",
        sets: ["wet"],
        ruinSets: ["wet", "hurt"],
      },
      {
        id: "grating",
        label: "Get the grating open and go under",
        kind: "check",
        ability: "deft",
        tn: 13,
        vigour: 2,
        promise:
          "The water is going somewhere drier than this. Get the bolts off and go with it.",
        win: "Two bolts, a held breath, and you come up coughing in a dry culvert past the whole of it.",
        lose: "The bolts do not give, you do, and you spend everything you had fighting the current back up the slope.",
        ruin: "The grating swings out with you on it and swings shut behind you, and you are a long time under there in the dark, feeling along the far side for an end that opens.",
        sets: ["wet"],
        ruinSets: ["wet", "hurt"],
        forbids: ["hurt"],
      },
      brace(
        "swim",
        "Swim it and take the cold",
        2,
        "Straight across the deep part. You are going to be wet whichever door you take.",
        "You get across. You are soaked to the collarbone and the cold has taken something out of you that you will not get back tonight.",
        ["wet"],
      ),
    ],
  },
  {
    id: "r-tollman",
    band: 1,
    title: "The Man on the Stair",
    setup:
      "A man is sitting on the third step with a lantern and a ledger, and he does not get up when he sees you. He asks, quite politely, what you are taking out. The ledger is open at a page of names all written in the same hand, and the lantern is trimmed and brimming, which is a great deal of oil for one man on one stair.",
    asides: [
      {
        when: ["lit"],
        text:
          "He looks at your light before he looks at you, and writes something down.",
      },
      {
        when: ["seen"],
        text:
          "He does not ask your name. He turns the ledger round so you can see it is already there.",
      },
    ],
    options: [
      {
        id: "talk",
        label: "Tell him what he wants to hear",
        kind: "check",
        ability: "charm",
        tn: 12,
        vigour: 2,
        promise:
          "Give him a name for the book. Men with books mostly want the book filled.",
        win: "He writes down a name that is not yours, thanks you for it, and hands you a candle end out of the box by his foot so you can see the step.",
        lose: "He writes something down without asking you twice, and somewhere below you, unhurried, somebody starts walking.",
        ruin: "He asks you to say it again, and writes it into the column further down the page, the one with the ruled line under it, and the walking below starts before he has finished the word.",
        sets: ["lit"],
        ruinSets: ["seen"],
      },
      {
        id: "spot",
        label: "Work out what he actually is",
        kind: "check",
        ability: "wits",
        tn: 13,
        vigour: 2,
        promise:
          "Nobody sits in the dark on a stair for a wage. Work out what is actually sitting there.",
        win: "The ledger is blank and always has been. You walk past him and he does not turn his head, because the head does not turn.",
        lose: "You look too long, and whatever is doing the sitting notices that you looked.",
        ruin: "You get close enough to see that nothing is holding the pen, and it stops troubling to pretend for you, and the lantern goes out with you still on the wrong step.",
        ruinSets: ["seen"],
        forbids: ["seen"],
      },
      brace(
        "past",
        "Walk past him without a word",
        2,
        "He is on the third step. There are a great many more steps than that.",
        "You go by close enough to feel the heat off the lantern. Something on your arm is bleeding by the top of the flight and you do not remember when.",
        ["hurt"],
      ),
    ],
  },
  {
    id: "r-nest",
    band: 1,
    title: "The Nest in the Vault",
    setup:
      "The vault has been somebody's larder for a long time and the somebody keeps to the ceiling. There is a way through and the way through is over a floor of dry husks and small bones that will not be quiet under any weight at all. A coat is folded square by the near door with the boots set on top, laces tucked in, as though whoever took them off meant to come back.",
    asides: [
      {
        when: ["wet"],
        text:
          "You will cross that floor dripping, and the ceiling has spent years listening to a floor that is usually dry.",
      },
      {
        when: ["seen"],
        text:
          "Something on the ceiling is already awake and has been since before you opened the door.",
      },
    ],
    options: [
      {
        id: "quiet",
        label: "Cross it a foot at a time",
        kind: "check",
        ability: "deft",
        tn: 12,
        vigour: 2,
        promise:
          "Slow enough and nothing on the ceiling has to wake up. Give it all night if it asks.",
        win: "A very long time for a very short distance, and nothing above you moves at all.",
        lose: "Something under your heel goes off like a snapped stick, and the ceiling comes alive.",
        ruin: "Halfway across you put your weight down on the coat's owner, who is under the husks and is not finished being eaten, and the sound the two of you make is the loudest thing this vault has heard in years.",
        ruinSets: ["seen"],
        forbids: ["wet"],
      },
      {
        id: "still",
        label: "Wait for it to settle and go in the gap",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise:
          "Stand still in the dark long enough and the ceiling stops caring that you are there.",
        win: "A very long stillness buys you a clear half a minute of quiet, and half a minute is plenty.",
        lose: "You break first. You always know the exact moment you break.",
        ruin: "One of them comes down to inspect you while you are holding still, and you hold still through the whole of the inspection, and afterwards it does not go back up.",
        ruinSets: ["hurt", "seen"],
      },
      brace(
        "run",
        "Run it and let them come",
        2,
        "It is a short run and nothing on that ceiling starts faster than a standing man.",
        "You are through and up the far stair with things dropping behind you, and every one of them saw which way you went.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-toll",
    band: 1,
    title: "The Toll",
    setup:
      "Somebody has put a table across the passage. Behind it sits a man in a coat too good for the job, with a ledger, a lamp and a strongbox, and he asks for the fee as though there has always been a fee. The strongbox is bolted through to the floor and the lid has been forced once already, from the outside, and mended since by somebody in a hurry.",
    asides: [
      {
        when: ["lit"],
        text:
          "His lamp and yours together show the table properly: the strongbox is bolted down and the coat is newer than the job.",
      },
      {
        when: ["hurt"],
        text:
          "He prices you a second time when he sees how you are standing, and the second price is worse.",
      },
    ],
    options: [
      {
        id: "argue",
        label: "Ask to see the schedule of charges",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise:
          "A man with a ledger can be beaten with the ledger. Ask to see the schedule of charges.",
        win: "He turns three pages, finds nothing, and waves you past with the weary air of a man who will be having words with someone about this.",
        lose: "He produces a schedule of charges. It is long, it is signed, and reading it by that lamp costs you more than the fee would have.",
        ruin: "You take it one question too far, and he closes the book, presses the small bell screwed under the table, and goes back to trimming the lamp without looking up at you again.",
        ruinSets: ["seen"],
      },
      {
        id: "flatter",
        label: "Tell him the coat is a fine coat",
        kind: "check",
        ability: "charm",
        tn: 11,
        vigour: 2,
        promise:
          "Nobody wears a coat like that down here to go unremarked. Remark on it.",
        win: "He stands to show you the lining, which is a map of somewhere under here, and you are past the table before he sits back down.",
        lose: "He agrees at length about the coat, the tailor and the tailor's brother, and you lose a piece of the night to it.",
        ruin: "He asks where you have seen the coat before, and you answer, and the answer is wrong, and he stops writing about the coat and starts writing a description of you.",
        ruinSets: ["seen"],
        forbids: ["wet"],
      },
      {
        id: "table",
        label: "Move the table",
        kind: "check",
        ability: "brawn",
        tn: 13,
        vigour: 2,
        promise:
          "It is a table and you have moved tables. Walk it aside and keep walking.",
        win: "You move it one-handed with the ledger still open on top of it, and he watches you go without a word.",
        lose: "The table is bolted through to the rock, which you learn with your shins.",
        ruin: "The top comes off the legs, the strongbox goes over with it, and your hand is underneath the strongbox when it lands.",
        ruinSets: ["hurt"],
      },
      brace(
        "pay",
        "Pay the fee",
        2,
        "It is not a large fee. It is the principle, and the principle is expensive tonight.",
        "You pay, he writes it down, and he thanks you by name, which he should not know.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-stair",
    band: 1,
    title: "The Wet Stair",
    setup:
      "The stair goes down under moving water and does not stop where you can see. Something upstream has been opened and nobody came back to close it. A boot stands on one of the upper treads with its laces still tied, filled and steady, and the water goes round it rather than shifting it. There is a bracket on the left wall at hand height and no handrail in it.",
    asides: [
      {
        when: ["wet"],
        text:
          "There is nothing here to keep dry. That is one decision already made for you.",
      },
      {
        when: ["lit"],
        text:
          "Your flame is the only thing on this stair that water can end outright, and the stair goes down under it.",
      },
    ],
    options: [
      {
        id: "feel",
        label: "Go down feeling for each tread",
        kind: "check",
        ability: "deft",
        tn: 12,
        vigour: 2,
        promise:
          "Slow is a speed, and the treads are lying about how many of them there are.",
        win: "You find the gaps before they find you and step over each one, and you come off the bottom with your lamp hand still dry.",
        lose: "A tread near the bottom is not there, and you arrive in the manner of a dropped sack, sitting in cold water with both boots full.",
        ruin: "You put your weight on a tread that is there and it goes, and the flight below it goes with it, and you ride the wreck of the stair down into water deep enough to close over your head.",
        ruinSets: ["wet", "hurt"],
      },
      {
        id: "brace-rail",
        label: "Jam yourself across it and go down braced",
        kind: "check",
        ability: "brawn",
        tn: 11,
        vigour: 2,
        promise:
          "A hand on each wall and none of your weight on the treads at all.",
        win: "You come down it like a man lowering himself into a well, and the missing treads stay somebody else's problem.",
        lose: "The left wall is slick where the right one is dry, and your arms learn it at the halfway point, and you finish the stair wearing the water.",
        ruin: "Your palm skids through a smear of grease that somebody put on that wall on purpose, and you come off it sideways into the empty bracket where the handrail used to be.",
        ruinSets: ["hurt", "wet"],
      },
      {
        id: "quick",
        label: "Take it fast before you can think about it",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise:
          "Momentum solves a stair. Standing in cold water thinking about it solves nothing.",
        win: "You are down and out through the arch at the bottom with your boots full and nothing in you broken.",
        lose: "You get most of the way on nerve alone, and the rest of it happens to you rather than the other way round.",
        ruin: "You go off the side of the flight entirely, into the channel all this is draining to, and the water in there is moving faster than you are and carries you a long way before it decides to let go.",
        sets: ["wet"],
        ruinSets: ["wet", "hurt"],
        forbids: ["hurt"],
      },
      brace(
        "sit",
        "Sit down and go down on your backside",
        2,
        "Undignified. Also survivable, which beats dignified every night of the week.",
        "You come off the bottom step soaked to the ribs and grazed the whole length of one arm, and entirely alive.",
        ["wet"],
      ),
    ],
  },
  {
    id: "r-queue",
    band: 1,
    title: "The Queue",
    setup:
      "They stand single file along the passage wall, facing front, not talking. Nobody at the head of the line is doing anything and nobody in the line seems to mind. Each of them holds a numbered wooden tile, the numbers do not run in any order you can see, and the man nearest you has held his long enough to wear the paint off the edges. The passage past them is entirely clear.",
    asides: [
      {
        when: ["seen"],
        text:
          "The head of the line turns to look at you. Nobody else in it moves at all.",
      },
      {
        when: ["wet"],
        text:
          "You are the only sound in the passage, and the sound is water leaving you a drop at a time.",
      },
    ],
    options: [
      {
        id: "ask",
        label: "Ask what the queue is for",
        kind: "check",
        ability: "charm",
        tn: 12,
        vigour: 2,
        promise:
          "Anybody standing that long has an opinion, and an opinion will tell you which door matters.",
        win: "A man near the back tells you the whole history of it, and by the end you know which door matters and he has quietly taken your place.",
        lose: "Nobody in it knows and all of them resent being asked, and you are still asking when you notice somebody has put a tile in your hand.",
        ruin: "You ask the wrong one. He turns round, and he has faced front so long that turning round is plainly not a thing he does any more, and the whole line turns with him to see what made him do it.",
        ruinSets: ["seen"],
      },
      {
        id: "wait",
        label: "Join it and wait your turn",
        kind: "check",
        ability: "grit",
        tn: 13,
        vigour: 2,
        promise:
          "Queues move. Moving is the one thing a queue can be relied on to do.",
        win: "It moves. It costs you nothing but the waiting, and you come off the front of it and through the door still holding a tile you no longer need.",
        lose: "It does not move, and standing in a line that does not move takes something out of a person that walking never would.",
        ruin: "It shifts all at once and closes up ahead of you like a hand shutting, and you spend a long stretch of the night pressed in the middle of it with your arms pinned at your sides and somebody breathing steadily on the back of your neck.",
      },
      {
        id: "past",
        label: "Walk straight up the outside of it",
        kind: "check",
        ability: "nerve",
        tn: 12,
        vigour: 2,
        promise:
          "It is not your queue. You never agreed to it, and the passage beside it is clear.",
        win: "You go the whole length at a working pace, and every face in the line watches you do it and not one of them says a word.",
        lose: "One of them says something. Then all of them do, and the passage is not clear any more.",
        ruin: "A hand comes out of the line and takes your sleeve, and it does not let go, and what follows is the whole line establishing, at length and with hands, that you were in the queue after all.",
        ruinSets: ["hurt", "seen"],
        forbids: ["hurt"],
      },
      brace(
        "front",
        "Buy your way to the front of it",
        2,
        "Everybody in a queue has a price and the ones at the front charge the most.",
        "You are through the door quickly and what it cost was not money, and one of them leaves the line and goes off ahead of you down the passage at a pace.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-inventory",
    band: 1,
    title: "The Inventory",
    setup:
      "Racks and racks of other people's gear, sorted, labelled and dusted. Somebody has been bringing it all down here and writing it up in a good clear hand: a name, a date and a floor on every label. The dates at this end are recent and the ink on them still has a shine. There is a lamp burning on a hook at the end of the aisle with nobody anywhere near it.",
    asides: [
      {
        when: ["seen"],
        text:
          "There is a gap on the nearest rack at about your size, with a label already written and the date left blank.",
      },
      {
        when: ["lit"],
        text:
          "The labels are legible by your own light: a name, a date, and a floor, on every single one.",
      },
    ],
    options: [
      {
        id: "shelf",
        label: "Find the shelf your name would be on",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise:
          "Anything sorted is sorted by something, and a system you can read is a system you can rob.",
        win: "You work out the order of it, find the gap where you would go, and take the lamp off the hook above the gap on your way past.",
        lose: "You find your own name already on a label, written in a hand you know, and you spend a while being no use to yourself at all.",
        ruin: "You drag a rack aside to read the label behind it and the whole run of them goes over like a felled hedge, and you are under a great deal of somebody else's iron before the noise has finished arriving.",
        sets: ["lit"],
        ruinSets: ["hurt", "seen"],
      },
      {
        id: "quiet",
        label: "Cross it without disturbing the dust",
        kind: "check",
        ability: "deft",
        tn: 13,
        vigour: 2,
        promise:
          "Whoever dusts this place will know if you came through. Leave them nothing to read.",
        win: "You go through on the balls of your feet and leave the aisle exactly as tidy as you found it, dust and all.",
        lose: "You catch a rack with your hip, and the sound of labelled things going over follows you a good way down the passage.",
        ruin: "You put a hand out in the dark for balance and close it on a hook set at throat height for precisely that, and the rack you fall against is the one carrying the lamp.",
        ruinSets: ["hurt", "seen"],
        forbids: ["wet"],
      },
      {
        id: "take",
        label: "Take what you came for and be quick",
        kind: "check",
        ability: "grit",
        tn: 12,
        vigour: 2,
        promise:
          "It is a store room and stores are for taking. Take fast and argue on the far side.",
        win: "You come out of the far door with an armful, a coil of dry rope and a lamp still burning, and the racks behind you still standing.",
        lose: "Something in the racks objects to the taking, at length and in a voice, and you keep the armful and pay for the keeping.",
        ruin: "What you pulled out was holding the rest of the rack together, and a shelf of somebody's tools comes down edge first, and one of them stays in you.",
        sets: ["lit"],
        ruinSets: ["hurt"],
      },
      brace(
        "leave",
        "Touch nothing and walk straight through",
        2,
        "The one thing in here that is definitely not a trap is the floor.",
        "You cross it with your hands behind your back like a man in a shop he cannot afford, and it lets you, and the not touching anything takes something out of you.",
      ),
    ],
  },
  {
    id: "r-narrow",
    band: 1,
    title: "The Squeeze",
    setup:
      "The passage closes down to a gap the width of a shoulder and the draught coming through it is warm. Nothing down here is warm, so the gap is either the way out or the reason nobody uses it. The rock at the edges is polished smooth at chest height and rough everywhere else, which means a great many people have gone through it, and all of them going the same way.",
    asides: [
      {
        when: ["hurt"],
        text:
          "A shoulder-width gap is a different proposition with a shoulder that does not want to go first.",
      },
      {
        when: ["wet"],
        text:
          "Wet cloth in a warm gap. You will go in stiff and come out steaming, if you come out.",
      },
    ],
    options: [
      {
        id: "through",
        label: "Turn sideways and force it",
        kind: "check",
        ability: "brawn",
        tn: 12,
        vigour: 2,
        promise:
          "Rock gives before ribs do, most of the time, and you have the shoulders for it.",
        win: "You go through in a few hard shoves and come out the far side with your coat dragged along behind you.",
        lose: "You get as far as the shoulders and stop, and getting back out costs you more than getting in did, and a good deal of skin.",
        ruin: "You take a lungful of the warm air halfway through and breathe it out to make yourself thin, and the rock takes up the slack, and after that neither breathing in nor going backwards is available to you without help.",
        ruinSets: ["hurt"],
      },
      {
        id: "empty",
        label: "Put everything down and go through thin",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise:
          "Kit through the gap first, you after it. Reaching back is a problem for the far side.",
        win: "You fold through it like a letter and pull your kit after you a piece at a time, and nothing of yours stays behind.",
        lose: "You are halfway through, thin and unarmed, when you find out what the warm draught is coming off.",
        ruin: "You pass everything through ahead of you, and while you are still in the rock something lifts the lamp off the top of the pile and walks away with it, unhurried, and the light goes round the corner without you.",
        ruinSets: ["seen"],
      },
      {
        id: "hold",
        label: "Go through head first and keep going",
        kind: "check",
        ability: "nerve",
        tn: 13,
        vigour: 2,
        promise:
          "Head first and no stopping. The only bad moment in a gap is the one where you stop.",
        win: "You are out the far end before the part of you that objects has finished objecting.",
        lose: "You stop, in the rock, in the dark, with both arms pinned out in front of you, and it is a long while before you start again.",
        ruin: "You go head first into the warm and the floor is not where the gap led you to expect, and you come out onto your face down a drop you never saw, in water, in the dark.",
        ruinSets: ["wet", "hurt"],
      },
      brace(
        "widen",
        "Take the edge off it with whatever you have",
        2,
        "Loud, slow, and it works, and everything with ears gets a bearing on you.",
        "You knock a hand's width off the near side and go through easily, and every single thing in the passage behind you now knows exactly where you are.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-clerk",
    band: 1,
    title: "The Clerk",
    setup:
      "There is a desk in the passage with a man asleep at it, and the passage runs straight past him. A bell, a form on a spike, a sign saying all visitors must be recorded. The spike is thick with forms, and the top one is signed in a shaky hand and countersigned in a steady one. An inkwell sits at his elbow, a cloth under his wrist, and no lamp anywhere.",
    asides: [
      {
        when: ["seen"],
        text:
          "The form on the spike is filled in already, in a hand not yours, down as far as the time you arrived.",
      },
      {
        when: ["lit"],
        text:
          "The sign is readable now. It has been amended twice, both times to add a condition.",
      },
    ],
    options: [
      {
        id: "past",
        label: "Go past him quietly",
        kind: "check",
        ability: "deft",
        tn: 11,
        vigour: 2,
        promise:
          "He is asleep. The sign is not, and the desk sits between you and the passage.",
        win: "You are well down the passage before the desk creaks behind you, and it creaks on its own.",
        lose: "The floor by the desk is laid to creak, which is exactly what a clerk would arrange, and he is awake and reaching for the bell before you are past the corner of it.",
        ruin: "You step wide of the creaking board and put your foot straight into the gap where the flagstone was lifted to lay it, and your ankle goes, and the noise you make is a good deal worse than the bell.",
        ruinSets: ["hurt", "seen"],
      },
      {
        id: "fill",
        label: "Fill the form in and leave it on the spike",
        kind: "check",
        ability: "wits",
        tn: 12,
        vigour: 2,
        promise:
          "Give the system what it wants and the system stops caring about you.",
        win: "You put down a name, a purpose and a time of entry, none of them true, and the passage lets you through on the strength of it.",
        lose: "The form asks for something you cannot answer, and by the time you have stopped trying he is awake with the bell in his hand.",
        ruin: "The last line wants the name of whoever is to be told, and you write one down without thinking, and the pen carries on writing after you have taken your hand off it.",
        ruinSets: ["seen"],
      },
      {
        id: "wake",
        label: "Wake him and tell him you are expected",
        kind: "check",
        ability: "charm",
        tn: 13,
        vigour: 2,
        promise:
          "A man woken suddenly will believe almost anything, briefly. Be quick and be dull.",
        win: "He apologises, stamps something, hands you the counterfoil, and points you down the passage himself.",
        lose: "He is entirely awake, has been for some time, and was waiting to see which of you would speak first.",
        ruin: "You put a hand on his shoulder to wake him and he is cold, and has been cold for a long while, and the hand that comes up to take your wrist is not his and does not come from his side of the desk.",
        ruinSets: ["seen", "hurt"],
        forbids: ["seen"],
      },
      brace(
        "bell",
        "Ring the bell yourself and walk on",
        2,
        "Something comes when it is rung. You would rather be the one choosing when.",
        "You ring it and you are well past the desk by the time the answer arrives, and it follows you a long way and takes a piece of you before it turns back.",
        ["seen"],
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
      "Eleven of them stand in the long room singing the same note, and they have held it long enough to wear hollows in the floor where they stand. They stop when the door opens. None of them turns round. There is a twelfth hollow at the end of the line, worn just as deep, with nobody standing in it.",
    asides: [
      {
        when: ["seen"],
        text:
          "They break the note as you come in, all eleven at once, and take a breath they do not need.",
      },
      {
        when: ["wet"],
        text:
          "Water off you hits the hollows in the floor and the room gives every drop back doubled.",
      },
    ],
    options: [
      {
        id: "join",
        label: "Take up the note",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise:
          "Eleven of anything wants a twelfth, and that empty hollow is about my size.",
        win: "You find the note underneath theirs and hold it. They start again, and you walk the length of the room inside the sound.",
        lose: "You come in half a tone under. Eleven heads come round together, and you sing the rest of the way out walking backwards.",
        ruin: "You take a breath in the wrong place and what comes out is your own voice, saying your own name. The singing stops, and all eleven of them shuffle sideways to make room for you in the line.",
        ruinSets: ["seen"],
      },
      {
        id: "hold",
        label: "Stand in the doorway and do not move",
        kind: "check",
        ability: "nerve",
        tn: 15,
        vigour: 3,
        promise:
          "They stopped for a door opening. Give them nothing else to stop for.",
        win: "The note comes back. By the second verse you are past the last of them, and the door behind you stays open all night.",
        lose: "The silence outlasts you. Your knee goes first, and the moment you shift your weight all eleven start walking.",
        ruin: "You hold until the room has your measure, and when you break it you break it backwards, out through the door and up the whole of the passage you already paid for once.",
        forbids: ["lit"],
      },
      {
        id: "cut",
        label: "Go along the gallery above them",
        kind: "check",
        ability: "deft",
        tn: 14,
        vigour: 3,
        promise:
          "There is a ledge above them. There is always a ledge, and they never look up.",
        win: "Forty feet of eight-inch stone above eleven upturned faces, and not one chin lifts.",
        lose: "The ledge is older than it looks and it says so under your boot. You finish the crossing down on the floor, among them, walking briskly.",
        ruin: "A slab goes out from under you and you land on the singers. The note does not stop. Something in your shoulder does.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      brace(
        "through",
        "Walk down the middle of them",
        3,
        "Straight down the aisle at walking pace. Do not slow down for anybody.",
        "You reach the far door. Nobody stops you and nobody stops singing, but the note follows you up the stair, and you are aware of having left something in the room.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-scales",
    band: 2,
    title: "The Weighing Room",
    setup:
      "Brass scales the size of a cart, and a door plainly held shut by whatever sits on the light pan. The heavy pan holds what other people have already tried: a pair of boots, a helm with the strap cut, a bag of nails, and a wedding ring, which nobody parts with unless a door has had them a very long time.",
    asides: [
      {
        when: ["hurt"],
        text:
          "Whatever you put on that pan you will have to lift, and lifting is the thing you are currently worst at.",
      },
      {
        when: ["lit"],
        text:
          "You can read what is already on the heavy pan. Most of it was somebody's kit and some of it was not kit.",
      },
    ],
    options: [
      {
        id: "sum",
        label: "Work out what it wants",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise:
          "It is arithmetic with brass on it. Do the arithmetic before the door does it to you.",
        win: "Four of the small weights and one thing of your own, and the beam settles and the door swings like it was never shut.",
        lose: "You are wrong twice, and the second time the pan comes up hard enough to take the skin off your forearm.",
        ruin: "You load it in the wrong order. The heavy pan drops its whole pile across your foot and the beam comes round into your mouth on the way past.",
        ruinSets: ["hurt"],
      },
      {
        id: "hold-pan",
        label: "Hold the pan down yourself",
        kind: "check",
        ability: "brawn",
        tn: 14,
        vigour: 3,
        promise:
          "It only has to stay down long enough for me to be on the other side of it.",
        win: "You get the pan flat, wedge it with the helm and a boot, and go through the gap sideways.",
        lose: "It comes back up with your whole weight on it, which tells you something about the scales that you would rather not know.",
        ruin: "The chain above the pan parts. A cart's worth of brass comes down across the doorway, and you get your arm out from under it and very little else.",
        ruinSets: ["hurt"],
        forbids: ["wet", "hurt"],
      },
      brace(
        "give",
        "Put something of your own on it",
        3,
        "It wants weight. I am carrying weight, and I can carry less.",
        "The door opens. Whatever you set on the pan stays on the pan, and you feel the lack of it on every stair after this one.",
      ),
    ],
  },
  {
    id: "r-longdark",
    band: 2,
    title: "The Long Dark",
    setup:
      "Two hundred feet of corridor with nothing in it. There is a scorched line at shoulder height on the near wall, and any flame carried past it burns down to a blue thumbnail and stays that way until the far end. Somebody has chalked a tally on the near side of the line. Somebody has chalked a shorter tally on the far side.",
    asides: [
      {
        when: ["lit"],
        text:
          "The scorched line is at the height of the flame you are carrying. Two hundred feet of corridor, and something has measured it.",
      },
      {
        when: ["wet"],
        text:
          "Two hundred feet of nothing, soaked through, and the draught down here comes the whole way with you.",
      },
    ],
    options: [
      {
        id: "count",
        label: "Count it out with a hand on the wall",
        kind: "check",
        ability: "wits",
        tn: 14,
        vigour: 3,
        promise:
          "Straight corridor. Count the paces, keep a hand on the stone, trust the count over the ears.",
        win: "Two hundred and sixteen paces, and your hand finds the door frame exactly where you said it would, and a shuttered lamp still full in the niche beside it.",
        lose: "Somewhere in the nineties the count goes, and you spend a long while establishing which way you are facing.",
        ruin: "You come out at a door frame, and it is the one you went in by, and the tally on the near wall is where you left it. You have walked the corridor twice and neither time counted.",
        sets: ["lit"],
      },
      {
        id: "keep",
        label: "Just keep walking",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise:
          "It ends. Everything ends. Put one boot in front of the other until it does.",
        win: "You come out the far end with no idea how long it took and no interest at all in working it out.",
        lose: "Halfway along, the dark starts putting things in front of you, and you spend some of the corridor on your knees.",
        ruin: "You walk into the far wall at full stride, and then into it twice more, because by then you are certain the wall is the one behind you.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      {
        id: "listen",
        label: "Go by what you can hear",
        kind: "check",
        ability: "nerve",
        tn: 14,
        vigour: 3,
        promise:
          "Air moves at the far end. Follow the draught, and carry nothing anything can see by.",
        win: "You walk into cold air and then into a doorway, and you do not once look behind you.",
        lose: "What you are following is not the draught. You go a good way after it before the sound of it changes.",
        ruin: "It leads you to the middle of the corridor and stops there, close, at about your own height, and waits while you work out that it has been leading.",
        ruinSets: ["seen"],
        forbids: ["lit"],
      },
      brace(
        "sprint",
        "Run it flat out",
        3,
        "Straight line, nothing to hit but the far wall, and less time in here either way.",
        "You find the far wall with your shoulder and both hands. It is the right wall, and you are a long time getting your breath back against it.",
      ),
    ],
  },
  {
    id: "r-hands",
    band: 2,
    title: "The Handhold",
    setup:
      "The floor has gone. Nine iron rungs cross the gap in the wall, and the shaft beneath them goes down further than a dropped coin will report on. The rungs are worn bright on the undersides as well as the tops, which is not how a person holds a rung.",
    asides: [
      {
        when: ["wet"],
        text:
          "Nine iron rungs, and your hands are wet. Iron is generous about most things and not about that.",
      },
      {
        when: ["hurt"],
        text:
          "Nine rungs is eighteen holds, and you have one arm you would trust with your weight.",
      },
    ],
    options: [
      {
        id: "fast",
        label: "Go across fast",
        kind: "check",
        ability: "deft",
        tn: 15,
        vigour: 3,
        promise:
          "Nine rungs, no pause on any of them, and no looking at the shaft.",
        win: "Nine rungs and no stop, and whatever came up the wall for you arrives behind you and finds the ledge empty.",
        lose: "The sixth rung is loose and you learn it with your whole weight on it, hanging off one arm while the wall below gets busy.",
        ruin: "You reach for the seventh and it is not there. You catch the eighth with two fingers and the swing takes your shoulder out of its socket against the stone, loudly enough that the shaft answers.",
        ruinSets: ["hurt", "seen"],
        forbids: ["wet", "hurt"],
      },
      {
        id: "slow",
        label: "Go across strong and let them come",
        kind: "check",
        ability: "brawn",
        tn: 14,
        vigour: 3,
        promise:
          "One hand for the rung, one hand for whatever arrives. Let them come and pay for it.",
        win: "Two of them get a hand on your boot on the way across, and neither of them keeps the hand.",
        lose: "There are more hands than you have boots. You get across, and you leave some of yourself on the wall.",
        ruin: "One takes your belt instead of your boot and does not let go, and you make the rest of the crossing with it up your back, breathing on the side of your neck.",
        ruinSets: ["hurt"],
      },
      brace(
        "drop",
        "Drop into the shaft and climb out the other side",
        3,
        "Down is a way across. It is only a worse one, and it is a certain one.",
        "You come up the far wall out of the dark with your knuckles open, and a grip is still closing on your calf as you clear the lip.",
        ["hurt"],
      ),
    ],
  },
  {
    id: "r-market",
    band: 2,
    title: "The Small Market",
    setup:
      "Six stalls under the vault, lit and staffed and doing brisk trade, several floors below where anybody trades. The bread is fresh. One stallholder waves you over by name, and the woman at the next stall along is wearing a good coat that you last saw on somebody who came down here in the spring and did not come back up.",
    asides: [
      {
        when: ["lit"],
        text:
          "You are lit, so they have seen you coming. Two of the stalls stop trading and wait.",
      },
      {
        when: ["seen"],
        text:
          "The stallholder who waved is not waving at you. He is waving to somebody behind you that you cannot see.",
      },
    ],
    options: [
      {
        id: "trade",
        label: "Trade with them properly",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise:
          "It is a market. Markets have rules, and the rules are the only thing down here protecting me.",
        win: "You buy a sealed lamp, sell a knife you never liked, shake three hands, and go out of the far arch a valued customer.",
        lose: "You agree to something before you have heard the whole of it, and the paying starts while they are still smiling at you.",
        ruin: "The handshake was the contract. By the time you reach the arch the man on the next stall is laying your kit out on his boards as stock, item by item, and nobody but you finds that strange.",
        sets: ["lit"],
      },
      {
        id: "name",
        label: "Work out how it knows your name",
        kind: "check",
        ability: "wits",
        tn: 16,
        vigour: 3,
        promise:
          "Nothing down here should know that. Get a light on it and find out what does.",
        win: "It came off your own coat lining, your name stitched inside it in your mother's hand. You cut the lining out, and the market stops looking at you.",
        lose: "You find out how it knows, and the knowing costs you something you cannot put a name to afterwards.",
        ruin: "The stitching is not your mother's work and it is not old. While you are holding it up to the light, all six stallholders say your name at once, pleasantly, in your mother's voice.",
        ruinSets: ["seen"],
      },
      brace(
        "ignore",
        "Buy nothing and keep walking",
        3,
        "Do not stop, do not answer, do not look at a single stall on the way past.",
        "You are through. Six stallholders watch the whole length of you, and one follows as far as the stair and stops there, because the stair is not theirs.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-audit",
    band: 2,
    title: "The Audit",
    setup:
      "Three of them at a long table with your kit laid out on it, itemised, in the order you packed it. None of them is armed and none of them will move until you sit down. There is a fourth chair pushed in at the end of the table, with a mug in front of it, full, and gone cold a long time ago.",
    asides: [
      {
        when: ["lit"],
        text:
          "They have laid your kit out in your own lamplight, which saves them a lamp and tells you how long they have known.",
      },
      {
        when: ["hurt"],
        text:
          "One of them writes down how you are standing before she writes down anything you are carrying.",
      },
    ],
    options: [
      {
        id: "account",
        label: "Account for every item",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise:
          "I know where I got all of it. Mostly. Say it plainly and keep moving.",
        win: "You go down the list item by item, and at the end the one in the middle nods and slides the whole lot back across the table.",
        lose: "There is one thing on the list you cannot place, and they have all night for it and you do not.",
        ruin: "You account for something that is not on their list. All three write it down, and then one of them gets up and leaves the room to go and tell somebody about it.",
        ruinSets: ["seen"],
      },
      {
        id: "refuse",
        label: "Decline to be audited",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise:
          "They have no authority down here. Neither has anybody. Say so and lift the kit.",
        win: "You take your kit off the table in front of all three of them, and not one of them stands up.",
        lose: "You find out what happens when nobody stands up and the room does the standing instead.",
        ruin: "The middle one rules a line under your name in the ledger. Then the table is against the wall with you underneath it, and all three go on writing around your legs as though the room had always been that shape.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      {
        id: "cooperate",
        label: "Be their favourite person for ten minutes",
        kind: "check",
        ability: "charm",
        tn: 14,
        vigour: 3,
        promise:
          "Nobody at a table like this has ever been thanked for the work. Be the first.",
        win: "You ask about the process and you mean it, and you leave with a stamped chit and every last thing you walked in with.",
        lose: "They enjoy it, and go on enjoying it, and are still enjoying it when you work out what the ten minutes have cost you.",
        ruin: "They like you enough to keep you on. Your name goes at the top of a fresh sheet under the heading for staff, the fourth chair is pulled out, and somebody fills the mug.",
        forbids: ["seen"],
      },
      brace(
        "abandon",
        "Leave them the kit and go",
        3,
        "It is only things. I have gone on without things before.",
        "You walk out with your hands empty. The going is harder with every step, and behind you all three of them carry on writing.",
      ),
    ],
  },
  {
    id: "r-restructure",
    band: 2,
    title: "The Restructure",
    setup:
      "The passage you came down is not the passage behind you. The floor has been reorganised while you were standing in it, and a long way off you can hear more of it being reorganised. There is a chalk arrow on the wall at knee height, pointing at nothing, and a second arrow under it crossed out. Somebody has been through here more than once, and did not agree with themselves the second time.",
    asides: [
      {
        when: ["seen"],
        text:
          "The floor was reorganised while you stood in it, and it was reorganised around where you were standing.",
      },
      {
        when: ["lit"],
        text:
          "By your own light you can watch the far end of it still settling, which is worse than arriving after.",
      },
    ],
    options: [
      {
        id: "map",
        label: "Work out the pattern and get ahead of it",
        kind: "check",
        ability: "wits",
        tn: 16,
        vigour: 3,
        promise:
          "Walls on a schedule keep it. Learn the beat and the next gap opens for you.",
        win: "You count the changes twice, wait in a doorway with your back flat against it, and step through into a corridor that was not there a moment ago and is going your way.",
        lose: "The pattern is real and you are one beat behind it, and the corridor you wanted arrives somewhere on the far side of the floor with your chalk mark on it.",
        ruin: "You step into the gap on your count and your count is old. The wall closes on your shoulder and holds you there a while before it opens again and lets you drop.",
        ruinSets: ["hurt"],
      },
      {
        id: "run",
        label: "Move faster than the walls do",
        kind: "check",
        ability: "deft",
        tn: 15,
        vigour: 3,
        promise:
          "Nothing here moves fast. Be through the gaps before they have finished closing.",
        win: "You take three gaps in a row as they close and come out at the stairwell with the floor still shuffling itself behind you.",
        lose: "The fourth gap closes on its schedule rather than yours and catches your trailing foot, and you spend an undignified while working the boot back out of it.",
        ruin: "You misjudge the last one and go through it sideways into the room beyond, which is the wrong room, and which was already occupied.",
        ruinSets: ["hurt", "seen"],
        forbids: ["hurt", "wet"],
      },
      {
        id: "stand",
        label: "Stand still and let it finish",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise:
          "Stand still. It has to stop somewhere, and standing costs you nothing but patience.",
        win: "It goes quiet with you in a room that has a door in it, and the door is the one you wanted.",
        lose: "It goes quiet with you in a room with no door at all, and you wait a long cold while to be moved again.",
        ruin: "It stops with the room half made, one wall of it standing loose in the middle of the floor, and you shout for a very long time before you understand that something answered you on the first try.",
        ruinSets: ["seen"],
      },
      brace(
        "wreck",
        "Break something load-bearing and go through the hole",
        3,
        "It cannot reorganise what is not there. Take out something load bearing and go through the hole.",
        "You put a hole in the plan and go through it, and the floor above settles onto the hole and onto you on the way past. Everything on this level now knows precisely where that noise came from.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-lantern",
    band: 2,
    title: "The Lantern Keeper",
    setup:
      "One lamp in the whole gallery, and a woman sitting under it with a book open on her knees. She has been down here long enough to have a chair, and long enough to have worn a shine into the stone where she puts her feet. She says the lamp is the last one and asks what you are going to do about it. There is a page torn out of the book.",
    asides: [
      {
        unless: ["lit"],
        text:
          "Her lamp is the only light on this floor and she is under no obligation to share it.",
      },
      {
        when: ["lit"],
        text:
          "You have your own light, which changes the conversation. She marks her page and waits to hear what else you want.",
      },
    ],
    options: [
      {
        id: "share",
        label: "Offer to sit with her a while",
        kind: "check",
        ability: "charm",
        tn: 15,
        vigour: 3,
        promise:
          "She has not had company in years and it shows. Sit down and be some.",
        win: "She reads you two pages, laughs at something on the second, and cuts you a length of her spare wick and a stub to burn it in.",
        lose: "She talks. She talks for a long while about the drainage, and it is dark at the end of it and the chair is empty.",
        ruin: "Somewhere in the third hour you notice she has been reading the same page throughout, and that nothing at all has gone past in the gallery since you sat down. Something has been waiting for the pair of you to be still.",
        sets: ["lit"],
        ruinSets: ["seen"],
      },
      {
        id: "dark",
        label: "Go on into the dark without it",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise:
          "You had no lamp before you saw hers. Leave it with her and feel your way out.",
        win: "You go the length of the gallery with one hand on the wall and out through the far arch, and behind you the light never moves.",
        lose: "You lose the wall halfway and spend an ugly stretch turning on the spot, and come out at the same arch you went in by.",
        ruin: "Something takes your wrist in the dark, gently, the way you would take a child's, and walks you a good distance before you get it off you. You come out bleeding, and it comes out behind you.",
        ruinSets: ["hurt", "seen"],
        forbids: ["lit"],
      },
      {
        id: "read",
        label: "Look at what she is reading",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise:
          "A woman with one lamp is spending it on that book. Find out what is worth that.",
        win: "It is a register of everyone who came through, ruled and dated in her hand, and the last page tells you which of the three arches has been used and which two have not.",
        lose: "You have your face in it long enough for her to close it on your fingers and go back to her own beginning.",
        ruin: "You find your own name near the bottom in her handwriting, with a date beside it that has not happened yet. She looks up and asks whether you would like her to correct the spelling.",
      },
      brace(
        "take",
        "Take the lamp",
        3,
        "She is one person and it is one lamp, and you need it more than a chair does.",
        "You lift it off the hook and she lets you, and the gallery ahead comes up out of the dark in pieces. She says something as you go that you will still be turning over at the bottom.",
        ["lit"],
      ),
    ],
  },
  {
    id: "r-machine",
    band: 2,
    title: "The Works",
    setup:
      "Something enormous is running in the dark on the far side of the gallery, and it has been running so long the rock is polished where it turns. The walkway across goes over the middle of it. Halfway along, somebody has bolted a bench to the rail and left a tin cup standing on the bench, and the cup is upright and it is full.",
    asides: [
      {
        when: ["wet"],
        text:
          "Wet hands and polished rock, on something that has not stopped turning in living memory.",
      },
      {
        when: ["hurt"],
        text:
          "Whatever you do here wants timing and reach, and you have given away some of both.",
      },
    ],
    options: [
      {
        id: "time",
        label: "Time the turn and cross on the beat",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 3,
        promise:
          "It keeps a rhythm. Count the rhythm and cross on the gaps rather than on hope.",
        win: "You go over in four strides between beats, and the thing never comes closer to you than a hand's width.",
        lose: "It is regular right up until it is not, and the beat you counted on arrives early enough to put you flat on the walkway.",
        ruin: "You are mid stride when the whole rhythm changes to a different one and the walkway goes with it. You catch the rail with one arm and hang over the turn until the arm gives you its opinion.",
        ruinSets: ["hurt"],
        forbids: ["wet"],
      },
      {
        id: "stop",
        label: "Feel along it in the noise until you find the shaft",
        kind: "check",
        ability: "grit",
        tn: 15,
        vigour: 3,
        promise:
          "Hot, loud and slow. A jammed shaft is a silent gallery and an easy walk across.",
        win: "You find the shaft by feel, jam it with something you were not going to need, and cross a gallery that has gone quiet for the first time in a very long while.",
        lose: "You are still working along the housing when the heat coming off it decides how long you are staying, and you come away with your palms telling you all about it.",
        ruin: "The jam holds for a moment and then the works take it and throw it, and the gallery fills with parts going in every direction. Somewhere behind you a voice starts asking what has been done to it.",
        ruinSets: ["hurt", "seen"],
      },
      {
        id: "haul",
        label: "Go under it hand over hand",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 3,
        promise:
          "The underside is still. Hand over hand along the rail and you never touch the turn.",
        win: "You come up on the far lip with your arms burning and the whole thing revolving over your head, entirely untroubled by you.",
        lose: "Your grip goes with a third of it left and you finish the crossing in a heap on the far lip, which works, and which you feel in both shoulders.",
        ruin: "A rung comes away in your hand with the bolt still in it, and you swing on one arm over the turn for exactly as long as one arm lasts.",
        ruinSets: ["hurt"],
        forbids: ["wet", "hurt"],
      },
      brace(
        "wait",
        "Wait for it to come round and take the hit",
        3,
        "It is a machine and machines do not aim. Ride it round and step off the far side.",
        "You go across on the back of it and step off at the far lip, and it took its price out of you on the way past without ever noticing it had.",
        ["hurt"],
      ),
    ],
  },
  {
    id: "r-quota",
    band: 2,
    title: "The Quota",
    setup:
      "A door with a slot in it and a tally chalked beside the slot, and the tally is one short. Whoever is on the other side is not opening anything until the number is right. Under the slot the stone is worn smooth in a band about the width of a shoulder, and there is a bucket beside it with a lid on it, and nobody has lifted the lid in a long time.",
    asides: [
      {
        when: ["seen"],
        text:
          "The tally is one short and the chalk is fresh. Somebody counted very recently, and counted you.",
      },
      {
        when: ["hurt"],
        text:
          "You are, on the arithmetic available to whoever is behind that door, the missing one.",
      },
    ],
    options: [
      {
        id: "talk",
        label: "Talk to whoever is behind it",
        kind: "check",
        ability: "charm",
        tn: 15,
        vigour: 3,
        promise:
          "Someone in there is bored of counting. Get them talking and the door is a formality.",
        win: "You get them going about the quota, who set it and what it is like to be held to it, and somewhere in the complaining the bolts come back on their own.",
        lose: "They will not be drawn on the quota. They are extremely clear, at length, that they will not be drawn on the quota.",
        ruin: "You say the wrong thing about whoever set it and the voice stops mid word and does not come back. Further down the passage something starts moving that was not moving before.",
        ruinSets: ["seen"],
      },
      {
        id: "forge",
        label: "Add to the tally yourself",
        kind: "check",
        ability: "wits",
        tn: 14,
        vigour: 3,
        promise:
          "It is chalk on a wall. Match the hand, add the missing one, and be counted.",
        win: "You match the hand and the angle of it, add the one that was missing, and the bolts go back on the other side without a word said.",
        lose: "Your stroke sits too clean beside the others, and a hand comes out through the slot and wipes the whole tally off the wall.",
        ruin: "The tally is counted from both sides. Yours is noticed with your hand still on the wall, and the slot opens, and the thing behind it takes a long unhurried look at your face before it shuts again.",
        ruinSets: ["seen"],
      },
      {
        id: "force",
        label: "Take the door off",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 3,
        promise:
          "The quota is not your quota. Take the door off the frame and be done with it.",
        win: "It comes off in one piece, hinge and all, and whatever was counting on the other side goes quiet immediately.",
        lose: "The door holds and the frame holds and you sit down on the floor a while, and the tally is still one short.",
        ruin: "The door holds, the frame holds, and the noise of you brings the count up to date without your help. Whatever arrives to be counted arrives from behind you.",
        ruinSets: ["seen", "hurt"],
        forbids: ["hurt"],
      },
      brace(
        "make",
        "Make up the number the way they mean it",
        3,
        "You know what the missing one is meant to be. You are not going to enjoy providing it.",
        "The tally goes right, the bolts come back, and you go through carrying what it cost to make the number work. Whatever keeps the count has your measure now and will know you again.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-mirror",
    band: 2,
    title: "The Long Gallery",
    setup:
      "A gallery of the people who came down before you, standing along both walls, dressed and posed and perfectly still. They all face the way you are going. The one at the end on the left is wearing your coat, down to the mend at the cuff you made yourself last winter, and there is an empty stand beside it with the dust already brushed off the top of it.",
    asides: [
      {
        when: ["seen"],
        text:
          "They all face the way you are going, except the nearest three, who do not any more.",
      },
      {
        when: ["lit"],
        text:
          "Your light reaches their faces. They are all wearing the expression of somebody part-way through a decision.",
      },
    ],
    options: [
      {
        id: "walk",
        label: "Walk the length of it and do not stop",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 3,
        promise:
          "They are exhibits. Set a pace and hold it and be out before you think about it.",
        win: "You go the whole length at one pace, and not one of them is standing differently when you turn at the arch and look back.",
        lose: "One of them is standing differently when you look back, and you go the last of it at a speed you will not be admitting to.",
        ruin: "You look back and the empty stand has somebody on it, the coat at the end is off its hook, and the whole gallery has turned a quarter round to keep you in view.",
        ruinSets: ["seen"],
        forbids: ["lit"],
      },
      {
        id: "study",
        label: "Look at how each of them died",
        kind: "check",
        ability: "wits",
        tn: 15,
        vigour: 3,
        promise:
          "Each of these is a mistake somebody made once. Read the mistakes, skip making them.",
        win: "You read six deaths off six poses, and you know what is standing at the bottom of the stair and which hand it favours.",
        lose: "The poses tell you nothing you did not already suspect, and the reading costs you the better part of an hour standing still in the cold.",
        ruin: "You read your own off the one in your coat, the angle of the head and the set of the hands, and it is not a guess. Then it turns its head to see whether you have finished.",
        ruinSets: ["seen"],
      },
      {
        id: "coat",
        label: "Take your coat off and leave it with them",
        kind: "check",
        ability: "grit",
        tn: 14,
        vigour: 3,
        promise:
          "Give the gallery the thing it is expecting and it may not want the rest of you.",
        win: "You hang it on the empty stand at the end, and the gallery loses interest in you between one step and the next.",
        lose: "It was never the coat, and the rest of the way is cold in the way that gets into your hands and stays there.",
        ruin: "You get one arm out and the sleeve does not come. It has your wrist, and it is not the coat holding on, and you leave with the coat and without a good deal of the skin on that hand.",
        ruinSets: ["hurt"],
      },
      brace(
        "eyes",
        "Go down the middle looking at the floor",
        3,
        "You do not need to see them to get past them. Eyes on your boots, count the steps.",
        "You come out at the far arch having looked at nothing but your own boots, and the effort of not looking has taken a real piece out of you.",
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
      "A pool the width of the room, with no current in it at all. Your reflection is doing what you are doing about a half-second late, and it is not out of breath, and its coat is dry. The only door out is past the middle. On the near lip there are boot prints going in, a good many of them, and none coming back.",
    asides: [
      {
        when: ["wet"],
        text:
          "You are wet and so is the reflection, which is the first thing all day that has agreed with you.",
      },
      {
        when: ["hurt"],
        text:
          "The reflection is standing straight. Whatever it is copying, it is not copying that.",
      },
    ],
    options: [
      {
        id: "ignore",
        label: "Cross it without looking down",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 4,
        promise:
          "Straight across, eyes on the far door. It only works on you if you watch it.",
        win: "You are halfway before you hear the second set of steps keeping pace beside you, and you do not give it the satisfaction of a look.",
        lose: "You look. The half-second is gone and it is doing what you are about to do, and you finish the crossing badly and soaked to the ribs.",
        ruin: "It reaches the far lip before you and holds the door open, dry-coated and patient, and the thing wading out behind you is wearing your face slightly wrong.",
        sets: ["wet"],
        ruinSets: ["wet", "seen"],
      },
      {
        id: "solve",
        label: "Work out the delay",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 4,
        promise:
          "Half a second is a measurement. Time it against my own flame and move in the gap.",
        win: "You count the delay against your own light and cross inside it, and you are at the far door before your reflection has left the near one.",
        lose: "You are still counting when it stops being late, and you finish the sum sitting in the water with your teeth going.",
        ruin: "It goes early instead of late. It is out of the pool and past you before you have moved, and the one that steps back into the water is the one standing where you are.",
        sets: ["wet"],
        ruinSets: ["wet", "seen"],
        forbids: ["wet"],
      },
      brace(
        "wade-it",
        "Get in and wade straight across",
        4,
        "Through the middle of it, chest deep, and out the far side. Do not stop for anything.",
        "You come out the far side. Something came out with you, walked three paces, went back in, and the water closed over it without a sound.",
        ["wet"],
      ),
    ],
  },
  {
    id: "r-scriptorium",
    band: 3,
    title: "The Reading Room",
    setup:
      "Somebody has been writing down everything that comes through this floor, and the stacks go up past where the light reaches. The newest page carries your description in a hand still wet enough to smudge, and it is accurate, including the thing that happened to you further up that nobody was there to see. There is no chair at the desk.",
    asides: [
      {
        when: ["seen"],
        text:
          "The newest page is current to about a minute ago, and the hand does not shake.",
      },
      {
        when: ["lit"],
        text:
          "The stacks go up out of your light and keep going. Somebody has been very thorough for a very long time.",
      },
    ],
    options: [
      {
        id: "unwrite",
        label: "Take the page",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 4,
        promise:
          "One page out of the binding and into my coat. What is not written did not happen.",
        win: "The page comes away clean along the stitching, and the room forgets what it was in the middle of. The wet ink on the next page stops moving.",
        lose: "The binding holds, the page tears across your own name, and the ink dries while you are still standing there holding half of it.",
        ruin: "The hand writes the entry out again, faster, and this time it includes the tear, and your hand, and the fact that you are reading over its shoulder.",
        ruinSets: ["seen"],
        forbids: ["hurt"],
      },
      {
        id: "argue",
        label: "Argue with what is written",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 4,
        promise:
          "That description is of me and it is wrong in two places. Say so, out loud, twice.",
        win: "You correct it aloud, twice, and the hand crosses the whole entry out and starts on somebody who came in behind you.",
        lose: "You are less unlike the description than you claimed, and the room agrees with the page rather than with you.",
        ruin: "The hand stops recording what you have done and starts writing what you are going to do next. You read the line, and then you do it.",
      },
      brace(
        "burn",
        "Burn the book",
        4,
        "No book, no page, no description of me. It is only paper and I have a light.",
        "It goes up, and so does a good deal of the room, and you take the far stair coughing hard with a rolled page burning in your fist.",
        ["lit"],
      ),
    ],
  },
  {
    id: "r-weight",
    band: 3,
    title: "The Ceiling Comes Down",
    setup:
      "The gallery ceiling is on four props and two of them are out, lying splintered where something put them there. At the far end the stone has already come down enough to rest on the tops of the two that are left, and it creaks when you breathe. The way through is under all of it. Halfway along, in the dust, there is a boot, still laced.",
    asides: [
      {
        when: ["hurt"],
        text:
          "Two props out, and whatever you do about it is going to be done at a run you are not currently capable of.",
      },
      {
        when: ["wet"],
        text:
          "Wet boots, splintered props and a floor of loose stone. Pick where your feet go before you commit to going.",
      },
    ],
    options: [
      {
        id: "prop",
        label: "Get a new prop in",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 4,
        promise: "There is a beam on the floor and a gap it fits. Get it in.",
        win: "You walk the beam up and drop it home, and the ceiling settles onto it and stops arguing, and the dust stops coming down.",
        lose: "You take the weight on your own shoulders while you seat it, and the moment lasts longer than you have, and something in your back gives notice.",
        ruin: "The beam skids out, the prop beside it goes with it, and you get your arm clear of the drop and very little else.",
        ruinSets: ["hurt"],
      },
      {
        id: "hold-on",
        label: "Go under it and keep going",
        kind: "check",
        ability: "grit",
        tn: 17,
        vigour: 4,
        promise:
          "Flat on my elbows the whole length of it. Slow beats clever here.",
        win: "You come out at the far side with stone dust in your teeth and every limb you went in with.",
        lose: "It settles a hand's width while you are under it, and you spend a long minute pinned flat with the ceiling on your shoulders before it lets you up.",
        ruin: "You are level with the boot when the boot moves, on its own, pointing the other way now, and you are still looking at it when the whole span comes down.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      brace(
        "sprint-under",
        "Sprint it before it decides",
        4,
        "It is coming down whatever I do. The only question is whether I am under it when it does.",
        "You are through and rolling as the third prop goes, and the noise brings the far end down behind you. Most of you got out on the first attempt.",
        ["hurt"],
      ),
    ],
  },
  {
    id: "r-namegate",
    band: 3,
    title: "The Gate That Asks",
    setup:
      "A door with no handle, and a voice behind it asking one question over and over in the tone of somebody with all night. It has all night. You were asked this exact question already tonight, further up, in the same words, by something with a face, and you gave it an answer then. The voice on this side of the wood is waiting to hear whether you give the same one.",
    asides: [
      {
        when: ["seen"],
        text:
          "It stops asking when you arrive. It has the question answered and it wants to hear you say it.",
      },
      {
        unless: ["seen"],
        text:
          "It asks again, in the same tone, to a passage it has no reason to think anybody is standing in.",
      },
    ],
    options: [
      {
        id: "answer",
        label: "Answer it honestly",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 4,
        promise:
          "Say the true thing and say it once. It has heard every clever version already.",
        win: "You say the true thing out loud, and the door is open before you have finished saying it.",
        lose: "You say the true thing, and out loud it is a good deal worse than it was in your head, and the door takes its time about it.",
        ruin: "It says your answer back to you in your own voice, then again in the voice you used further up, and the gap between the two is what it was after. Now it has a name to put to you.",
        ruinSets: ["seen"],
      },
      {
        id: "lie",
        label: "Give it a better answer",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 4,
        promise:
          "It wants an answer. It never once promised to check. Give it a better one.",
        win: "It turns your answer over, decides it prefers it to the truth, and the door goes back into the wall.",
        lose: "It has heard that one, from somebody who is still down here, and it tells you so, and waits.",
        ruin: "It takes the lie, opens, and calls you by the name in it. Somewhere down the corridor something answers to that name and starts walking towards the sound.",
        ruinSets: ["seen"],
        forbids: ["seen"],
      },
      brace(
        "hinge",
        "Take the hinges off",
        4,
        "It is still a door. Doors have hinges, and hinges have pins, and I have a bar.",
        "Three pins and a bar and the whole thing comes off the frame, loud enough to wake the floor. The voice keeps asking the question the entire time, and you can still hear it asking two floors up.",
        ["seen"],
      ),
    ],
  },
  {
    id: "r-lastlight",
    band: 3,
    title: "The Last Light",
    setup:
      "One lamp in this room, on a hook, and it is not yours. It burns an oil that smells like nothing you are carrying. The moment you cross the middle of the floor it will go out, and you know that the way you know the floor is stone. Everything else about the room is fine. On the far wall there is a second hook, and it is empty.",
    asides: [
      {
        when: ["lit"],
        text:
          "You already have a light, so the hook is only a hook, and the room has to think of something else.",
      },
      {
        unless: ["lit"],
        text:
          "It is the only light in the room and you have nothing of your own to leave in its place.",
      },
    ],
    options: [
      {
        id: "map",
        label: "Learn the room before you cross it",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 4,
        promise:
          "Look at all of it once, properly, and then it does not matter what the lamp does.",
        win: "Nineteen paces, a step up, a turn to the left. You do all three in the dark without putting a hand out.",
        lose: "You had the paces and not the step, and the step has your shin, and you finish the room on your hands.",
        ruin: "You cross it exactly as you learned it, and the room you learned is not the room you are in. The step is behind you, the door is on the wrong wall, and someone is standing in the space you just walked through.",
      },
      {
        id: "carry",
        label: "Take the lamp with you",
        kind: "check",
        ability: "deft",
        tn: 16,
        vigour: 4,
        promise: "It is a lamp on a hook. I would rather owe it than leave it.",
        win: "It lifts clean off the hook and keeps burning, and you walk the only light in the room out of the room.",
        lose: "It comes off the hook and goes out in your hand, cold in a heartbeat, and the room is not fine any more.",
        ruin: "The hook comes away with it, the oil goes down your sleeve and lights, and you are putting yourself out on the stone while whatever the lamp was keeping polite crosses the floor to watch.",
        sets: ["lit"],
        ruinSets: ["hurt", "seen"],
        forbids: ["wet"],
      },
      brace(
        "dark",
        "Let it go out and feel your way",
        4,
        "I do not need to see it. I need to be on the other side of it.",
        "You get there. It takes a long time, and you find every hard edge in the room with a different part of yourself.",
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
      "It has been down here longer than the building has been up. It sits between you and the stair with its hands on its knees, patient as furniture. Beside it, chalk marks on the wall in pairs: strokes going down, strokes coming back, and the columns do not match. The going-down column is longer. It watches you find that, and waits.",
    asides: [
      {
        when: ["hurt"],
        text:
          "It looks at the way you are holding yourself, and settles slightly, like something that has decided it can wait.",
      },
      {
        when: ["seen"],
        text:
          "It was already looking at the door when you opened it.",
      },
      {
        when: ["lit"],
        text:
          "By your own light you can see what is beside it, and how long the pile has been accumulating.",
      },
    ],
    options: [
      {
        id: "fight",
        label: "Go at it",
        kind: "check",
        ability: "brawn",
        tn: 17,
        vigour: 5,
        promise:
          "It is sitting down, and nothing sitting down is set on its feet yet.",
        win: "You are on it before its weight is under it, and you do not stop until the wall has done the last of the work for you.",
        lose: "It was ready. It has been ready since before your grandmother was born, and you learn that in the first second, on your back.",
        ruin: "It takes your arm at the elbow and puts the elbow somewhere an elbow does not go, then sets you down on the flags gently, which is the worse half.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      {
        id: "bargain",
        label: "Offer it something",
        kind: "check",
        ability: "charm",
        tn: 16,
        vigour: 5,
        promise:
          "It keeps a tally of who goes down. Offer it the one thing it is missing.",
        win: "You give it a name, and the name is yours, and it chalks a stroke into the short column and moves its knees aside for you.",
        lose: "It hears you out to the end. Then it taps the wall where the columns still do not match, and does not move.",
        ruin: "You offer it somebody else's name instead. It accepts, writes the name up carefully, and somewhere above ground a person who has never been down here owes a night.",
      },
      {
        id: "outlast",
        label: "Wait it out",
        kind: "check",
        ability: "grit",
        tn: 18,
        vigour: 5,
        promise:
          "It is willing to wait. Be duller than it is. Do not blink first.",
        win: "Somewhere in the small hours it stands, knees going off like a dry chair, and walks away down a corridor. You take the stair at a walk.",
        lose: "It is better at waiting than you are. Of course it is. That is the whole of its job, and you sit back down against the cold wall.",
        ruin: "You wake with your cheek on the stone and the night gone, one leg dead to the hip, and the chalk lying by your open hand.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      brace(
        "past-it",
        "Go past it and up",
        5,
        "The stair is a few strides past it. Take them and do not look at what takes hold.",
        "You reach the stair. It had a hand in the back of your coat for part of the way, and it let go of its own accord, which you will think about later.",
      ),
    ],
  },
  {
    id: "b-thing-in-the-well",
    band: 3,
    boss: true,
    title: "The Thing in the Well",
    setup:
      "The stair up runs round the inside of a well shaft, bolted to the wall, and the shaft is not empty, and it has the whole climb to reach you. You can see as far as the first turn and no further. At eye height somebody has scratched a word into the wet stone and got partway through the second letter before they stopped scratching.",
    asides: [
      {
        when: ["wet"],
        text:
          "The climb is bolted iron and your hands are wet, and it has the whole shaft to come up.",
      },
      {
        when: ["lit"],
        text:
          "Your light goes down the shaft a good way. You would rather it had not.",
      },
    ],
    options: [
      {
        id: "climb",
        label: "Climb it fast",
        kind: "check",
        ability: "deft",
        tn: 17,
        vigour: 5,
        promise:
          "It has to come all the way up. You only have to go. Take the head start.",
        win: "You go up taking the steps in stride after stride, round turn after turn, and come out into grey light with your own breathing the loudest thing in it.",
        lose: "It is quicker in its own shaft than anything with that much of it has a right to be, and it has your boot before the halfway.",
        ruin: "A bolt comes out of the wall in your hand and you go back down the ironwork the fast way, and you land on the shoulder you needed.",
        ruinSets: ["hurt"],
        forbids: ["wet"],
      },
      {
        id: "stare",
        label: "Look down at it and go up steadily",
        kind: "check",
        ability: "nerve",
        tn: 18,
        vigour: 5,
        promise:
          "It wants you running. Keep your eyes on it and climb as though these are only stairs.",
        win: "You watch it the whole way up and it never quite commits, and the grey gets bigger behind your shoulders until it is daylight.",
        lose: "You look a moment too long and see how the parts of it agree with one another, and your legs make the decision without asking you.",
        ruin: "You hold its eye and it holds yours, and it is still holding yours when you understand that you have stopped climbing and come back down several steps to be nearer.",
        ruinSets: ["seen"],
        forbids: ["seen"],
      },
      {
        id: "collapse",
        label: "Bring the stair down behind you",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 5,
        promise:
          "The stair is bolted to the shaft in a few places, and only a couple are holding.",
        win: "A long run of stair goes into the dark with it somewhere underneath, and you finish the climb on the bare bolts with your fingers in the mortar.",
        lose: "You pull the wrong bolts and the stair sags without dropping, and from there every single step is a question you have to ask.",
        ruin: "The section that goes is the one under your boots, and you come up the rest of the shaft soaked to the chest with something keeping pace beside you.",
        ruinSets: ["wet", "hurt"],
      },
      brace(
        "run-up",
        "Just run up",
        5,
        "Up. All of it, without looking into the middle. Legs, and nothing else.",
        "You come out into the air on your hands and knees. Something let go of your ankle near the top, and it let go because it chose to.",
      ),
    ],
  },
  {
    id: "b-court",
    band: 3,
    boss: true,
    title: "The Court in Session",
    setup:
      "Nine of them behind a long table, and a chair on your side of it, and a clerk who asks you politely to sit. The door you came in by is not in the wall any more. The chair has been sat in a great deal: the arms are worn pale and the front legs are scuffed backwards, as though whoever sat there kept trying to stand up.",
    asides: [
      {
        when: ["seen"],
        text:
          "There is a file open in front of the clerk and it is not thin.",
      },
      {
        when: ["hurt"],
        text:
          "One of the nine writes for some time after looking at you, and does not look up again.",
      },
    ],
    options: [
      {
        id: "plead",
        label: "Take the chair and answer them",
        kind: "check",
        ability: "charm",
        tn: 17,
        vigour: 5,
        promise:
          "It calls itself a court. A court has to hear you before it can rule.",
        win: "You answer their questions in the order asked and none of them twice, and the clerk opens a door in a wall that did not have one.",
        lose: "You answer nearly all of it well. The one you fumble is the one they came in intending to ask, and they let you hear them write it down.",
        ruin: "You correct one of them on a date. The whole bench writes that down, the clerk asks whether you would care to swear to it, and by the time you understand what you have sworn to they have your hand pressed flat on the table.",
        ruinSets: ["hurt"],
        forbids: ["wet"],
      },
      {
        id: "procedure",
        label: "Find the fault in the procedure",
        kind: "check",
        ability: "wits",
        tn: 18,
        vigour: 5,
        promise:
          "Nine of them, and no witness, and nobody keeping the minutes. That is not a court.",
        win: "You say the word convened and every one of them has to look down at the table, and you are through the clerk's door while they are still looking.",
        lose: "There is no fault in it. It has been sitting a very long time and it has heard every objection you have, and heard it better put.",
        ruin: "You find the fault, and the fault is that the bench is short of a member, and every face at the table turns to the empty chair on your side of it.",
      },
      {
        id: "refuse",
        label: "Refuse to sit",
        kind: "check",
        ability: "nerve",
        tn: 17,
        vigour: 5,
        promise:
          "Nothing they do works until you sit. So stand, and go on standing.",
        win: "You stand until the candles are stubs. The clerk sighs, stamps something, and shows you out, because none of it functions with you upright.",
        lose: "You stand a long while and then your knees go, and the chair is right there, and it is warmer than the floor was.",
        ruin: "You stand so long that you lock, and when they finally lift you into the chair you find you cannot tell them you did not sit down willingly.",
        ruinSets: ["hurt"],
        forbids: ["hurt"],
      },
      brace(
        "table",
        "Go over the table",
        5,
        "Nine of them, one of you, and one door behind them. Straight over the top.",
        "You are over the table and through and out. Several hands got to you crossing it and one of them kept a button, and they will file the button.",
      ),
    ],
  },
  {
    id: "b-hoard",
    band: 3,
    boss: true,
    title: "What the Hoard Is Sitting On",
    setup:
      "There it is, all of it, heaped the size of a cart, and the heap breathes: slowly, with a long empty wait between one breath and the next, and it has not noticed you. Near your boot there is a print in the dust, pointing at the heap. It is the only print, and there is nothing at all leading away from it.",
    asides: [
      {
        when: ["lit"],
        text:
          "Your light reaches the far side of the heap. The breathing is not coming from the middle of it.",
      },
      {
        when: ["wet"],
        text:
          "Water off you goes into the heap and does not come back out, and the wait between breaths shortens.",
      },
    ],
    options: [
      {
        id: "lift",
        label: "Take what you can carry and go",
        kind: "check",
        ability: "deft",
        tn: 18,
        vigour: 5,
        promise:
          "A breath is a long time if you only use the start of it. In, and out.",
        win: "Both hands full and back out inside a single breath, and the heap breathes again behind you having missed the entire business.",
        lose: "A coin goes off the top of the heap and rings on the stone like a dropped plate, and the wait between breaths ends early.",
        ruin: "Your hand closes on something that is not coin and is warm, and the heap opens an eye a hand's width from your face and takes its time about it.",
        ruinSets: ["seen", "hurt"],
        forbids: ["wet"],
      },
      {
        id: "wake",
        label: "Wake it and settle this",
        kind: "check",
        ability: "brawn",
        tn: 17,
        vigour: 5,
        promise:
          "It is asleep on its back with everything soft turned upwards. It will never be worse placed.",
        win: "You get in early and stay in close, and the whole thing is finished while it is still working out which way up the room has gone.",
        lose: "It comes off the heap far faster than a thing that size ought to manage, and you spend the rest of it going backwards over loose coin.",
        ruin: "It does not wake and fight. It wakes and calls, once, down a corridor you have not been along, and something a good way off answers in the same voice.",
        ruinSets: ["seen"],
        forbids: ["hurt"],
      },
      {
        id: "leave-it",
        label: "Leave every bit of it and walk out",
        kind: "check",
        ability: "nerve",
        tn: 16,
        vigour: 5,
        promise:
          "It is a great deal of money. It is not the only money in the world.",
        win: "You walk out with your hands empty and your hands steady, and you will think about this heap for years, from somewhere warm, with all your fingers.",
        lose: "You get most of the way to the stair before you turn round for a last look, and the look costs you the whole walk back.",
        ruin: "You take one thing on the way past, only the one, and it is the piece with the chain on it, and the chain runs back into the heap.",
        ruinSets: ["seen"],
      },
      brace(
        "grab",
        "Grab an armful and run",
        5,
        "No plan. Arms wide, take an armful, and be up the stair before the next breath.",
        "You are up the stair with more than you can hold, shedding some of it at every turn, and it is awake behind you and it lets you go with what is left.",
      ),
    ],
  },
  {
    id: "b-door-out",
    band: 3,
    boss: true,
    title: "The Door You Came In By",
    setup:
      "You have come the whole way round, and here is the door you came in by, from the inside, and it is barred. On your side, which is the wrong side for a bar, and you did not bar it. The oak is scarred all round the bracket. On the floor beneath the door there are scratches, fresh ones, and they run in the direction of the room behind you.",
    asides: [
      {
        when: ["hurt"],
        text:
          "Barred from the wrong side again, and the arm that failed you at the first door has not improved.",
      },
      {
        when: ["seen"],
        text:
          "Something is coming up the passage behind you at a walk, in no particular hurry, because it knows about the bar.",
      },
    ],
    options: [
      {
        id: "unbar",
        label: "Take the bar off",
        kind: "check",
        ability: "brawn",
        tn: 16,
        vigour: 5,
        promise:
          "A bar in its brackets is a solved problem. Get a shoulder under it and lift.",
        win: "It comes up out of the brackets grudgingly, and the door swings, and the outside air is the best thing that has happened all night.",
        lose: "It is not resting in the brackets, it has grown into them, and it takes the skin off both palms declining to discuss it.",
        ruin: "The bar comes away all at once and the door swings inward, onto a passage of bare earth going down, and it bangs off the stone loud enough to tell the whole floor where you are standing.",
        ruinSets: ["seen"],
      },
      {
        id: "who",
        label: "Work out who barred it",
        kind: "check",
        ability: "wits",
        tn: 17,
        vigour: 5,
        promise:
          "Bring the light down to the floor. Whoever set that bar left the print.",
        win: "A single set of prints in the dust, going in and never coming out, smaller than yours and bare. You know what is behind you before it moves, and you are already turned round waiting for it.",
        lose: "You read the floor and learn only that somebody stood here a long while deciding something, which you had rather assumed.",
        ruin: "You get the light down low and the prints are yours, both directions, laid over each other more times than one night allows, and the freshest are still filling in.",
      },
      {
        id: "hold-out",
        label: "Sit down with your back to it until morning",
        kind: "check",
        ability: "grit",
        tn: 18,
        vigour: 5,
        promise:
          "Somebody lifts this bar in the morning. Be sitting against it when they do.",
        win: "A whole night with your back against the wood. You do not sleep and you do not move, and at first light the bar goes up from outside and a face you have never seen finds you.",
        lose: "A night is a long time to sit with your back to a room like that one, and you stand up in the morning older than you sat down.",
        ruin: "You do not move all night and neither does the room, and at first light the bar lifts from the outside and there is nobody out there holding it.",
        ruinSets: ["seen"],
        forbids: ["seen"],
      },
      brace(
        "window",
        "Go out through the wall beside it",
        5,
        "The door is the argument. The wall beside it is only render and rubble.",
        "You come out through the render into the yard with your knuckles opened and your ears ringing, and the door stays barred behind you, which is somebody else's problem now.",
      ),
    ],
  },
];

/**
 * WHY YOU CAME DOWN, and what it means if you get back up.
 *
 * The descent had no frame at all. You picked a Calling, pressed "Go down", met
 * six rooms and stopped, and because the rooms are dealt blind from three bands
 * none of them could refer to any of the others. Adam, on his third run: "there
 * is no connection to the floor before, it does not feel like I am exploring a
 * dungeon at all, it is like 6 unconnected random events are happening to me."
 *
 * The asides fixed the join between floors. This is the other half: a run needs
 * a reason at the top and the reason needs paying at the bottom, or the bottom is
 * just where the floors stopped.
 *
 * Written so `hook` never contradicts a dealt room. It says why YOU are here,
 * which is the one thing about the night no shuffle can argue with, and `paid`
 * only ever lands when somebody actually walked out.
 */
export type Premise = { hook: string; paid: string };

export const PREMISES: readonly Premise[] = [
  {
    hook: "Your brother went down with a survey party in the spring and the party came back one short. Nobody at the top will say which one, which is its own answer.",
    paid: "You did not find him. You found the survey, filed, complete, with the party listed at full strength, and now you know who is lying.",
  },
  {
    hook: "The Hall paid you a third up front, which is more than the job is worth and much less than it will cost. The other two thirds are conditional on you coming back.",
    paid: "You came back, so the rest is owed. Whether the Hall pays a person who has seen the bottom floor is a separate question, and one they will have thought about.",
  },
  {
    hook: "It has been raining for eleven days and the lower town has started coming apart, and everybody agrees this is because something is blocked underneath.",
    paid: "It was blocked. It is not now, and you are the reason, and the water you let past has gone somewhere you did not stay long enough to see.",
  },
  {
    hook: "Somebody has been bringing gear down here for years and writing it up in a good clear hand. The hand belongs to a person, and the person has never been up.",
    paid: "You have their ledger. Every page is dated, every entry is somebody, and the last entry was written this morning.",
  },
  {
    hook: "A door at the bottom has been barred from the inside since before the building above it was finished, and the Hall would like to know by whom.",
    paid: "You know by whom. You are not going to be able to prove it, and the people who sent you down are going to want proof.",
  },
  {
    hook: "The take is meant to be split four ways. Two of the four did not turn up at the meeting point and the fourth has been talking to somebody else about the route.",
    paid: "The whole take is yours because nobody else is coming up to argue about the split, and that is not the same as winning the argument.",
  },
  {
    hook: "You have been down before. You did not get far, you did not tell anybody how badly, and something on the third floor has been expecting you since.",
    paid: "It was still there. It recognised you, which is the part you will be thinking about for a while.",
  },
  {
    hook: "There is a rent due at the end of the week and the sum is not a sum you can earn above ground in a week.",
    paid: "The rent is paid, several times over, and the man who set it will want to know where it came from.",
  },
];

export const DEEP_ROOMS: RoomDef[] = [...BAND_1, ...BAND_2, ...BAND_3];
export const DEEP_BOSSES: RoomDef[] = BOSSES;
