"use client";

/**
 * THE HALL. Dungeons other people wrote.
 *
 * Two tabs and a deliberate absence: there is no "most played". Popularity
 * ranks whatever got seen first and keeps it there, and a board nothing new can
 * climb is a board nobody submits to twice.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorNote, Pill, Spinner } from "@/components/ui";
import { getJson } from "@/components/client";

/**
 * One dungeon as the Hall sees it.
 *
 * Called Row rather than Card so it stops shadowing the Card component imported
 * two lines above it, which is a coin toss the next reader should not have to
 * make.
 */
type Row = {
  code: string;
  title: string;
  intro: string;
  author: string;
  floors: number;
  par: number | null;
  difficulty: string | null;
  /** plays and finishes count ATTEMPTS: store.countPlay runs on every run sent in. */
  plays: number;
  finishes: number;
  /** finishers and marks count PEOPLE: one row per person, and the first run only. */
  finishers: number;
  marks: number;
  ranked: boolean;
  chosen: boolean;
};

type Payload = { minFinishers: number; wellThoughtOf: Row[]; fresh: Row[] };

export function Hall() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * One loader for the first paint and for "Try again".
   *
   * It clears the error before it asks, because a retry that leaves the last
   * failure on screen looks like a second failure.
   */
  const load = useCallback(() => {
    setError(null);
    void getJson<Payload>("/api/dungeons/hall")
      .then(setData)
      .catch(() => setError("Could not open the Hall."));
  }, []);

  useEffect(load, [load]);

  return (
    <section className="mx-auto w-full max-w-3xl py-8">
      <p className="label-caps">The Hall</p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        Dungeons other people wrote
      </h1>
      <p className="prose-read mt-3 text-text-mid">
        Every one of these was checked by the same solver that works out the daily&rsquo;s par, so
        the difficulty on the card was measured rather than claimed. Somebody put each of them here
        by hand.
      </p>

      {error ? (
        /**
         * A failed fetch used to replace the whole page with one red strip: true,
         * and nothing a reader could act on. The heading and the two ways out
         * below now survive it, and this offers the one thing that might work.
         */
        <Card className="mt-5">
          <ErrorNote message={error} />
          <p className="mt-3 text-text-mid">
            The shelf did not answer. Nothing at your end is broken, and the list is read fresh
            every time, so another go usually gets it.
          </p>
          <Button className="mt-3" onClick={load}>
            Try again
          </Button>
        </Card>
      ) : !data ? (
        <div className="flex justify-center py-16">
          <Spinner label="Opening the Hall" />
        </div>
      ) : (
        <Shelf data={data} />
      )}

      <p className="mt-8 text-sm text-text-mid">
        <Link href="/write" className="text-accent underline">
          Write one of your own
        </Link>
        , or play{" "}
        <Link href="/daily/deeprun" className="text-accent underline">
          tonight&rsquo;s official one
        </Link>
        .
      </p>
    </section>
  );
}

/**
 * The shelf itself, once it has arrived.
 *
 * Split out so the page keeps its heading and its two ways out while the list is
 * loading or refusing to, and so which tab opens can be worked out from the
 * payload at mount instead of guessed before it lands.
 */
function Shelf({ data }: { data: Payload }) {
  /**
   * Open on whichever tab has something on it, the ranked one for preference.
   *
   * "Well thought of" holds nothing until a dungeon has data.minFinishers
   * finishers, so on a young Hall the first thing a visitor saw was an empty
   * shelf and a note explaining why it was empty. Derived from the payload
   * rather than hardcoded, so the day the ranking fills up this follows it with
   * no further edit.
   */
  const [tab, setTab] = useState<"good" | "new">(
    data.wellThoughtOf.length > 0 ? "good" : "new"
  );
  const shown = tab === "good" ? data.wellThoughtOf : data.fresh;

  return (
    <>
      {/*
       * Two toggle buttons, not tabs. The ARIA tab pattern wants a tabpanel,
       * arrow-key movement between the tabs and a tabindex dance, and none of
       * that was here: role="tab" on its own told a screen reader to expect a
       * widget the page does not have. aria-pressed is what the rest of the
       * product uses for "this one is chosen" and it is true here.
       */}
      <div className="mt-5 flex gap-2" role="group" aria-label="How to sort the Hall">
        {(
          [
            ["good", "Well thought of"],
            ["new", "New"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-md border px-4 ${
              tab === id
                ? "border-accent bg-accent-dim font-semibold text-text-hi"
                : "border-border-strong bg-bg-2 text-text-mid"
            }`}
          >
            {/* Which list you are looking at was carried by a border and a tint
                and nothing else. The tick is the one DRAFT already uses for a
                choice that has been made. */}
            {tab === id && <span aria-hidden>&#10003; </span>}
            {label}
          </button>
        ))}
      </div>

      {tab === "good" && (
        <p className="mt-2 text-xs text-text-low">
          Ranked by how many of the people who actually finished a dungeon thought it was worth
          their time, not by how many played it. A dungeon needs {data.minFinishers} finishers
          before it can be ranked at all, so nothing tops this on one friendly vote.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-5 rounded-lg border border-border-dim bg-bg-1 p-4 text-text-mid">
          {tab === "good"
            ? `Nothing has ${data.minFinishers} finishers yet. Look under New.`
            : "Nothing here yet. "}
          {tab === "new" && (
            <Link href="/write" className="text-accent underline">
              Write the first one
            </Link>
          )}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((d) => {
            /*
             * Built as a list and joined, so a figure that is missing cannot
             * leave a stranded separator behind it.
             *
             * The two denominators are named now because they are not the same
             * count. "41% of 22 got out" read as twenty-two PEOPLE and was
             * twenty-two attempts, and "3 of 7 finishers rated it" read as four
             * people turning it down when a mark is only ever a yes: nobody is
             * asked, and saying nothing is the default.
             */
            const meta = [
              `${d.floors} floors`,
              d.par != null ? `par ${d.par}` : "par not measured",
              d.plays > 0
                ? `${d.finishes} of ${d.plays} ${d.plays === 1 ? "run" : "runs"} got out`
                : "nobody has tried it yet",
              d.finishers > 0
                ? `${d.marks} of ${d.finishers} ${
                    d.finishers === 1 ? "finisher" : "finishers"
                  } said it was worth their time`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={d.code}>
                {/*
                 * No focus-visible:outline-none on this link.
                 *
                 * It read as "this card has no focus ring", which for a keyboard
                 * user is the difference between knowing where they are and not.
                 * It never actually fired either: globals.css sets the ring in an
                 * unlayered :focus-visible rule and a Tailwind utility sits in
                 * @layer utilities, so the utility lost the cascade. One layer
                 * change away from being true, and nothing here needs it.
                 */}
                <Link href={`/d/${d.code}`} className="block rounded-lg">
                  <Card className="transition-colors hover:border-accent/50">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-display text-lg text-text-hi">{d.title}</span>
                      <span className="text-sm text-text-mid">by {d.author}</span>
                      {d.difficulty && <Pill tone="accent">{d.difficulty}</Pill>}
                      {d.chosen && (
                        <span className="border border-accent px-2 py-0.5 text-xs text-accent">
                          <span aria-hidden>&#9733; </span>Chosen
                        </span>
                      )}
                    </div>
                    {d.intro && (
                      <p className="mt-1 line-clamp-2 text-sm text-text-mid">{d.intro}</p>
                    )}
                    <p className="num mt-2 text-xs text-text-low">{meta}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
