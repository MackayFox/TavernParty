/**
 * The contact form.
 *
 * Three rules, in order of how badly they would hurt to get wrong.
 *
 * 1. It NEVER echoes the submitted text back. Not in the JSON, not in the
 *    redirect, not in an error message. A form that reflects its own input is
 *    how a contact page becomes a cross-site scripting vector and a spam relay,
 *    and there is no reason to: the sender already has what they typed.
 * 2. It writes with the service role only. The table is not readable from a
 *    browser at all, RLS on and no policy, so there is nothing to leak.
 * 3. It is rate limited per IP, because an unauthenticated write endpoint
 *    without one is a database somebody else gets to fill up.
 *
 * Accepts a plain form post and a JSON post. The form post exists so the page
 * works with JavaScript switched off, and it answers with a 303 back to
 * /contact so the browser does not sit on a JSON document.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { adminClient, supabaseConfigured } from "@/lib/supabase/admin";

/** Keep in step with the textarea in app/contact/page.tsx. */
const MAX_MESSAGE = 4000;

/** An empty text input posts "", which is absence rather than a bad value. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional()
  );

const schema = z.object({
  name: optionalText(80),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email().max(160).optional()
  ),
  subject: optionalText(60),
  message: z.string().trim().min(1).max(MAX_MESSAGE),
});

type Problem = "empty" | "long" | "rate" | "store";

function isFormPost(req: Request): boolean {
  const type = req.headers.get("content-type") ?? "";
  return (
    type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")
  );
}

/** One answer shape per client, and neither of them contains the message. */
function reply(req: Request, ok: true): NextResponse;
function reply(req: Request, ok: false, problem: Problem, status: number): NextResponse;
function reply(
  req: Request,
  ok: boolean,
  problem?: Problem,
  status = 400
): NextResponse {
  if (isFormPost(req)) {
    const url = new URL(ok ? "/contact?sent=1" : `/contact?error=${problem}`, req.url);
    // 303 so the browser follows with a GET rather than re-posting the form.
    return NextResponse.redirect(url, 303);
  }
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, code: problem }, { status });
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimit(req, "contact", 5, 3600);
    if (limited) return reply(req, false, "rate", 429);

    const raw = isFormPost(req)
      ? Object.fromEntries(await req.formData())
      : await req.json().catch(() => ({}));

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const tooLong =
        typeof (raw as { message?: unknown }).message === "string" &&
        (raw as { message: string }).message.trim().length > MAX_MESSAGE;
      return reply(req, false, tooLong ? "long" : "empty", 400);
    }

    if (!supabaseConfigured()) {
      /**
       * Offline development has no database. Say so on the server and accept the
       * message, so the page can be exercised locally. In production the store is
       * always configured, and pretending to have filed something we did not
       * would be the one genuinely dishonest option.
       */
      if (process.env.NODE_ENV === "production") return reply(req, false, "store", 503);
      console.warn("[contact] no database configured; message accepted and discarded");
      return reply(req, true);
    }

    const { error } = await adminClient().from("contact_messages").insert({
      name: parsed.data.name ?? null,
      email: parsed.data.email ?? null,
      subject: parsed.data.subject ?? null,
      message: parsed.data.message,
    });
    if (error) {
      // Log the database's complaint, never the sender's text.
      console.error("[contact] insert failed", error.message);
      return reply(req, false, "store", 502);
    }

    return reply(req, true);
  } catch (err) {
    return handleError(err);
  }
}
