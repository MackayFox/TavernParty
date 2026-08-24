/**
 * The twenty Hooks. The most load-bearing content in the game, because a Hook is
 * the only place a player's own history reaches into everybody else's night.
 *
 * Three constraints shaped the set, in this order.
 *
 * One insert per tag. There are twenty tags and twenty Hooks, and the inserts are
 * a permutation of the whole vocabulary, so no tag in tags.ts can ever be dead
 * content and a full table of six guarantees six different problems in a
 * five-scene deck. It also means the generator's greedy satisfier is being asked
 * for a spread rather than a pile-up.
 *
 * Five Hooks call their own insert tag. Those are the reliable ones: your past
 * follows you around, your fuel arrives on the schedule you set, and the table
 * can see you doing it. The other fifteen split, because a background that
 * inserts one problem and is paid by a different one is a better bet to hold: you
 * put a fire in the deck and get paid where things have already burnt, you cut a
 * second key and get paid when somebody else is stealing. The split ones are
 * riskier and read better, so the safe five are deliberately the plainer pasts.
 *
 * And every Hook is a specific thing done, or done to you, with what it left.
 * Never a mood. The test is whether the other four players form an opinion about
 * the person from one line, because at the top of an Act they will see the Mark
 * and have to decide who ought to be going through that door. "A mysterious past"
 * gives them nothing to decide with. "You cut a second key and never asked who
 * wanted it" does.
 */
import type { Hook } from "@/lib/game/types";
import type { Tag } from "@/lib/content/tags";

/** Local only, so a mistyped tag fails here rather than in a runtime test. */
type HookSpec = Omit<Hook, "insertTag" | "callTag"> & {
  insertTag: Tag;
  callTag: Tag;
};

export const HOOKS: Hook[] = [
  {
    id: "signed-for-a-friend",
    name: "Signed for a Friend",
    blurb: "You put your name to somebody else's loan, and he was gone by spring.",
    insertTag: "debt",
    callTag: "debt",
  },
  {
    id: "left-the-column",
    name: "Left the Column",
    blurb: "You walked away from a marching company at night, and nobody has posted it yet.",
    insertTag: "patrol",
    callTag: "oath",
  },
  {
    id: "the-word-in-the-market",
    name: "The Word in the Market",
    blurb: "You said the well was fouled, loudly, and the square emptied in four minutes.",
    insertTag: "crowd",
    callTag: "crowd",
  },
  {
    id: "the-deep-seam",
    name: "The Deep Seam",
    blurb: "You cut stone below the waterline for eighteen months and came up thinner.",
    insertTag: "dark",
    callTag: "vermin",
  },
  {
    id: "off-the-bell-tower",
    name: "Off the Bell Tower",
    blurb: "You dressed lead on temple roofs until a bracket went, and the hip never set right.",
    insertTag: "height",
    callTag: "clergy",
  },
  {
    id: "nine-years-on-the-crossing",
    name: "Nine Years on the Crossing",
    blurb: "You worked a rope ferry for nine winters and landed whatever the river gave back.",
    insertTag: "water",
    callTag: "corpse",
  },
  {
    id: "the-lamp-left-lit",
    name: "The Lamp Left Lit",
    blurb: "You were the apprentice who did not go back down to check, and eleven houses burned.",
    insertTag: "fire",
    callTag: "ruins",
  },
  {
    id: "paid-by-the-tail",
    name: "Paid by the Tail",
    blurb: "Four years clearing cellars at a penny a tail, and you got very good at it.",
    insertTag: "vermin",
    callTag: "trade",
  },
  {
    id: "two-keys",
    name: "Two Keys",
    blurb: "You cut a second key for a client's strongroom and never asked who wanted it.",
    insertTag: "lock",
    callTag: "thief",
  },
  {
    id: "the-pit",
    name: "The Pit",
    blurb: "You fed the thing behind the hatch twice a day for two years, then somebody left the gate.",
    insertTag: "beast",
    callTag: "beast",
  },
  {
    id: "left-the-order",
    name: "Left the Order",
    blurb: "Six years a novice, and you went out by the kitchen door on the morning of your vows.",
    insertTag: "clergy",
    callTag: "uncanny",
  },
  {
    id: "below-stairs",
    name: "Below Stairs",
    blurb: "You carried coal up the back stair of a great house, and dusted its ledgers on the way.",
    insertTag: "gentry",
    callTag: "debt",
  },
  {
    id: "the-lookout",
    name: "The Lookout",
    blurb: "You whistled once when the lamp came round, and the other three went to the rope.",
    insertTag: "thief",
    callTag: "patrol",
  },
  {
    id: "behind-the-bar",
    name: "Behind the Bar",
    blurb: "Eleven years pulling drink, which is eleven years of watching rooms turn.",
    insertTag: "drink",
    callTag: "drink",
  },
  {
    id: "the-frozen-sound",
    name: "The Frozen Sound",
    blurb: "You crossed the ice in thaw wearing a coat its owner had stopped needing.",
    insertTag: "cold",
    callTag: "water",
  },
  {
    id: "course-by-course",
    name: "Course by Course",
    blurb: "You sold an unclaimed tower to the lime burners over one summer, standing on the rest of it.",
    insertTag: "ruins",
    callTag: "height",
  },
  {
    id: "came-back",
    name: "Came Back",
    blurb: "You went into the fen at fourteen for eels and came out three days later, dry, on the far side.",
    insertTag: "uncanny",
    callTag: "dark",
  },
  {
    id: "the-quiet-burial",
    name: "The Quiet Burial",
    blurb: "A house sent for you at night, paid in coin with the stamps filed off, and you dug.",
    insertTag: "corpse",
    callTag: "gentry",
  },
  {
    id: "the-standing-oath",
    name: "The Standing Oath",
    blurb: "You swore it out loud in front of forty people, and you have not broken it yet.",
    insertTag: "oath",
    callTag: "oath",
  },
  {
    id: "bonded-factor",
    name: "Bonded Factor",
    blurb: "You weighed and priced cargo you never owned, and they took the seal but forgot the keys.",
    insertTag: "trade",
    callTag: "lock",
  },
] satisfies HookSpec[];

