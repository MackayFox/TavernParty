/**
 * Contact.
 *
 * A plain HTML form posting to `/api/contact`, so it works with JavaScript
 * switched off. The route redirects back here with `?sent=1` on success and
 * `?error=...` when it could not accept the message, and it never echoes the
 * submitted text back, here or anywhere else.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";

/** Keep in step with the zod schema in app/api/contact/route.ts. */
const CONTACT_MAX = 4000;
const CONTACT_SUBJECTS = [
  "A bug",
  "A rule that reads wrong",
  "An encounter for the deck",
  "Accessibility",
  "Something else",
] as const;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Report a bug, question a rule, or suggest an encounter for the deck. One form, and it reaches the person who built the game.",
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
};

const ERRORS: Record<string, string> = {
  empty: "There was nothing in the message box, so there was nothing to send.",
  long: `That was longer than ${CONTACT_MAX} characters. Trim it and try again.`,
  rate: "That is a lot of messages in a short time. Give it an hour and try again.",
  store: "The message could not be filed. Nothing was lost on your end, so try again shortly.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const problem = error ? (ERRORS[error] ?? ERRORS.store) : null;

  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">Contact</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Tell me what is wrong with it
        </h1>
        <p className="prose-read text-text-mid">
          Bugs, rules that read wrong, an encounter you think belongs in the deck, or a
          complaint. It all arrives in the same place and I read all of it. An email address is
          optional and only exists so I can answer you.
        </p>
      </header>

      {sent === "1" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-success">
            <span aria-hidden>✓ </span>Sent
          </h2>
          <p className="text-text-mid">
            That is filed. If you left an address you will get an answer, though not
            necessarily a fast one. Thank you for bothering.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/tables"
              className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
            >
              Find a table
            </Link>
            <Link
              href="/contact"
              className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
            >
              Send another
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <form method="post" action="/api/contact" className="flex flex-col gap-4">
            <ErrorNote message={problem} />

            <Field label="Your name" hint="Optional. Something to call you.">
              <Input name="name" maxLength={80} autoComplete="name" />
            </Field>

            <Field label="Email" hint="Optional. Only used to reply to this message.">
              <Input name="email" type="email" maxLength={160} autoComplete="email" />
            </Field>

            <label className="block">
              <span className="label-caps mb-1 block">What is it about</span>
              <select
                name="subject"
                defaultValue={CONTACT_SUBJECTS[0]}
                className="min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-4 py-2.5 text-base text-text-hi"
              >
                {CONTACT_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-caps mb-1 block">Message</span>
              <textarea
                name="message"
                required
                rows={8}
                maxLength={CONTACT_MAX}
                className="w-full rounded-md border border-border-input bg-bg-0 px-4 py-2.5 text-base text-text-hi placeholder:text-text-low"
                placeholder="What happened, and what you expected instead."
              />
              <span className="mt-1 block text-xs text-text-low">
                Up to {CONTACT_MAX.toLocaleString("en-GB")} characters.
              </span>
            </label>

            <div>
              <Button type="submit" size="lg">
                Send it
              </Button>
            </div>

            <p className="text-xs text-text-low">
              Submitting stores the message, and the date, so I can answer it. Nothing else is
              recorded and nothing is passed on. See the{" "}
              <Link href="/privacy" className="text-accent underline">
                privacy notice
              </Link>
              .
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
