"use client";

/**
 * THE DOOR. Where a shared link lands, and where the run is played.
 *
 * One page, not two: the door and the descent are the same screen, because a
 * link that lands on a page whose only control is another link has spent the
 * click it was given.
 *
 * The run itself is `DeepRunGame`, unchanged, pointed at a dungeon instead of a
 * date. That reuse is the whole point of the feature and it is why this file is
 * short.
 */
import { useState } from "react";
import Link from "next/link";
import { Button, Card, ErrorNote, Pill } from "@/components/ui";
import { getJson, postJson } from "@/components/client";
import { DeepRunGame } from "@/app/daily/deeprun/DeepRunGame";
import { MIN_FINISHERS } from "@/lib/campaign/hall-shared";

type DoorInfo = {
  code: string;
  title: string;
  intro: string;
  author: string;
  floors: number;
  par: number | null;
  difficulty: string | null;
  baseVigour: number;
  callings: number;
  kit: number;
  plays: number;
  finishes: number;
  chosenAt: string | null;
};

type Standing = { finishers: number; marks: number; wilson: number };

export function Door({
  door,
  standing,
  marked,
  mine,
  visibility,
}: {
  door: DoorInfo;
  standing: Standing;
  marked: boolean;
  mine: boolean;
  visibility: "unlisted" | "submitted" | "listed" | "banned";
}) {
  const [down, setDown] = useState(false);

  if (down) return <DeepRunGame date={null} dungeon={door.code} />;

  const share = door.plays > 0 ? Math.round((door.finishes / door.plays) * 100) : null;

  return (
    <section className="mx-auto w-full max-w-2xl py-8">
      <p className="label-caps">
        <span aria-hidden>🕯️ </span>
        {mine ? "Your dungeon, as everybody else sees it" : "Somebody else’s dungeon"}
      </p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        {door.title}
      </h1>
      <p className="mt-1 text-text-mid">by {door.author}</p>
      {door.chosenAt && (
        <p className="mt-3 inline-block border border-accent px-3 py-1 text-sm text-accent">
          <span aria-hidden>&#9733; </span>
          Chosen. This one was put in front of the whole site, and that does not expire.
        </p>
      )}

      {door.intro && <p className="prose-read mt-4">{door.intro}</p>}

      <Card className="mt-5">
        <p className="label-caps">The rules of this one</p>
        <ul className="mt-2 space-y-1 text-text-hi">
          <li>
            {door.floors} floors, and something at the bottom of them.
          </li>
          <li>
            {door.callings} Callings on the table. {door.kit} things on the shelf, and you take
            two.
          </li>
          <li>
            Vigour {door.baseVigour}
            {door.baseVigour === 9 ? ", which is standard" : door.baseVigour > 9 ? ", which is generous" : ", which is thin"}.
          </li>
          <li>
            Every room owns its die, and you only see the number once you are in the room. The
            same dungeon, and the same dice, for everybody who opens this link.
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {door.difficulty && <Pill tone="accent">{door.difficulty}</Pill>}
          {door.par !== null && (
            <span className="num text-sm text-text-mid">Par {door.par}</span>
          )}
          {share !== null && (
            <span className="num text-sm text-text-mid">
              {share}% of {door.plays} got out
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-text-low">
          The difficulty was worked out by playing every character this dungeon allows, not
          claimed by whoever wrote it.
        </p>

        <Button size="lg" className="mt-4" onClick={() => setDown(true)}>
          Go down
        </Button>
      </Card>

      <Mark code={door.code} standing={standing} marked={marked} />
      {mine && <Submit code={door.code} visibility={visibility} />}

      <p className="mt-6 text-sm text-text-mid">
        <Link href="/daily/deeprun" className="text-accent underline">
          Tonight&rsquo;s official one
        </Link>{" "}
        is a different dungeon, and{" "}
        <Link href="/write" className="text-accent underline">
          you can write your own
        </Link>
        .
      </p>
      <p className="mt-2 text-xs text-text-low">
        Somebody wrote this, and it is their writing rather than mine. If it should not be up,{" "}
        <Link
          href={`/contact?about=dungeon&code=${door.code}`}
          className="text-text-mid underline"
        >
          tell me and I will read it myself
        </Link>
        . There is no button that hides a dungeon automatically, on purpose.
      </p>
    </section>
  );
}

/**
 * "Was it worth your time?"
 *
 * The button is always shown and the server decides whether it counts, rather
 * than the page trying to know whether you finished. It cannot know: you might
 * have finished on this page a second ago, in which case the run is on the
 * server and this component's props are stale. So it asks, and the honest 403
 * is the answer.
 */
function Mark({ code, standing, marked }: { code: string; standing: Standing; marked: boolean }) {
  const [done, setDone] = useState(marked);
  const [count, setCount] = useState(standing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function say() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ standing: Standing }>(`/api/dungeons/${code}/mark`, {});
      setCount(res.standing);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border-dim bg-bg-1 p-4">
      <p className="label-caps">What people made of it</p>
      <p className="num mt-1 text-text-hi">
        {count.finishers === 0
          ? "Nobody has got to the bottom of it yet."
          : `${count.marks} of the ${count.finishers} who got out said it was worth their time.`}
      </p>
      {count.finishers > 0 && count.finishers < MIN_FINISHERS && (
        <p className="mt-1 text-xs text-text-low">
          Needs {MIN_FINISHERS - count.finishers} more{" "}
          {MIN_FINISHERS - count.finishers === 1 ? "finisher" : "finishers"} before it can be
          ranked in the Hall.
        </p>
      )}
      {done ? (
        <p className="mt-3 flex items-center gap-2 text-text-hi">
          <span aria-hidden>✓</span> You said it was good. That stands.
        </p>
      ) : (
        <>
          <Button variant="secondary" className="mt-3" onClick={say} disabled={busy}>
            {busy ? "Saying so…" : "It was worth my time"}
          </Button>
          <p className="mt-1 text-xs text-text-low">
            Only counts once you have got to the bottom of it, and it does not toggle.
          </p>
        </>
      )}
      <ErrorNote message={error} />
    </div>
  );
}

/** The author's one control after publishing: ask a person to shelve it out front. */
function Submit({ code, visibility }: { code: string; visibility: string }) {
  const [state, setState] = useState(visibility);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/dungeons/${code}/submit`, {});
      setState("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border-dim bg-bg-1 p-4">
      <p className="label-caps">Yours</p>
      {state === "listed" ? (
        <p className="mt-1 text-text-hi">
          This one is in{" "}
          <Link href="/dungeons" className="text-accent underline">
            the Hall
          </Link>
          .
        </p>
      ) : state === "submitted" ? (
        <p className="mt-1 text-text-hi">
          Waiting to be read. Somebody looks at every one of these by hand, so it is not instant.
        </p>
      ) : state === "banned" ? (
        <p className="mt-1 text-text-hi">
          This one was taken down. The link still works for you and nothing on the site points at
          it.
        </p>
      ) : (
        <>
          <p className="mt-1 text-text-mid">
            Anybody with the link can play it. The Hall out front is a shelf somebody fills by
            hand, and you can ask for a place on it.
          </p>
          <Button variant="secondary" className="mt-3" onClick={ask} disabled={busy}>
            {busy ? "Asking…" : "Ask for a place in the Hall"}
          </Button>
        </>
      )}
      <ErrorNote message={error} />
      <Log code={code} />
    </div>
  );
}

type LogData = {
  predicted: number | null;
  observed: number | null;
  plays: number;
  finished: number;
  meanScore: number | null;
  par: number | null;
  stops: { floor: number; title: string; count: number }[];
};

/**
 * What the solver said, and what people actually did.
 *
 * The gate solves for PERFECT play, which is what makes par mean something and
 * what makes the search fast, and it is therefore always optimistic. This is the
 * correction, and the gap between the two numbers is the single most useful
 * thing an author can be shown.
 *
 * Behind a `<details>` and fetched on open: it is the only thing on this page
 * that costs a query, and most visits are somebody about to play rather than the
 * author checking in.
 */
function Log({ code }: { code: string }) {
  const [data, setData] = useState<LogData | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <details
      className="mt-4"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open || data) return;
        void getJson<LogData>(`/api/dungeons/${code}/log`)
          .then(setData)
          .catch(() => setError("Could not read the log."));
      }}
    >
      <summary className="cursor-pointer text-sm text-accent">How it is actually going</summary>
      {error && <ErrorNote message={error} />}
      {!data && !error && <p className="mt-2 text-sm text-text-low">Reading…</p>}
      {data && (
        <div className="mt-2 space-y-2 text-sm">
          {data.plays === 0 ? (
            <p className="text-text-mid">Nobody has played it yet.</p>
          ) : (
            <>
              <p className="num text-text-hi">
                {data.finished} of {data.plays} got out
                {data.observed !== null && ` (${Math.round(data.observed * 100)}%)`}.
                {data.predicted !== null && (
                  <>
                    {" "}
                    The solver said {Math.round(data.predicted * 100)}% would, playing perfectly.
                  </>
                )}
              </p>
              {data.predicted !== null && data.observed !== null && data.plays >= 10 && (
                <p className="text-text-mid">
                  {data.observed < data.predicted - 0.2
                    ? "Harder in practice than on paper, which is normal: the solver never misreads a room."
                    : data.observed > data.predicted + 0.1
                      ? "Easier in practice than the solver expected, which usually means one option is doing all the work."
                      : "About where the solver put it."}
                </p>
              )}
              {data.meanScore !== null && data.par !== null && (
                <p className="num text-text-mid">
                  Average score {data.meanScore.toFixed(1)} against a par of {data.par}.
                </p>
              )}
              {data.stops.length > 0 && (
                <div>
                  <p className="label-caps">Where the rest stopped</p>
                  <ul className="mt-1 space-y-0.5">
                    {data.stops.map((s) => (
                      <li key={s.floor} className="num text-text-mid">
                        Floor {s.floor}, {s.title}: {s.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}
