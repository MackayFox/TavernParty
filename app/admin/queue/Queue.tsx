"use client";

/**
 * The queue. One screen, one job: read somebody's dungeon and decide.
 *
 * The prose is flattened onto the page rather than linked, because the only way
 * a moderator actually reads every room is if reading every room costs no
 * clicks. The three verbs sit under it, in the order they get used.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorNote, Pill, Spinner } from "@/components/ui";
import { getJson, postJson } from "@/components/client";

type Item = {
  code: string;
  title: string;
  intro: string;
  author: string;
  floors: number;
  par: number | null;
  difficulty: string | null;
  plays: number;
  finishes: number;
  standing: { finishers: number; marks: number; wilson: number };
  prose: string[];
};

export function Queue() {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getJson<{ queue: Item[] }>("/api/admin/dungeons")
      .then((d) => setQueue(d.queue))
      .catch(() => setError("Could not read the queue."));
  }, []);

  async function act(code: string, action: "list" | "return" | "ban") {
    setBusy(code);
    setError(null);
    try {
      await postJson(`/api/admin/dungeons/${code}`, { action });
      setQueue((q) => (q ?? []).filter((d) => d.code !== code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !queue) return <ErrorNote message={error} />;
  if (!queue) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Reading the queue" />
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-8">
      <p className="label-caps">Moderation</p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi">
        Waiting to be read
      </h1>
      <p className="mt-2 text-text-mid">
        {queue.length === 0
          ? "Nothing waiting."
          : `${queue.length} ${queue.length === 1 ? "dungeon" : "dungeons"} asking for a place in the Hall.`}
      </p>
      <ErrorNote message={error} />

      <ul className="mt-5 space-y-4">
        {queue.map((d) => (
          <li key={d.code}>
            <Card>
              <div className="flex flex-wrap items-baseline gap-2">
                <Link href={`/d/${d.code}`} className="font-display text-lg text-accent underline">
                  {d.title || d.code}
                </Link>
                <span className="text-sm text-text-mid">by {d.author}</span>
                {d.difficulty && <Pill tone="accent">{d.difficulty}</Pill>}
              </div>
              <p className="num mt-1 text-xs text-text-low">
                {d.code} · {d.floors} floors · par {d.par ?? "—"} ·{" "}
                {d.plays > 0
                  ? `${Math.round((d.finishes / d.plays) * 100)}% of ${d.plays} got out`
                  : "unplayed"}
                {d.standing.finishers > 0 &&
                  ` · ${d.standing.marks}/${d.standing.finishers} rated it`}
              </p>
              {d.intro && <p className="prose-read mt-2 text-text-mid">{d.intro}</p>}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-accent">
                  Every word of it ({d.prose.length} lines)
                </summary>
                <div className="mt-2 max-h-80 space-y-1 overflow-y-auto rounded border border-border-dim bg-bg-2 p-3 text-sm text-text-mid">
                  {d.prose.filter(Boolean).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </details>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => act(d.code, "list")} disabled={busy === d.code}>
                  Put it on the shelf
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => act(d.code, "return")}
                  disabled={busy === d.code}
                >
                  Hand it back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => act(d.code, "ban")}
                  disabled={busy === d.code}
                >
                  Take it down
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
