/**
 * The rate limiter, which had never limited anything.
 *
 * There was no test anywhere asserting that it ever returns a 429, which is
 * exactly why three separate bugs survived in it: it fails open and logs at warn
 * level, so a limiter that is completely broken looks identical to a limiter with
 * nothing to do.
 *
 * These mock the Supabase client, because the point is the CONTRACT between this
 * module and the SQL function: the argument list, and what the return value means.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: unknown }[] = [];
let hitResult: { data: unknown; error: unknown } = { data: true, error: null };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseConfigured: () => true,
  adminClient: () => ({
    rpc: (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      if (fn === "rate_limit_hit") return Promise.resolve(hitResult);
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));

const { rateLimit } = await import("@/lib/ratelimit");

const req = (ip = "1.2.3.4") =>
  new Request("https://tavernparty.co.uk/api/tables", { headers: { "x-forwarded-for": ip } });

afterEach(() => {
  calls.length = 0;
  hitResult = { data: true, error: null };
});

describe("the call itself", () => {
  it("passes the limit, which it never used to", () => {
    // The SQL function takes (p_key, p_limit, p_window_seconds) and the caller
    // sent two of three, so Postgres answered "function does not exist" every
    // time and the catch allowed the request.
    return rateLimit(req(), "table-create", 20, 3600).then(() => {
      const hit = calls.find((c) => c.fn === "rate_limit_hit");
      expect(hit).toBeDefined();
      expect(hit!.args).toMatchObject({
        p_key: "table-create:1.2.3.4",
        p_limit: 20,
        p_window_seconds: 3600,
      });
    });
  });

  it("keys on the name and the caller's address together", async () => {
    await rateLimit(req("9.9.9.9"), "signup", 6, 60);
    expect((calls[0].args as { p_key: string }).p_key).toBe("signup:9.9.9.9");
  });
});

describe("what the answer means", () => {
  it("allows the request when the function says true", async () => {
    hitResult = { data: true, error: null };
    expect(await rateLimit(req(), "x", 5, 60)).toBeNull();
  });

  it("returns a 429 when the function says false", async () => {
    // The old code tested `typeof data === "number"`, and the function returns a
    // boolean, so this branch was unreachable no matter what the database said.
    hitResult = { data: false, error: null };
    const res = await rateLimit(req(), "x", 5, 60);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = (await res!.json()) as { code: string };
    expect(body.code).toBe("rate_limited");
  });

  it("fails open when the limiter itself errors", async () => {
    hitResult = { data: null, error: new Error("boom") };
    expect(await rateLimit(req(), "x", 5, 60)).toBeNull();
  });

  it("fails open on an answer it does not understand", async () => {
    // Gameplay must never break because the limiter hiccuped.
    hitResult = { data: undefined, error: null };
    expect(await rateLimit(req(), "x", 5, 60)).toBeNull();
  });
});

describe("housekeeping", () => {
  it("can still sweep, which it could not when the check threw first", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    await rateLimit(req(), "x", 5, 60);
    expect(calls.some((c) => c.fn === "rate_limit_gc")).toBe(true);
    random.mockRestore();
  });

  it("does not sweep on most requests", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.9);
    await rateLimit(req(), "x", 5, 60);
    expect(calls.some((c) => c.fn === "rate_limit_gc")).toBe(false);
    random.mockRestore();
  });
});
