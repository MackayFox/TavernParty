"use client";

/**
 * The way in.
 *
 * The pitch first and the drafts second, because on somebody's first visit there
 * are no drafts and a page that opens with an empty list is a page that says
 * "there is nothing here for you".
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { getJson, postJson } from "@/components/client";
import { readName, writeName } from "@/lib/daily/local";

type Row = {
  code: string;
  title: string;
  rooms: unknown[];
  par: number | null;
  difficulty: string | null;
  publishedAt: string | null;
  plays: number;
  finishes: number;
};

export function WriteIndex() {
  const router = useRouter();
  const [mine, setMine] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * A NAME TO PUT ON IT, which this page did not ask for.
   *
   * "Start one" posted an empty body. The route takes the name from a signed-in
   * profile or from the body, and a first-time guest has neither, so it answered
   * "Put a name to it first." and the page offered nowhere to put one. A dead end
   * on the front door of the feature.
   *
   * The smoke test never caught it because the script sends a name of its own,
   * which is the shape of test that proves the server works and the screen does
   * not. Remembered the same way the hero's name box remembers, so somebody who
   * has already played is not asked twice.
   */
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setName(readName());
    setLoaded(true);
    void getJson<{ mine: Row[] }>("/api/dungeons")
      .then((d) => setMine(d.mine ?? []))
      .catch(() => setMine([]));
  }, []);

  async function open() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Put a name to it first, so people know whose dungeon it is.");
      return;
    }
    writeName(trimmed);
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ code: string }>("/api/dungeons", { name: trimmed });
      router.push(`/write/${res.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-8">
      <p className="label-caps">The desk</p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        Write a dungeon people can finish
      </h1>
      <p className="prose-read mt-3 text-text-mid">
        Pick some floors, say what they may bring, and send somebody the link. You do not have to
        write a word of it if you would rather not: the shelf is full of rooms other people wrote,
        and six of those is a real dungeon.
      </p>

      <Card className="mt-6">
        <p className="label-caps">What makes this different</p>
        <p className="prose-read mt-2 text-text-hi">
          Nothing you build goes out untested. The moment you save, the same solver that works out
          the daily&rsquo;s par runs your dungeon against every character you allow, and tells you
          the truth about it:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-text-mid">
          <li>
            <span aria-hidden className="mr-2 font-mono text-danger">✕</span>
            Nobody gets out of this one. The best character you allow, playing perfectly, runs out
            of Vigour on floor four.
          </li>
          <li>
            <span aria-hidden className="mr-2 font-mono text-warning">▲</span>
            Floor 3: everybody takes &ldquo;Cut the rope&rdquo;. The others are furniture.
          </li>
          <li>
            <span aria-hidden className="mr-2 font-mono text-success">✓</span>
            Par is 41. Nine of the thirty-six characters you allow get out alive. This one is
            Stiff.
          </li>
        </ul>
        <p className="mt-3 text-sm text-text-low">
          The difficulty word is worked out, never chosen, so nobody can call a walkover brutal.
        </p>
        <label className="mt-4 block">
          <span className="label-caps mb-1 block">Your name, for the byline</span>
          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="ADAM"
            onChange={(e) => setName(e.target.value)}
            aria-describedby="byline-help"
            className="min-h-11 w-full max-w-xs rounded-md border border-border-input bg-bg-0 px-3 text-text-hi"
          />
          <span id="byline-help" className="mt-1 block text-xs text-text-low">
            No account needed. It goes on the dungeon as &ldquo;by you&rdquo;, and it is the
            same name the rest of the site already knows you by.
          </span>
        </label>
        <Button
          size="lg"
          className="mt-3"
          disabled={busy || !loaded || name.trim().length === 0}
          onClick={() => void open()}
        >
          {busy ? "Opening a desk" : "Start one"}
        </Button>
        <ErrorNote message={error} />
      </Card>

      <h2 className="label-caps mt-8">Yours</h2>
      {mine === null ? (
        <div className="py-8">
          <Spinner label="Looking for your drafts" />
        </div>
      ) : mine.length === 0 ? (
        <p className="mt-2 rounded-lg border border-border-dim bg-bg-1 p-4 text-text-mid">
          Nothing yet. The first one takes about two minutes if you use the shelf.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {mine.map((d) => (
            <li key={d.code}>
              <Link
                href={d.publishedAt ? `/d/${d.code}` : `/write/${d.code}`}
                className="flex min-h-14 items-center gap-3 rounded-md border border-border-dim bg-bg-1 px-3 py-2 hover:border-accent/50"
              >
                <span className="num text-xs text-accent">{d.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-text-hi">
                    {d.title || "Untitled"}
                  </span>
                  <span className="block text-xs text-text-mid">
                    {d.rooms.length} floors
                    {d.publishedAt
                      ? ` · out there · ${d.difficulty ?? ""} · par ${d.par ?? "—"} · ${d.plays} plays, ${d.finishes} got out`
                      : " · still a draft"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
