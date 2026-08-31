/**
 * The lobby browser.
 *
 * Reads the same list `GET /api/tables` serves, straight from the store rather
 * than by fetching our own route: it is the identical query without the round
 * trip, and the route stays for clients that want to poll it.
 *
 * Quick Match has to be a POST, so it is a form with a server action. That keeps
 * the whole page working with JavaScript switched off, which matters for a page
 * whose only job is getting you into a game.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDisallowed } from "@/app/crawl";
import { Button, Card, Input, Field, Pill } from "@/components/ui";
import * as engine from "@/lib/game/engine";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  estimateRunMs,
  formatDuration,
} from "@/lib/game/rules";
import * as store from "@/lib/game/store";
import { getIdentity } from "@/lib/identity";

export const metadata: Metadata = {
  title: "Open Tables: Find an Online Roleplaying Game",
  description:
    "Every table still waiting for players. Sit down at one, or take a Quick Match and let us put you at the fullest one. Free, in your browser, no account.",
  alternates: { canonical: "/tables" },
  /**
   * NOT INDEXED, and dropped from the sitemap to match.
   *
   * This is a lobby. Strip the live list and it is about 140 words of preamble
   * around a name box, which is a utility screen rather than a page, and on a
   * quiet night the only thing on it is an empty state. Thin pages kept out of
   * the index cannot count against the site, and the intent it was ranking for
   * belongs to /online-roleplaying-games, which is written to answer it.
   *
   * `follow: true` on purpose: the crawler is welcome to come through here and
   * pick up the rules, the character lists and the dailies. It just should not
   * file the lobby itself as a result.
   */
  robots: { index: false, follow: true },
  openGraph: {
    title: "Open Tables: Find an Online Roleplaying Game",
    description:
      "Who is sitting down right now, and how many chairs are left. Two players is enough to start, and it takes about ten minutes.",
    url: "/tables",
  },
};

/** The lobby is live state. Never cache it. */
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  /**
   * UNAVAILABLE IS NOT THE SAME AS EMPTY, and this page has to be able to say so.
   *
   * `listPublicRooms` throws when the database refuses, nothing caught it, and this
   * page is in the sitemap: one unexposed schema and both a player and a crawler
   * got a 500 on the page whose whole job is getting somebody into a game.
   *
   * Falling back to the empty state would be worse than the 500, because "nobody
   * has sat down yet" is a lie that invites you to press Quick Match, which needs
   * the same database and would fail in turn. So the failure is caught, logged with
   * its cause, and SHOWN.
   */
  let tables: store.RoomSummary[] | null = null;
  try {
    tables = await store.listPublicRooms();
  } catch (err) {
    console.error("[tables] the lobby list is unavailable", err);
  }

  /**
   * Join the fullest waiting table, or open one.
   *
   * ponytail: this duplicates the three lines in `POST /api/quick-match` and so
   * skips its rate limiter. Worth it for a no-JavaScript path; if the form is
   * ever abused, move it behind the route with a fetch and drop the action.
   */
  async function quickMatch(formData: FormData) {
    "use server";
    const raw = formData.get("displayName");
    const name = typeof raw === "string" ? raw.trim().slice(0, 20) : "";
    if (!name) redirect("/tables?named=0");
    const identity = await getIdentity(true);
    if (!identity) redirect("/tables?named=0");
    const room = await store.quickMatch();
    await store.mutate(room.code, (r, now) => engine.join(r, { id: identity.id, name }, now));
    redirect(`/room/${room.code}`);
  }

  return (
    <div className="flex flex-col gap-8 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <p className="label-caps">Open tables</p>
        <h1 className="font-display text-3xl font-bold text-text-hi sm:text-4xl">
          Somewhere to sit down
        </h1>
        <p className="prose-read text-text-mid">
          {MIN_PLAYERS} to {MAX_PLAYERS} players,{" "}
          {formatDuration(estimateRunMs(DEFAULT_SETTINGS))},
          and exactly one of you walks out with the Hoard. Pick a table below, or let us put
          you at the fullest one that is still waiting.
        </p>
      </header>

      {tables === null ? (
        /*
          The one honest thing to show. Every route into a game from this page goes
          through the same store, so offering the form would be offering a button
          that cannot work, and the dailies genuinely are unaffected: they hold their
          puzzles in the code and need no database at all.
        */
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text-hi">
            The lobby is not answering
          </h2>
          <p className="text-text-mid">
            We cannot reach the room list at the moment, so we cannot tell you who is sitting
            down or open a table for you. It is our end, not yours. Try again in a minute.
          </p>
          <p className="text-text-mid">
            The four daily puzzles do not need any of this and are working normally.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/daily"
              className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
            >
              Play today's puzzles
            </Link>
            <Link
              href="/how-it-works"
              className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
            >
              How to play
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form action={quickMatch} className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-xs">
              <Field label="What are you called" hint="Up to 20 characters. It goes on your sheet.">
                <Input
                  name="displayName"
                  required
                  maxLength={20}
                  autoComplete="nickname"
                  placeholder="OLD MARGET"
                />
              </Field>
            </div>
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Quick Match
            </Button>
          </form>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            Waiting for players
          </h2>
          <p className="label-caps" aria-live="polite">
            {tables === null
              ? "Unavailable"
              : `${tables.length} ${tables.length === 1 ? "table" : "tables"}`}
          </p>
        </div>

        {tables === null ? (
          <Card>
            <p className="text-text-mid">
              The list will be back as soon as we can reach it again.
            </p>
          </Card>
        ) : tables.length === 0 ? (
          <Card className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-bold text-text-hi">
              Nobody has sat down yet
            </h3>
            <p className="text-text-mid">
              Quiet night. Take a Quick Match above and it will open a table with your name on
              it, then anybody else arriving in the next few minutes lands at yours. Two
              players is enough to start.
            </p>
            <p className="text-text-mid">
              If you would rather read the rules first, the whole thing is one page.
            </p>
            <div>
              <Link
                href="/how-it-works"
                className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
              >
                How to play
              </Link>
            </div>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {tables.map((table) => {
              const full = table.players >= table.maxPlayers;
              return (
                <li key={table.code}>
                  <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display truncate text-lg font-bold text-text-hi">
                          {table.name}
                        </h3>
                        <Pill tone={full ? "danger" : "success"}>
                          {full ? "Full" : "Open"}
                        </Pill>
                      </div>
                      <p className="mt-1 text-sm text-text-mid">
                        <span className="num text-text-hi">
                          {table.players}/{table.maxPlayers}
                        </span>{" "}
                        seated, <span className="num text-text-hi">{table.acts}</span> Acts,
                        code <span className="num text-text-hi">{table.code}</span>
                      </p>
                    </div>
                    {full ? (
                      <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-low">
                        No room at this one
                      </p>
                    ) : (
                      <Link
                        href={`/room/${table.code}`}
                        // robots.txt forbids /room/, so a followable link here is
                        // an invitation to fetch a URL we have already refused,
                        // for a table that will not exist by the time anybody
                        // asks. Search Console files that under "blocked".
                        rel={isDisallowed(`/room/${table.code}`) ? "nofollow" : undefined}
                        className="font-display inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
                      >
                        Join
                        <span className="sr-only"> {table.name}</span>
                      </Link>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-sm text-text-low">
        Private tables are not listed. If somebody has given you a six character code, type it
        in on the front page.
      </p>
    </div>
  );
}
