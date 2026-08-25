"use client";

/**
 * THE HALL. Dungeons other people wrote.
 *
 * Two tabs and a deliberate absence: there is no "most played". Popularity
 * ranks whatever got seen first and keeps it there, and a board nothing new can
 * climb is a board nobody submits to twice.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ErrorNote, Pill, Spinner } from "@/components/ui";
import { getJson } from "@/components/client";

type Card = {
  code: string;
  title: string;
  intro: string;
  author: string;
  floors: number;
  par: number | null;
  difficulty: string | null;
  plays: number;
  finishes: number;
  finishers: number;
  marks: number;
  ranked: boolean;
  chosen: boolean;
};

type Payload = { minFinishers: number; wellThoughtOf: Card[]; fresh: Card[] };

export function Hall() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"good" | "new">("good");

  useEffect(() => {
    void getJson<Payload>("/api/dungeons/hall")
      .then(setData)
      .catch(() => setError("Could not open the Hall. Try again."));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Opening the Hall" />
      </div>
    );
  }

  const shown = tab === "good" ? data.wellThoughtOf : data.fresh;

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

      <div className="mt-5 flex gap-2" role="tablist" aria-label="How to sort the Hall">
        {(
          [
            ["good", "Well thought of"],
            ["new", "New"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-md border px-4 ${
              tab === id
                ? "border-accent bg-accent-dim text-text-hi"
                : "border-border-strong bg-bg-2 text-text-mid"
            }`}
          >
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
          {shown.map((d) => (
            <li key={d.code}>
              <Link href={`/d/${d.code}`} className="block rounded-lg focus-visible:outline-none">
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
                  <p className="num mt-2 text-xs text-text-low">
                    {d.floors} floors · par {d.par ?? "—"} ·{" "}
                    {d.plays > 0
                      ? `${Math.round((d.finishes / d.plays) * 100)}% of ${d.plays} got out`
                      : "nobody has tried it yet"}
                    {d.finishers > 0 && ` · ${d.marks} of ${d.finishers} finishers rated it`}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
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
