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
  // Somebody else's dungeon. There is deliberately no report BUTTON anywhere on
  // the site, because a control that hides whatever enough people click is a
  // griefing tool. This is the whole reporting mechanism: a form a person reads.
  "A dungeon that should not be up",
  "Accessibility",
  "Something else",
] as const;

export const metadata: Metadata = {
  title: "Contact: Report a Bug or Suggest an Encounter",
  description:
    "Report a bug, question a rule, or suggest an encounter for the deck. One form, and it reaches the person who built the game. An email address is optional.",
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Contact: Report a Bug or Suggest an Encounter",
    description:
      "Bugs, rules that read wrong, an encounter you think belongs in the deck, or a complaint. It all arrives in the same place.",
    url: "/contact",
  },
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
  searchParams: Promise<{ sent?: string; error?: string; about?: string; code?: string }>;
}) {
  const { sent, error, about, code } = await searchParams;
  const problem = error ? (ERRORS[error] ?? ERRORS.store) : null;
  /**
   * Arriving from a dungeon, with its code already in the box.
   *
   * The code is the only thing somebody reporting a dungeon has and the only
   * thing I need to find it, and asking them to copy six letters across two pages
   * is how a report does not get sent. Validated to the shape a code actually
   * has, because it lands in a text field on a form that gets emailed.
   */
  const dungeon = /^[A-Z0-9]{6}$/.test((code ?? "").toUpperCase())
    ? (code as string).toUpperCase()
    : null;
  const subject =
    about === "dungeon" && CONTACT_SUBJECTS.includes("A dungeon that should not be up")
      ? "A dungeon that should not be up"
      : CONTACT_SUBJECTS[0];

  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">Contact</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Tell me what is wrong with it
        </h1>
        <p className="prose-read text-text-mid">
          Bugs, rules that read wrong, an encounter you think belongs in the deck, or a
          complaint. It all arrives in the same place and I read all of it. My name is Adam
          Mackay, I built this and I run it on my own from the United Kingdom, and this form is
          the only way in: there is no support desk behind it and nobody else on the other end.
          There is more about who I am and why the game is shaped like this{" "}
          <Link href="/about" className="text-accent underline">
            on the about page
          </Link>
          .
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold text-text-hi">
          What happens to what you send
        </h2>
        <p className="prose-read text-text-mid">
          Pressing the button writes your message, the subject you chose, and the date into one
          table in the database, and that is the whole of it. No email is sent to a third party,
          nothing is forwarded anywhere, and the table is not readable from any browser: it has
          row level security on with no read policy at all, so the only thing that can open it
          is the server key, which is mine. Nothing you type is ever echoed back to you or shown
          on the site.
        </p>
        <p className="prose-read text-text-mid">
          Name and email are both genuinely optional and both blank by default. Leave the email
          out and you will get no reply, because there is nothing to reply to, but the message
          is still read. Leave it in and it is used for exactly one thing, which is answering
          this message. It is not a mailing list. There is no mailing list.
        </p>
        <p className="prose-read text-text-mid">
          Answers are not fast. This is one person&apos;s evenings, so a real bug with steps in
          it usually gets looked at within a few days and a question about a rule might sit for
          longer. The single most useful thing you can put in the box is what you did, what
          happened, and what you expected instead. If it was during a game, the six character
          table code narrows it down enormously.
        </p>
        <p className="prose-read text-text-mid">
          Form submissions are rate limited to five an hour from one address, which is the only
          reason your IP is touched at all and it is not stored against the message. Anything
          about your own data, under the UK GDPR, comes through this form too and is set out in
          the{" "}
          <Link href="/privacy" className="text-accent underline">
            privacy notice
          </Link>
          .
        </p>
      </section>

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
                defaultValue={subject}
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
                defaultValue={dungeon ? `Dungeon ${dungeon}. ` : undefined}
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
