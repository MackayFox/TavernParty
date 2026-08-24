/**
 * Employee identity.
 *
 * Guests get a signed, httpOnly cookie carrying a random id. Signing (HMAC)
 * stops one guest impersonating another by editing the cookie. Registered users
 * carry their Supabase auth uuid instead. Route handlers NEVER trust a
 * client-supplied player id — it always comes from here.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "tp_guest";

/**
 * The dev fallback secret is public (it is in the repo), so production refuses
 * to serve on it — otherwise anyone could forge a guest identity. Checked
 * lazily so `next build` (which sets NODE_ENV=production) can still import.
 */
function getSecret(): string {
  const secret = process.env.GUEST_COOKIE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("GUEST_COOKIE_SECRET must be set in production.");
  }
  return "tavern-party-dev-secret";
}

function sign(id: string): string {
  return createHmac("sha256", getSecret()).update(id).digest("base64url");
}

function encode(id: string): string {
  return `${id}.${sign(id)}`;
}

function decode(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}

/** The caller's guest id, creating and setting the cookie if absent. */
export async function getOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) {
    const id = decode(existing);
    if (id) return id;
  }
  const id = `g_${randomBytes(12).toString("base64url")}`;
  jar.set(COOKIE, encode(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}

/** Read-only variant for GET handlers that must not set cookies. */
export async function getGuestId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return value ? decode(value) : null;
}

export type Identity = {
  /** Player id used in games: the auth user uuid, or the signed guest id. */
  id: string;
  kind: "user" | "guest";
  displayName?: string;
  username?: string;
};

/**
 * Who is calling? A registered Supabase session wins; otherwise the guest
 * cookie (created on demand when `create` is true).
 */
export async function getIdentity(create = false): Promise<Identity | null> {
  const { supabaseConfigured } = await import("./supabase/admin");
  if (supabaseConfigured()) {
    try {
      const { serverClient } = await import("./supabase/server");
      const supabase = await serverClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { adminClient } = await import("./supabase/admin");
        const { data: profile } = await adminClient()
          .from("profiles")
          .select("display_name, username")
          .eq("id", data.user.id)
          .maybeSingle();
        return {
          id: data.user.id,
          kind: "user",
          displayName: profile?.display_name,
          username: profile?.username,
        };
      }
    } catch (err) {
      console.warn("[identity] auth lookup failed, falling back to guest", err);
    }
  }
  const guestId = create ? await getOrCreateGuestId() : await getGuestId();
  return guestId ? { id: guestId, kind: "guest" } : null;
}
