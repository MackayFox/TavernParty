import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use: Free to Play, No Warranty",
  description:
    "The terms for using Tavern Party. Free to play, nothing to buy, no warranty, be decent to the other players, and the law of England and Wales applies.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Use: Free to Play, No Warranty",
    description:
      "Eight short clauses, written to be read. Nothing to buy, nothing that counts as gambling, and the words in the game are ours.",
    url: "/terms",
  },
};

function Clause({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-border-dim pt-6">
      <h2 className="font-display text-xl font-bold text-text-hi">
        <span className="num mr-2 text-accent">{n}</span>
        {title}
      </h2>
      <div className="prose-read flex flex-col gap-3 text-text-mid">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-6 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">Terms of use</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          The short set of rules that is not the game
        </h1>
        <p className="prose-read text-text-mid">
          Using tavernparty.co.uk means agreeing to these. They are written to be read, so
          they are short.
        </p>
      </header>

      <Clause n={1} title="What this is, and what it costs">
        <p>
          Tavern Party is a free browser game. There is nothing to buy, no subscription, and no
          currency of any kind. The Hoard, Renown, Laurels and everything else you win are
          numbers in a game and have no value outside it. Nothing here is gambling: there is no
          stake, no payout, and no way to put money in.
        </p>
      </Clause>

      <Clause n={2} title="Accounts">
        <p>
          You do not need one. If you make one, keep the password to yourself, use an address
          you can actually reach, and do not pick a username designed to impersonate somebody
          else or to be a slur. Accounts that exist to abuse other players get closed without
          notice, and you can close yours whenever you like by asking through the{" "}
          <Link href="/contact" className="text-accent underline">
            contact form
          </Link>
          .
        </p>
      </Clause>

      <Clause n={3} title="Behaving at the table">
        <p>
          You type a character name and you vote for other players. That is the whole of what
          you can say to a stranger here, and it is deliberate. Do not use the name field for
          harassment, slurs, or anything you would not say to somebody sitting opposite you.
          Names that break this get removed, and the accounts behind them get closed.
        </p>
        <p>
          Do not attack the service. That means no scraping, no automated play, no attempts to
          find or exploit a flaw in how the server decides an outcome, no denial of service and
          no trying to reach other players&apos; data. Every dice roll and every result is
          decided on the server precisely so that this is not worth attempting.
        </p>
      </Clause>

      <Clause n={4} title="Whose the game is">
        <p>
          The rules, the writing, the design and the code are mine. Every Calling, Blood, Hook,
          encounter and line of copy was written for this game, and none of it is taken from
          any published roleplaying product. You are welcome to talk about the game, post your
          scores, stream it, and write about it. You may not copy the text or the artwork and
          publish it as your own, and you may not sell access to it.
        </p>
        <p>
          Game mechanics are nobody&apos;s property, in this country or anywhere else, so if
          you want to build your own game that works like this one, go ahead. Just write your
          own words.
        </p>
      </Clause>

      <Clause n={5} title="No warranty, and no promises about uptime">
        <p>
          The site is provided as it is. It may be down, a run may be interrupted, a table may
          be lost, and a score may fail to save. It is a free game run by one person, and none
          of that comes with a guarantee. Nothing here is fit for any particular purpose beyond
          spending ten minutes of an evening on it.
        </p>
        <p>
          To the extent the law allows, I am not liable for any loss arising out of using the
          site, and in particular not for indirect or consequential loss. Nothing in these
          terms limits liability for death or personal injury caused by negligence, for fraud,
          or for anything else that cannot lawfully be limited. If you are a consumer, your
          statutory rights are unaffected.
        </p>
      </Clause>

      <Clause n={6} title="Advertising">
        <p>
          Adverts pay for the hosting. They are served by Google and are never shown during a
          live encounter or a daily puzzle in progress. What an advert says is the advertiser&apos;s
          business, not mine, and clicking one takes you somewhere these terms do not cover.
          What Google does with cookies is set out in the{" "}
          <Link href="/privacy" className="text-accent underline">
            privacy notice
          </Link>
          .
        </p>
      </Clause>

      <Clause n={7} title="Changes, and ending it">
        <p>
          These terms can change, and the current version is always the one on this page. Rules
          and numbers in the game change too, because it is being balanced. I can suspend or
          withdraw the service, or any part of it, at any time. You can stop using it at any
          time, and clearing your browser storage removes everything a guest has here.
        </p>
      </Clause>

      <Clause n={8} title="The law that applies">
        <p>
          These terms and any dispute about them are governed by the law of England and Wales,
          and the courts of England and Wales have exclusive jurisdiction. If you are a
          consumer resident elsewhere in the United Kingdom, you may also bring proceedings in
          your own courts.
        </p>
      </Clause>

      <footer className="border-t border-border-dim pt-6">
        <p className="text-sm text-text-low">
          Questions about any of this go through the{" "}
          <Link href="/contact" className="text-accent underline">
            contact form
          </Link>
          . See also the{" "}
          <Link href="/privacy" className="text-accent underline">
            privacy notice
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
