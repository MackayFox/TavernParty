/**
 * Fixed-window rate limiting backed by Postgres, so it holds across serverless
 * instances. Fail-open by design: if the limiter itself errors, or Supabase is
 * not configured, requests are allowed. Gameplay must never break because the
 * rate limiter hiccuped.
 *
 * IT HAS NEVER LIMITED ANYTHING, and it took an audit to notice, because
 * fail-open plus a warn-level log is indistinguishable from working. Three bugs,
 * compounding, any one of which was enough on its own:
 *
 *   1. The SQL function is `rate_limit_hit(p_key, p_limit, p_window_seconds)` and
 *      the call passed only two of the three. Postgres answers "function does not
 *      exist", which threw, which was caught, which allowed the request.
 *   2. Even with the signature right, the function returns a BOOLEAN (true when
 *      the request is allowed) and the caller tested `typeof data === "number" &&
 *      data > limit`. A boolean is never a number, so the branch that returns 429
 *      was unreachable.
 *   3. Because (1) threw before reaching it, the garbage collection call never
 *      ran either, so `rate_limits` would have grown without bound the moment the
 *      first two were fixed.
 *
 * Nothing in the suite could see any of it: there was no test anywhere asserting
 * that this ever returns a 429. There is one now.
 */
import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "./supabase/admin";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** How often to sweep expired windows. Roughly one request in two hundred. */
const GC_CHANCE = 0.005;

export function overLimitResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Steady on. Too many requests. Take a short, unpaid break and try again.",
      code: "rate_limited",
    },
    { status: 429 }
  );
}

/**
 * Returns a 429 response when over the limit, else null.
 *
 *   const limited = await rateLimit(req, "table-create", 20, 3600);
 *   if (limited) return limited;
 */
export async function rateLimit(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  if (!supabaseConfigured()) return null;
  let allowed = true;
  try {
    const key = `${name}:${clientIp(req)}`;
    const { data, error } = await adminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    // The function returns TRUE when the request is within the window's budget.
    // Anything other than an explicit false is treated as allowed, which keeps
    // the fail-open promise without making the limit unreachable.
    allowed = data !== false;
  } catch (err) {
    console.warn(`[ratelimit] ${name} check failed, allowing request`, err);
    return null;
  }

  // Outside the try, so a GC failure can never be mistaken for a limiter failure
  // and quietly turn the limiter off. It also has to run after the check rather
  // than instead of it, which is what happened before.
  if (Math.random() < GC_CHANCE) {
    void adminClient()
      .rpc("rate_limit_gc")
      .then(({ error }) => {
        if (error) console.warn("[ratelimit] gc failed", error);
      });
  }

  return allowed ? null : overLimitResponse();
}
