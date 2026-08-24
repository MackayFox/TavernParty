/**
 * Privacy.
 *
 * Written against the code rather than against a template. Every cookie, key and
 * table named here exists: the guest cookie is lib/identity.ts, the localStorage
 * keys are lib/daily/local.ts, the ad script is app/layout.tsx, the analytics are
 * components/AnalyticsProvider.tsx, and the tables are supabase/migrations/.
 * If a claim on this page stops being true, the code changed and this page is a
 * bug.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Tavern Party stores, where, and for how long. A signed guest cookie, some browser storage for your streaks, and Google's advertising cookies. Nothing sold, nothing tracked across other sites by us.",
  alternates: { canonical: "/privacy" },
};

function Row({ what, why, where }: { what: string; why: string; where: string }) {
  return (
    <tr className="border-b border-border-dim align-top">
      <th scope="row" className="num py-2 pr-4 text-left font-normal text-text-hi">
        {what}
      </th>
      <td className="py-2 pr-4 text-text-mid">{why}</td>
      <td className="py-2 text-text-mid">{where}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">Privacy notice</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          What this site keeps
        </h1>
        <p className="prose-read text-text-mid">
          Tavern Party is a game you can play without an account, and the short version is
          that it keeps as little as it can get away with. The long version is below, written
          against the actual code rather than from a template, so it names real cookies and
          real database tables.
        </p>
        <p className="text-sm text-text-low">
          This notice covers tavernparty.co.uk. It is operated from the United Kingdom, and
          English law applies to it.
        </p>
      </header>

      {/* ------------------------------------------------------------- cookies */}
      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Cookies</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <caption className="sr-only">Cookies this site sets, and why</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="label-caps py-2 pr-4">
                  Cookie
                </th>
                <th scope="col" className="label-caps py-2 pr-4">
                  What it is for
                </th>
                <th scope="col" className="label-caps py-2">
                  How long
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                what="tp_guest"
                why="Your guest identity. It holds a random id and a signature, nothing else: no name, no email, no game history. It is httpOnly, so JavaScript on the page cannot read it, and it is signed so that nobody can edit it into somebody else's identity. Without it the server cannot tell which player at a table is you."
                where="One year, or until you clear it"
              />
              <Row
                what="Supabase auth cookies"
                why="Only if you create an account and sign in. They hold the session, and they are set by Supabase, who host the login for us."
                where="Until you sign out or the session expires"
              />
              <Row
                what="Google advertising cookies"
                why="Set by Google, not by us, when an advert is served on the page. Google uses them to limit how often you see the same advert and to measure whether one worked. We never see them and we cannot read them."
                where="Set and controlled by Google"
              />
              <Row
                what="PostHog analytics cookie"
                why="Counts page views and a small number of named events, like a run being started or a daily being finished, so I can see which parts of the game people actually use. No autocapture, so it is not recording what you click or type. Hosted in the EU."
                where="Set and controlled by PostHog"
              />
            </tbody>
          </table>
        </div>
        <p className="prose-read text-text-mid">
          There is no cookie banner, because the guest cookie is the one thing the game
          genuinely cannot work without, and the rest are not ours to consent to on your
          behalf. If you would rather have none of it, browser settings and any of the usual
          blockers will stop the advertising and analytics ones. The game still plays.
        </p>
      </section>

      {/* -------------------------------------------------------------- storage */}
      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Storage in your own browser
        </h2>
        <p className="prose-read text-text-mid">
          The daily puzzles keep your progress in localStorage, which never leaves your
          machine and is not sent to us. That is what lets a guest keep a streak and reload a
          half finished puzzle without losing it.
        </p>
        <Card>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <span className="num text-text-hi">tp_daily_done</span>{" "}
              <span className="text-text-mid">
                which days you have completed, and the score for each.
              </span>
            </li>
            <li>
              <span className="num text-text-hi">tp_daily_progress</span>{" "}
              <span className="text-text-mid">
                one entry per puzzle per date, holding the in flight state so a refresh does
                not restart it. Old entries are pruned automatically.
              </span>
            </li>
            <li>
              <span className="num text-text-hi">tp_name</span>{" "}
              <span className="text-text-mid">
                the name you last used, so you are not asked for it every time.
              </span>
            </li>
          </ul>
        </Card>
        <p className="prose-read text-text-mid">
          Clearing your browser storage deletes all of it, including your streaks. There is no
          copy on the server unless you have an account.
        </p>
      </section>

      {/* ---------------------------------------------------------------- server */}
      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          What is stored on the server
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-text-mid">
          <li>
            <strong className="text-text-hi">Live tables.</strong> While a game is running, the
            state of that table is stored: the code, the name you typed, your guest id, and the
            dice. It is deleted once the table has been idle for a while, and nothing about a
            finished run is kept for a guest.
          </li>
          <li>
            <strong className="text-text-hi">Accounts, if you make one.</strong> An email
            address and a password, both held by Supabase who provide the login, plus a
            username you choose. If you have an account, finished runs and daily scores are
            recorded against it so you have a history. Guests write none of this.
          </li>
          <li>
            <strong className="text-text-hi">Rate limiting.</strong> A short lived counter
            keyed on your IP address, so one person cannot open a thousand tables. It is a
            count and a timestamp, it is not linked to your identity or your games, and it is
            deleted after a day.
          </li>
          <li>
            <strong className="text-text-hi">Contact messages.</strong> If you use the{" "}
            <Link href="/contact" className="text-accent underline">
              contact form
            </Link>
            , what you typed is stored so it can be read and answered, along with the date.
            The name and email address on that form are both optional. Those messages are not
            readable from any browser and are not used for anything else.
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------------------ ads */}
      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">
          Advertising, and third parties
        </h2>
        <p className="prose-read text-text-mid">
          Adverts pay for the hosting. They are served by Google AdSense, which means Google
          receives your IP address and the page you are on, and may use its own cookies to
          personalise and measure what it shows you. That is Google acting as its own
          controller, under its own policies, and you can review and change what it does at{" "}
          <a
            href="https://myadcenter.google.com/"
            className="text-accent underline"
            rel="noopener"
          >
            Google My Ad Center
          </a>{" "}
          and read the detail in{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            className="text-accent underline"
            rel="noopener"
          >
            how Google uses information from sites that use its services
          </a>
          . Adverts are never rendered during a live encounter or a daily puzzle in progress.
        </p>
        <p className="prose-read text-text-mid">
          The other third parties are Vercel, who host the site and keep short lived request
          logs; Supabase, who hold the database and the accounts; and PostHog, who count the
          page views. Google Fonts files are served from this site rather than fetched from
          Google, so loading a page does not tell Google that you did.
        </p>
        <p className="prose-read text-text-mid">
          Nothing is sold. No data is passed to anybody for their own marketing. There is no
          advertising or tracking pixel here beyond the two named above.
        </p>
      </section>

      {/* -------------------------------------------------------------- rights */}
      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Your rights</h2>
        <p className="prose-read text-text-mid">
          Under the UK GDPR you can ask for a copy of what is held about you, ask for it to be
          corrected, or ask for it to be deleted. For a guest there is realistically nothing to
          send you, because a guest cookie is a random string and nothing is attached to it
          once the table is gone. For an account, ask through the{" "}
          <Link href="/contact" className="text-accent underline">
            contact form
          </Link>{" "}
          and it will be dealt with. Deleting an account deletes the profile, the run history
          and the daily results with it.
        </p>
        <p className="prose-read text-text-mid">
          The lawful basis for the guest cookie and the live table state is legitimate
          interests, specifically being able to run a multiplayer game at all. For an account
          it is performance of a contract, and for advertising and analytics cookies it is the
          consent you manage in your browser and, for Google, in your Google settings.
        </p>
        <p className="prose-read text-text-mid">
          If you think this has been handled badly you can complain to the Information
          Commissioner&apos;s Office at{" "}
          <a href="https://ico.org.uk/" className="text-accent underline" rel="noopener">
            ico.org.uk
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
        <h2 className="font-display text-2xl font-bold text-text-hi">Children</h2>
        <p className="prose-read text-text-mid">
          This is a game about a bad night in a tavern, and it is meant for a general audience.
          Accounts are not intended for under 13s. If you believe a child has created one,{" "}
          <Link href="/contact" className="text-accent underline">
            say so
          </Link>{" "}
          and it will be removed.
        </p>
      </section>

      <footer className="border-t border-border-dim pt-8">
        <p className="text-sm text-text-low">
          If this notice changes in a way that matters, the change will be noted on this page.
          See also the{" "}
          <Link href="/terms" className="text-accent underline">
            terms of use
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
