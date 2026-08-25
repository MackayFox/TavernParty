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

function decode(raw: string | undefined, game: DailyGame, date: string): number {
  if (!raw) return 0;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return 0;
  const payload = raw.slice(0, dot);
  const given = raw.slice(dot + 1);
  const expected = sign(payload);
  if (given.length !== expected.length) return 0;
  try {
    if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return 0;
  } catch {
    return 0;
  }
  const [g, d, n] = payload.split(":");
  // A cookie for a different game or a different day is not this puzzle's count.
  if (g !== game || d !== date) return 0;
  const count = Number.parseInt(n ?? "", 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
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
