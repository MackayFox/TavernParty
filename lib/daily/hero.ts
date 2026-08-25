"use client";

/**
 * THE RUNNER. One character, kept, across every night you go down.
 *
 * A D&D player played the Deep Run and said the character building was
 * underwhelming: a few choices from a short list, and then you throw the character
 * away within minutes. He is right about the throwing away. What he asked for next
 * was a wide array of races and classes and a character who grows, and most of
 * that cannot be built here. The reason is worth stating in the file rather than
 * in a document nobody opens:
 *
 *   A DAILY HAS TO BE THE SAME PUZZLE FOR EVERYBODY or "two under par" means
 *   nothing. Par is computed by enumerating every character the settings allow and
 *   solving each one exactly. Every new axis of choice multiplies that: ancestry
 *   times backstory is 96 times the work, and the measured solve at the caps is
 *   225 to 811 milliseconds, so 96 times it is 21 to 78 seconds for a builder that
 *   recomputes while somebody is typing. And a character who grows STRONGER is not
 *   playing my puzzle any more, which is the end of a shared score.
 *
 * So this accumulates history and disfigurement, and never strength. Not as a
 * consolation prize: attachment in a roguelike comes from what happened to a
 * character, and what happened here is already written down. Every door in the
 * game has a `lose` line composed as a wound ("you take the corner of the wall
 * with your shoulder"), and the gate refuses to publish an authored door with a
 * blank one, so a scar is a sentence this game already owns. No new content, and it
 * works for somebody else's dungeon on the day they publish it.
 *
 * IT NEVER GOES ON THE WIRE, and that is the load-bearing decision rather than a
 * privacy flourish. The name, the ancestry and the backstory are client state that
 * no route ever receives, so `validBuild` gains no case, there is no new thing to
 * distrust, and the promise that par describes the puzzle everybody is playing is
 * kept by absence rather than by an argument. There is a test that no route imports
 * this file.
 *
 * ponytail: localStorage, so it is per browser. Safari purges script-writable
 * storage after seven days idle, so the symptom when this is not enough will be
 * "the site forgot my runner" rather than "I want it on my phone too". Move it to
 * a table when the first person says that.
 */
import { BLOODS } from "@/lib/content/bloods";
import { HOOKS } from "@/lib/content/hooks";

const KEY = "tp_hero";

export type Night = {
  /** The date played, or a dungeon code for somebody else's. */
  on: string;
  label: string;
  callingId: string;
  score: number;
  par: number | null;
  out: boolean;
  floors: number;
  reached: number;
};

export type Scar = {
  /** The room that did it, so the sentence can be traced back. */
  where: string;
  /** The authored `lose` line, verbatim. Never generated. */
  line: string;
  on: string;
};

export type Hero = {
  name: string;
  bloodId: string;
  hookId: string;
  born: string;
  nights: Night[];
  scars: Scar[];
};

/** How much of a life to keep. Enough to feel long, small enough to stay a string. */
const KEEP_NIGHTS = 60;
const KEEP_SCARS = 40;

function read(): Hero | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Hero>;
    if (typeof parsed?.name !== "string") return null;
    return {
      name: parsed.name,
      bloodId: typeof parsed.bloodId === "string" ? parsed.bloodId : BLOODS[0].id,
      hookId: typeof parsed.hookId === "string" ? parsed.hookId : HOOKS[0].id,
      born: typeof parsed.born === "string" ? parsed.born : "",
      nights: Array.isArray(parsed.nights) ? (parsed.nights as Night[]) : [],
      scars: Array.isArray(parsed.scars) ? (parsed.scars as Scar[]) : [],
    };
  } catch {
    // Blocked, full, or somebody has been editing it by hand. A runner nobody can
    // read is the same as not having one, and is not worth an error.
    return null;
  }
}

function write(hero: Hero): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(hero));
  } catch {
    /* nothing to do about a full or blocked store, and nothing worth saying */
  }
}

export function readHero(): Hero | null {
  return read();
}

/**
 * Make one. The name is theirs; the ancestry is dealt.
 *
 * DEALT, not chosen, and that is not laziness either. The party game deals Blood
 * and `/characters/origins` ships a public section headed "Why these are dealt",
 * so offering it as a menu here would have a live page arguing with a live screen.
 * The backstory IS chosen, from all twenty, because that is the half a person
 * wants to decide and it costs the solver nothing.
 */
export function createHero(name: string, hookId: string, dealt: number): Hero {
  const blood = BLOODS[Math.abs(dealt) % BLOODS.length];
  const hook = HOOKS.find((h) => h.id === hookId) ?? HOOKS[0];
  const hero: Hero = {
    name: name.trim().slice(0, 24) || "NOBODY",
    bloodId: blood.id,
    hookId: hook.id,
    born: new Date().toISOString().slice(0, 10),
    nights: [],
    scars: [],
  };
  write(hero);
  return hero;
}

export function forgetHero(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* as above */
  }
}

/**
 * Write one night into the ledger.
 *
 * ARCHIVE RUNS ARE NOT NIGHTS. `lib/daily/local.ts` already records archive play
 * separately and on purpose, because the archive is explicitly practice: you have
 * already seen those dice. A ledger that counted them would let "eleven nights
 * down" be built entirely on the one path this codebase has already conceded does
 * not count.
 */
export function recordNight(night: Night, scars: Scar[]): Hero | null {
  const hero = read();
  if (!hero) return null;
  const next: Hero = {
    ...hero,
    nights: [...hero.nights, night].slice(-KEEP_NIGHTS),
    scars: [...hero.scars, ...scars].slice(-KEEP_SCARS),
  };
  write(next);
  return next;
}

/** What the ledger adds up to. Counts, never levels. */
export function tally(hero: Hero): {
  nights: number;
  out: number;
  best: number | null;
  deepest: number;
} {
  const nights = hero.nights.length;
  const out = hero.nights.filter((n) => n.out).length;
  const best = nights === 0 ? null : Math.max(...hero.nights.map((n) => n.score));
  const deepest = nights === 0 ? 0 : Math.max(...hero.nights.map((n) => n.reached));
  return { nights, out, best, deepest };
}

/**
 * One line, for above the build screen and for the share text.
 *
 * "MAERD, Ashkin. Eleven nights down, six out alive. Best 51." A number of nights
 * is not a level: it says how long somebody has been doing this, which is the thing
 * a person is actually attached to.
 */
export function oneLine(hero: Hero): string {
  const { nights, out, best } = tally(hero);
  const blood = BLOODS.find((b) => b.id === hero.bloodId)?.name ?? "";
  const who = blood ? `${hero.name}, ${blood}` : hero.name;
  if (nights === 0) return `${who}. First night.`;
  const runs = nights === 1 ? "One night down" : `${nights} nights down`;
  const alive = out === 0 ? "never come back up" : `${out} out alive`;
  return `${who}. ${runs}, ${alive}.${best !== null ? ` Best ${best}.` : ""}`;
}
