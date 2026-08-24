/**
 * Fixed-window rate limiting backed by Postgres (works across serverless
 * instances). Fail-open by design: if the limiter itself errors, or Supabase
 * isn't configured (offline dev), requests are allowed. Gameplay must never
 * break because the rate limiter hiccuped.
 */
import { NextResponse } from "next/server";
import { adminClient, supabaseConfigured } from "./supabase/admin";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 response when over the limit, else null.
 * Usage: const limited = await rateLimit(req, "room-create", 20, 3600);
 *        if (limited) return limited;
 */
export async function rateLimit(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  if (!supabaseConfigured()) return null;
  try {
    const key = `${name}:${clientIp(req)}`;
    const { data, error } = await adminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (typeof data === "number" && data > limit) {
      return NextResponse.json(
        {
          error: "Steady on. Too many requests. Take a short, unpaid break and try again.",
          code: "rate_limited",
        },
        { status: 429 }
      );
    }
    // Occasional GC keeps the table tiny (roughly 1-in-200 requests).
    if (Math.random() < 0.005) void adminClient().rpc("rate_limit_gc");
    return null;
  } catch (err) {
    console.warn(`[ratelimit] ${name} check failed, allowing request`, err);
    return null;
  }
}
