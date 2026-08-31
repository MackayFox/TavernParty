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
 *
 * IT IS ALSO THE FIRST PAGE A STRANGER EVER SEES of any of this, because it is
 * the one that goes in the group chat. So every house word it uses is glossed
 * where it is used (Calling, Kit, Vigour, brace, Mark, par) rather than assumed:
 * the audit found the whole page written in a vocabulary nobody had been taught,
 * and a rules list a first-time reader can follow is cheaper than a glossary
 * page nobody opens.
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

/**
 * THE BYLINE IS HOW THIS PAGE KNOWS THE HOUSE WROTE IT.
 *
 * `doorFor` does not carry `ownerKey`, and the alternative here was importing
 * DEMO_CODE from `lib/content/demo-dungeon.ts`, which would drag that file's
 * rooms, targets and all, into a browser bundle. On this page of all pages that
 * is the one thing that must never happen, so it is the name instead, matched
 * against the string `seed.ts` and `store.ts` both write.
 *
 * It matters because the page used to disclaim its own content: a stranger
 * landing on the house's own dungeon was told it was somebody else's writing and
 * offered a form to report it to me. If a second house dungeon ever gets a
 * different byline, the fix is a flag on `doorFor` rather than a second string.
 */
const HOUSE = "The house";

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
  const house = door.author === HOUSE;

  return (
    <section className="mx-auto w-full max-w-2xl py-8">
      <p className="label-caps">
        <span aria-hidden>🕯️ </span>
        {mine
          ? "Your dungeon, as everybody else sees it"
          : house
            ? "The house's own dungeon"
            : "Somebody else's dungeon"}
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

      {/*
        THE RULES LIST IS THE GLOSSARY, and doing it here rather than in a panel
        of its own is the whole decision. Every one of these words (Calling, Kit,
        Vigour, brace, Mark) was on the page already with nothing saying what it
        meant, and a stranger who has to click something to find out has been
        handed homework by a page that wanted a click on "Go down".
      */}
      <Card className="mt-5">
        <p className="label-caps">The rules of this one</p>
        <ul className="mt-2 space-y-1 text-text-hi">
          <li>
            {door.floors} floors, and something at the bottom of them.
          </li>
          <li>
            {door.callings} Callings on the table. A Calling is who you are down there: trained
            in two of the six abilities, with one trick you can use once.
          </li>
          <li>
            {door.kit} things on the shelf, and you take two. That is your Kit, and each piece
            says on it what it lends you.
          </li>
          <li>
            Vigour {door.baseVigour}
            {door.baseVigour === 9 ? ", which is standard" : door.baseVigour > 9 ? ", which is generous" : ", which is thin"}
            . Vigour is the wind you have: every door costs some, running out of it ends the run,
            and whatever is left is points if you come back up.
          </li>
          <li>
            Every floor has doors that test one ability against a die, and a brace, which always
            works, always costs Vigour, and always clears the floor.
          </li>
          <li>
            A door can leave a Mark on you, a word like wet or lit, and a door further down can
            want it or refuse it.
          </li>
          <li>
            Every room owns its die, and you only see the number once you are in the room. The
            same dungeon, and the same dice, for everybody who opens this link.
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {door.difficulty && <Pill tone="accent">{door.difficulty}</Pill>}
          {door.par !== null && (
            /*
              "Par 50" on its own said nothing about which way was good, and half
              the people who read it will have brought golf with them, where the
              number is a thing to get under. The clause travels with the number
              rather than sitting in the small print underneath, because the
              number is what a skimmer stops on.
            */
            <span className="text-sm text-text-mid">
              <span className="num">Par {door.par}</span>, the most anybody can score here
            </span>
          )}
          {share !== null && (
            <span className="num text-sm text-text-mid">
              {share}% of {door.plays} got out
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-text-low">
          {door.par !== null
            ? "The par and the difficulty were worked out by playing every character this dungeon allows, perfectly, not claimed by whoever wrote it. Nobody scores above par, so how near it you get is the game."
            : "The difficulty was worked out by playing every character this dungeon allows, not claimed by whoever wrote it."}
        </p>

        <Button size="lg" className="mt-4" onClick={() => setDown(true)}>
          Go down
        </Button>
      </Card>

      {mine && <Submit code={door.code} visibility={visibility} />}

      {/*
        THE INVITATION, and it was one clause in a footer.
        This is the page that gets shared, so it is the only page most people will
        ever see, and the desk is the thing this site has that nothing else does.
        Kept to what is true and checkable (a solver, two minutes off the shelf,
        no account) rather than turned up: an advert on somebody else's dungeon
        page is a worse advert than a plain description of the tool.
      */}
      <Card className="mt-6">
        <p className="label-caps">The desk</p>
        <p className="prose-read mt-2 text-text-hi">
          You can write one of these. Pick some floors, say what may be brought down, and send
          somebody the link. You do not have to write a word of it if you would rather not: the
          shelf is full of rooms other people wrote, and six of those is a real dungeon.
        </p>
        <p className="mt-2 text-sm text-text-mid">
          The same solver that put a par on this one runs over yours the moment you save, and
          tells you what par is, how many of the characters you allow get out alive, and which
          door nobody would ever take. It will not publish one nobody can finish. No account
          needed, and the link works the moment you publish.
        </p>
        <Link
          href="/write"
          className="font-display mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-bg-2 px-5 text-base font-medium text-text-hi hover:border-accent/50"
        >
          Open a desk
        </Link>
      </Card>

      <p className="mt-4 text-sm text-text-mid">
        <Link href="/daily/deeprun" className="text-accent underline">
          Tonight&rsquo;s official one
        </Link>{" "}
        is a different dungeon, and{" "}
        <Link href="/dungeons" className="text-accent underline">
          the Hall
        </Link>{" "}
        has the ones other people have written.
      </p>

      {/*
        Below the exits on purpose. It is a verdict on a run you have not had yet,
        so a stranger meeting it between the play button and the way out was being
        asked to rate something they had not played.
      */}
      <Mark code={door.code} standing={standing} marked={marked} />

      {house ? (
        <p className="mt-4 text-xs text-text-low">
          The house wrote this one, so there is nobody else to blame for it. If something in it is
          wrong,{" "}
          <Link
            href={`/contact?about=dungeon&code=${door.code}`}
            className="text-text-mid underline"
          >
            say so
          </Link>{" "}
          and I will fix it.
        </p>
      ) : (
        <p className="mt-4 text-xs text-text-low">
          Somebody wrote this, and it is their writing rather than mine. If it should not be up,{" "}
          <Link
            href={`/contact?about=dungeon&code=${door.code}`}
            className="text-text-mid underline"
          >
            tell me and I will read it myself
          </Link>
          . There is no button that hides a dungeon automatically, on purpose.
        </p>
      )}
    </section>
  );
}

/**
 * "Was it worth your time?"
 *
 * The page cannot know whether YOU finished: `doorFor` carries the counts and not
 * your own run, so for anybody who has been down there the button asks and the
 * honest 403 ("get to the bottom of it first") is the answer.
 *
 * WHAT IT CAN KNOW is whether anybody at all has finished, and if nobody has then
 * the button provably cannot work for the person reading it either, because a
 * mark row cannot exist without a finished run row. Offering it there was the
 * worst version of this: a fresh dungeon out of the desk, sent to somebody who
 * has never played it, whose second control is guaranteed to answer with an
 * error. So the count still shows and the control does not.
 *
 * The clean fix is a `finished` flag on the props, off `runOf(code, identity)`,
 * which would drop the 403 path entirely. That is a change to `page.tsx`.
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

  const nobody = count.finishers === 0;

  return (
    <div className="mt-6 rounded-lg border border-border-dim bg-bg-1 p-4">
      <p className="label-caps">What people made of it</p>
      <p className="num mt-1 text-text-hi">
        {nobody
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
        /* Arrives after a request rather than on the click, so it is announced. */
        <p role="status" className="mt-3 flex items-center gap-2 text-text-hi">
          <span aria-hidden>✓</span> You said it was good. That stands.
        </p>
      ) : nobody ? (
        <p className="mt-1 text-xs text-text-low">
          Whoever gets out first can say whether it was worth their time. Until somebody has,
          there is nothing here to press.
        </p>
      ) : (
        <>
          <Button variant="secondary" className="mt-3" onClick={say} disabled={busy}>
            {busy ? "Saying so…" : "It was worth my time"}
          </Button>
          <p className="mt-1 text-xs text-text-low">
            Only counts once you have got to the bottom of it yourself, and it does not toggle.
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
