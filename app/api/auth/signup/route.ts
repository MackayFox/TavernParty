import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, "Letters, numbers and underscores, 3 to 20 characters."),
});

/**
 * An account is optional and always has been: guests play everything and keep
 * their streaks in their own browser. This exists only so a record can follow
 * you between devices.
 *
 * The username is claimed here rather than by a client insert, so the uniqueness
 * check and the auth user are created together and a taken name fails cleanly
 * instead of leaving an account with no profile.
 */
export async function POST(req: Request) {
  try {
    if (!supabaseConfigured())
      return NextResponse.json(
        { error: "Accounts are not switched on yet. Guest play works fine." },
        { status: 503 }
      );
    const limited = await rateLimit(req, "signup", 6, 3600);
    if (limited) return limited;
    const body = schema.parse(await jsonBody(req));
    const db = adminClient();

    const { data: taken } = await db
      .from("profiles")
      .select("id")
      .ilike("username", body.username)
      .maybeSingle();
    if (taken) return NextResponse.json({ error: "Somebody has that name." }, { status: 409 });

    const supabase = await serverClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      // Explicit, rather than relying on the project-wide Site URL. That
      // singleton is exactly what sends one site's confirmation email to
      // another site's domain.
      options: { emailRedirectTo: `${new URL(req.url).origin}/login` },
    });
    if (error || !data.user)
      return NextResponse.json(
        { error: error?.message ?? "Could not make that account." },
        { status: 400 }
      );

    const { error: profileErr } = await db
      .from("profiles")
      .insert({ id: data.user.id, username: body.username });
    if (profileErr) {
      console.error("[signup] profile insert failed", profileErr);
      return NextResponse.json(
        { error: "The account was made but the name did not stick. Try logging in." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, username: body.username });
  } catch (err) {
    return handleError(err);
  }
}