/**
 * The prose that has to sell the choice. Two or three sentences, and the last one
 * usually names the person who still remembers, because that is the one who turns
 * up in the deck.
 */
export const HOOK_DETAIL: Record<string, string> = {
  "signed-for-a-friend":
    "Harl wanted forty marks and a name the house would accept, and yours was good. He was over the water before the first payment came due, and the paper still carries your hand on it. It is a distinctive hand, apparently. People keep recognising it.",
  "left-the-column":
    "You went out for water at Nettle Ford and did not come back to the fire. Nobody has posted your name, because a company that admits it lost one man admits it lost more. But sergeants talk, and there are always more sergeants on a road than you plan for.",
  "the-word-in-the-market":
    "You said the well was fouled, twice, to the right two people. It was not fouled, but the square was bare in four minutes and the stall you wanted stood unattended. You have never got over how easy it was, and neither have the forty people who were standing there.",
  "the-deep-seam":
    "Eighteen months cutting stone under the waterline, in a light you could carry in one hand. You stopped needing the lamp well before you stopped needing the wage. What you kept is not courage, it is always knowing how much rock is over you, and how much of it is moving.",
  "off-the-bell-tower":
    "You dressed lead on temple roofs, forty feet up on a plank, and the bracket that went was one you had reported twice in writing. The fall took most of the hip and all of the trade. The priest who signed that work order still owes you a season's pay, and knows the figure to the penny.",
  "nine-years-on-the-crossing":
    "Nine winters on the rope ferry at Sallow Reach, hand over hand, in weather nobody chose. You learned what the river takes and, more usefully, where it puts things down again. Every family in that valley knows which of them you carried up the bank, and not one of them says thank you.",
  "the-lamp-left-lit":
    "You were fifteen, it was cold, and you did not go back down to the workshop to check. Eleven houses. Nobody died, which people say as though it settles the matter. You can still tell by the smell of a room whether it would go up quickly.",
  "paid-by-the-tail":
    "A penny a tail, cellars and granaries, four years of it. You got fast, then you got clever, and by the end you were paid to arrive rather than to finish. Knowing that a body has a going rate is not a thing you can put back.",
  "two-keys":
    "The merchant wanted one key for his strongroom. You cut two and billed for one, because you wanted to know who would come asking. Somebody came, and they have it still, and you can draw those wards from memory on a wet table.",
  "the-pit":
    "Two years feeding it through a hatch too small for its head, twice a day, on somebody else's coin. You gave it a name, which was the mistake. The night the gate was left open it went straight past you, which is either affection or arithmetic, and you have never settled which.",
  "left-the-order":
    "Six years a novice and you were to be sworn at first light. Something in the undercroft answered your recital, which was not the arrangement, and you left by the kitchen door with a candle that was not yours. They rang the bell for you for a long while after.",
  "below-stairs":
    "You carried coal up the back stair of a house whose family never learned your name, and dusted the ledgers on the landing while you got your breath. Nobody had checked whether you could read. You know what they owe, what they moved, and which son signs for it.",
  "the-lookout":
    "You stood at the corner with a hand flat on the wall and whistled once when the lamp came round. It came round early. Three of them went to the rope and you went home, and you have thought about that whistle every day since. The same watch still works that street.",
  "behind-the-bar":
    "Eleven years pulling drink at the Bent Nail, which is not eleven years of drinking, it is eleven years of watching. You know the minute a room turns, usually before the room does. You lost the lease to a cousin and left the good tankards behind out of spite.",
  "the-frozen-sound":
    "You crossed in thaw because waiting cost money you did not have, and you went over in a coat whose owner had stopped needing it. You and the dog got across. It is the noise the ice made that stayed with you, not the man.",
  "course-by-course":
    "The lime burners paid by weight and there was a tower nobody would claim. You took the top off it over one summer, standing each morning on the part you had not yet sold. It is shorter now and still standing, and you are the one people send up ladders, because you have never once looked down.",
  "came-back":
    "You went into the fen at fourteen, in the evening, for eels. You came out three days later on the far side, dry, without the basket, and with nothing to say about the middle of it. Your mother had already been spoken to at the graveside, and she never entirely took it back.",
  "the-quiet-burial":
    "A house sent a boy for you at night and paid in coin with the stamps filed off. You dug, you filled it in, and you did not look at the ring. You could describe that ring perfectly, and so could they, which is the difficulty.",
  "the-standing-oath":
    "You said it out loud, in a barn, in front of forty people who had been drinking and one who had not. You have kept it twice at real cost. The trouble with a promise made in public is that it stops being yours and belongs to whoever was listening.",
  "bonded-factor":
    "You weighed, graded and priced other people's cargo for a bonded house, and signed for a great deal you never owned a nail of. When they let you go they took the seal and forgot the keys. Three warehouses on the cut still open for you, which is a fact you have not yet decided what to do with.",
};
