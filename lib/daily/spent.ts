/**
 * HOW MANY CHECKS SOMEBODY HAS SPENT, kept where they cannot edit it. Server only.
 *
 * THE HOLE THIS CLOSES. The Ledger gives you three checks, and each one answers
 * "how many of your five rows are right". The count of checks spent came from the
 * request body, with a `ponytail:` note arguing it was cosmetic in the way that
 * Wordle cannot stop you opening a second tab, and that the hourly rate limit was
 * the real protection because enumerating all 120 arrangements would take 120
 * requests.
 *
 * That arithmetic was wrong by a factor of twenty-four, and the note is why nobody
 * looked again. `correctRows` is not a yes or no, it is a FITNESS SCORE, so you do
 * not enumerate: you filter. Somebody demonstrated it in five requests, every one
 * of them claiming three checks already spent, and then closed the ledger claiming
 * zero and was told "balanced first time, without a single check" with a score
 * identical to an honest solve.
 *
 * So the count lives in a signed cookie now. That is not a session and not a
 * database: it is the same HMAC the guest identity already uses, over a value the
 * player is welcome to read and cannot forge. Clearing cookies resets it, and that
 * is fine, because clearing cookies also loses the streak and the runner. The
 * point is not to make cheating impossible, it is to stop the honest score and the
 * cheated score being the same number.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { DailyGame } from "./core";

const COOKIE = "tp_spent";
/** The finished-and-scored record. Same signing, different jar entry. */
const DONE_COOKIE = "tp_banked";
/** Anything older is a different day's puzzle and starts again at zero. */
const MAX_AGE_SECONDS = 60 * 60 * 36;

function secret(): string {
  const value = process.env.GUEST_COOKIE_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    // Same rule as identity: the dev fallback is in the repo, so production must
    // not sign anything with it. instrumentation.ts refuses to boot without it.
    throw new Error("GUEST_COOKIE_SECRET must be set in production.");
  }
  return "tavern-party-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** `game:date:count`, signed. Readable by anybody, forgeable by nobody. */
function encode(game: DailyGame, date: string, count: number): string {
  const payload = `${game}:${date}:${count}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a signed `game:date:number` and give back the number, or null.
 *
 * NULL AND ZERO ARE DIFFERENT ANSWERS, which is why this is separate from
 * `decode`. For the spend count they mean the same thing and folding them
 * together was right. For a banked score they emphatically do not: zero is a
 * real score somebody earned by closing an unbalanced ledger, and reading a
 * missing cookie as zero would bank a nought for a puzzle nobody had played.
 */
function verify(raw: string | undefined, game: DailyGame, date: string): number | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const given = raw.slice(dot + 1);
  const expected = sign(payload);
  if (given.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [g, d, n] = payload.split(":");
  // A cookie for a different game or a different day is not this puzzle's.
  if (g !== game || d !== date) return null;
  const value = Number.parseInt(n ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function decode(raw: string | undefined, game: DailyGame, date: string): number {
  return verify(raw, game, date) ?? 0;
}

function decodeBanked(raw: string | undefined, game: DailyGame, date: string): number | null {
  return verify(raw, game, date);
}

/**
 * Both of these degrade rather than throw, and they SAY SO when they do.
 *
 * `cookies()` is only available inside a request, and a route handler always is
 * one, so in production this never fires. It fires in a unit test that calls the
 * handler directly, and there the honest behaviour is to let the test exercise the
 * logic rather than to answer 500. Loudly, because a security control that quietly
 * stops working is the thing this whole file exists to fix: the last one had a
 * confident comment explaining why it was fine.
 */
export async function readSpent(game: DailyGame, date: string): Promise<number> {
  try {
    const jar = await cookies();
    return decode(jar.get(COOKIE)?.value, game, date);
  } catch {
    console.warn("[spent] no cookie store, treating the count as zero");
    return 0;
  }
}

/**
 * THE SCORE THIS BROWSER ALREADY BANKED FOR THIS PUZZLE.
 *
 * A second hole of the same family as the one above, and a worse one, because it
 * needed no cleverness at all. Every daily is scored by replaying the whole run
 * from the request body, and three of the four answered a completed run with the
 * solution beside the score: THE LEDGER returned `solution`, THE LONG WAY DOWN
 * returned `parLine`, THE DEEP RUN returned `bestRun` -- the optimal build AND
 * the optimal steps. Nothing recorded that you had finished, so:
 *
 *   POST rubbish   -> score 0, and here is the answer
 *   POST the answer -> score 30 of 30, "par", and a clean share card
 *
 * Two requests, no cookies, demonstrated live against all three.
 *
 * WITHHOLDING THE ANSWER IS THE WRONG FIX. Seeing where you went wrong is the
 * reward for finishing, and the reveal is most of why anybody comes back. The
 * thing to defend is not the answer, it is the SCORE.
 *
 * So the first score stands. It is exactly what `recordDone` in local.ts already
 * promises in the browser -- "the FIRST score for a date stands, so replaying a
 * puzzle you have seen the answer to cannot raise the number you banked" -- moved
 * to where it cannot be edited. Play again all you like; the reveal is yours and
 * the number is the one you earned the first time.
 *
 * Not applied to archive days. Those are explicitly practice, they never touch a
 * streak, and knowing the answer is the point of them.
 *
 * Same trade as everything else here: clearing cookies resets it, and clearing
 * cookies also loses the streak and the runner. The point is not to make cheating
 * impossible. It is to stop the honest score and the cheated score being the same
 * number.
 */
export async function readBanked(game: DailyGame, date: string): Promise<number | null> {
  try {
    const jar = await cookies();
    return decodeBanked(jar.get(DONE_COOKIE)?.value, game, date);
  } catch {
    console.warn("[banked] no cookie store, treating the puzzle as unplayed");
    return null;
  }
}

export async function writeBanked(
  game: DailyGame,
  date: string,
  score: number
): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(DONE_COOKIE, encode(game, date, score), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  } catch {
    console.warn("[banked] no cookie store, the score was not kept");
  }
}

/**
 * Bank a finished run, and answer with the score that actually counts.
 *
 * One call rather than a read and a write at four call sites, because the two
 * halves have to agree about `archive` and about which score wins, and four
 * copies of that agreement is three chances to get it wrong.
 */
export async function bankScore(
  game: DailyGame,
  date: string,
  score: number,
  archive: boolean
): Promise<{ score: number; alreadyPlayed: boolean }> {
  if (archive) return { score, alreadyPlayed: false };
  const banked = await readBanked(game, date);
  if (banked !== null) return { score: banked, alreadyPlayed: true };
  await writeBanked(game, date, score);
  return { score, alreadyPlayed: false };
}

export async function writeSpent(game: DailyGame, date: string, count: number): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(COOKIE, encode(game, date, count), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  } catch {
    console.warn("[spent] no cookie store, the count was not kept");
  }
}
