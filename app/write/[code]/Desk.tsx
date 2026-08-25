"use client";

/**
 * THE DESK. Where somebody writes a dungeon.
 *
 * The layout is the answer to this feature's biggest risk, which is not
 * moderation and is not the technical work: authoring is writing about eighty
 * short strings, and whether that reads as craft or as data entry is decided
 * almost entirely by what sits where.
 *
 * So: THE RECKONING IS STICKY. The solver's verdict sits beside the work and
 * moves as you touch it, and you are never typing into a void. And every empty
 * slot offers somebody else's room BEFORE a blank card, because nobody abandons
 * an edit and plenty of people abandon a blank form.
 *
 * The parchment/dark split is the product's existing thesis applied: your floors
 * are on paper because they are yours, and the solver answers from the dark,
 * like everything else in this game that is not you.
 *
 * No import of lib/campaign/gate here. That module runs the solver and the
 * solver knows the answer; the desk asks the server for a verdict like anybody
 * else. lib/game/rules is imported for the ability labels, which is six words.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Announcer, Button, Card, ErrorNote, Pill, Spinner } from "@/components/ui";
import { getJson, postJson } from "@/components/client";
import { ABILITY_LABEL } from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";
import { readingOf, targetsFor, wordForTarget } from "@/lib/daily/targets";
import { FAILED_CHECK_EXTRA } from "@/lib/daily/core";

type Option = {
  id: string;
  label: string;
  kind: "check" | "brace";
  ability?: Ability;
  tn?: number;
  vigour?: number;
  sets?: string[];
  needs?: string[];
  forbids?: string[];
  promise: string;
  win: string;
  lose: string;
};
type Room = {
  id: string;
  band: 1 | 2 | 3;
  boss?: boolean;
  title: string;
  setup: string;
  options: Option[];
};
type Draft = {
  code: string;
  title: string;
  /** The byline. Carried so "take a copy" can open the new draft under the same name. */
  authorName: string;
  intro: string;
  rooms: Room[];
  callingIds: string[];
  kitIds: string[];
  baseVigour: number;
  publishedAt: string | null;
  /**
   * The verdict frozen at publish, when there is one.
   *
   * A published desk never solves again, so this is where its par comes from: the
   * numbers on the row are the numbers everybody with the link is playing
   * against, and re-running the gate to print them would be asking a question
   * whose answer is already in the payload.
   */
  report?: Report | null;
};
type Note = { severity: "block" | "warn" | "good"; text: string; floor?: number };
type Report = {
  ok: boolean;
  par: number;
  builds: number;
  out: number;
  difficulty: string;
  wallFloor: number | null;
  notes: Note[];
  summary: string;
};
type PoolEntry = { id: string; authorName: string; room: Room; pickups: number };

const CALLINGS = [
  ["warden", "WARDEN"],
  ["knife", "KNIFE"],
  ["hedgewitch", "HEDGE-WITCH"],
  ["chanter", "CHANTER"],
  ["reckoner", "RECKONER"],
  ["houndmaster", "HOUNDMASTER"],
  ["sapper", "SAPPER"],
  ["oathbound", "OATHBOUND"],
] as const;

const KIT = [
  ["tarred-rope", "Tarred Rope"],
  ["whetstone", "Whetstone"],
  ["cracked-mirror", "Cracked Mirror"],
  ["pitch-torches", "Pitch Torches"],
  ["names-ledger", "Names Ledger"],
  ["sounding-line", "Sounding Line"],
  ["spare-bowstring", "Spare Bowstring"],
] as const;

/** The difficulty word fills the number in. Behind a disclosure, it nudges. */
/**
 * COST follows the band, and the TARGET follows the die.
 *
 * The band is how deep the floor is, which is a thing the author decides, so it
 * sets the price. The target is how hard a check is, which is not a thing the
 * author can decide on their own: the die was thrown from the dungeon's code
 * before anybody chose a door, so "hard" only means anything relative to it. See
 * lib/daily/targets.ts for what a fixed band table did to the house's own demo.
 */
const COST: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 4 };
const BAND_WORD: Record<1 | 2 | 3, string> = { 1: "Shallow", 2: "Middling", 3: "Deep" };


/**
 * MARKS, on one door.
 *
 * Three comma-separated text boxes rather than a tag widget with autocomplete.
 * Not laziness about the UI: an author writing "wet, seen" in a box gets it right
 * first time, and the mistake a tag widget prevents (two spellings of one word) is
 * caught properly by the gate, which can say "wet is handed out and never asked
 * for" with the whole dungeon in view. A widget can only ever guess.
 *
 * Collapsed by default. Most doors have no marks at all and the form is already
 * long.
 */
function Marks({
  door,
  option,
  onChange,
}: {
  door: number;
  option: Option;
  onChange: (patch: Partial<Option>) => void;
}) {
  const words = (list: string[] | undefined) => (list ?? []).join(", ");
  const parse = (raw: string) =>
    raw
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 3);
  const any =
    (option.sets?.length ?? 0) + (option.needs?.length ?? 0) + (option.forbids?.length ?? 0) > 0;

  const field = (
    label: string,
    hint: string,
    key: "sets" | "needs" | "forbids"
  ) => (
    <label className="block">
      <span className="sheet-label">{label}</span>
      <input
        type="text"
        value={words(option[key])}
        placeholder={hint}
        aria-label={`Door ${door + 1}: ${label}`}
        onChange={(e) => onChange({ [key]: parse(e.target.value) } as Partial<Option>)}
        className="mt-1 min-h-11 w-full rounded border border-paper-rule bg-paper-field px-3 text-sm text-paper-ink"
      />
    </label>
  );

  return (
    <details className="mt-3" open={any}>
      <summary className="cursor-pointer text-xs text-paper-ink-mid">
        Marks {any ? "· set on this door" : "· nothing yet"}
      </summary>
      <p className="mt-2 text-xs text-paper-ink-mid">
        A mark is a word you invent: wet, seen, carrying the lamp. This is the only way one floor
        can change a later one. Separate several with commas, and keep one way through every floor
        open to somebody carrying nothing.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {field("They come away", "wet", "sets")}
        {field("Only if they are", "carrying the lamp", "needs")}
        {field("Not if they are", "seen", "forbids")}
      </div>
      <p className="mt-1 text-xs text-paper-ink-mid">
        They only come away with something from a door that worked.
      </p>
    </details>
  );
}

/** Which word a target sits on for THIS floor's die, so the select tells the truth. */
function wordFor(die: number, tn: number): string {
  return wordForTarget(die, tn);
}

/** A floor with no die yet (a fresh slot) gets a middling one to work against. */
const DIE_UNKNOWN = 10;

let nextId = 0;
const freshId = (p: string) => `${p}-${Date.now().toString(36)}-${nextId++}`;

/** A button that is really a link. Used by every "here is a way on" on this screen. */
const WAY_ON =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-4 text-sm text-text-mid hover:border-accent/50";

/**
 * Save a draft, and throw if the server did not take it.
 *
 * The `res.ok` check is the whole point. The autosave used to fire and forget,
 * so the PUT's 409 on a published dungeon went nowhere: the desk stayed
 * editable, every keystroke was thrown away by the server, and the author was
 * told nothing until they reloaded and found their afternoon gone. Any refusal
 * the route can give (409 frozen, 403 not yours, 429 rate limited) now reaches
 * the screen in the route's own words.
 */
async function saveDraft(code: string, d: Draft): Promise<void> {
  const res = await fetch(`/api/dungeons/${code}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: d.title,
      intro: d.intro,
      rooms: d.rooms,
      callingIds: d.callingIds,
      kitIds: d.kitIds,
      baseVigour: d.baseVigour,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      data?.error ?? "Could not save that, so nothing you have typed since is on the server."
    );
  }
}

function blankRoom(): Room {
  return {
    id: freshId("r"),
    band: 2,
    title: "",
    setup: "",
    options: [
      { id: freshId("o"), label: "", kind: "check", ability: "brawn", tn: 15, vigour: 3, promise: "", win: "", lose: "" },
      { id: freshId("o"), label: "", kind: "check", ability: "wits", tn: 15, vigour: 3, promise: "", win: "", lose: "" },
      { id: freshId("o"), label: "", kind: "brace", vigour: 3, promise: "", win: "", lose: "" },
    ],
  };
}

export function Desk({ code }: { code: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  /**
   * The dice this dungeon has already thrown, one per possible floor.
   *
   * Sent with the draft rather than worked out here: `dieFor` lives in the module
   * that holds every room's win and lose prose, and a client component must never
   * import it. They never change, because they come from the code.
   */
  const [dice, setDice] = useState<number[]>([]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [link, setLink] = useState<string | null>(null);
  /**
   * Why the desk did not open, when it did not.
   *
   * Kept apart from `error`, which is for a save or a publish that failed while
   * you were working and leaves the desk standing. These two END the screen, so
   * they owe you a sentence and somewhere to go: one red strip on an otherwise
   * blank page reads as a broken site rather than as somebody else's dungeon.
   */
  const [shut, setShut] = useState<"not-yours" | "missing" | null>(null);

  useEffect(() => {
    void getJson<{ mine: boolean; draft?: Draft; dice?: number[] }>(`/api/dungeons/${code}`)
      .then((d) => {
        if (!d.mine || !d.draft) {
          setShut("not-yours");
          return;
        }
        setDraft(d.draft);
        setDice(d.dice ?? []);
        // A published one is frozen and will never solve again, so its stored
        // verdict is the reckoning. Without this the desk sat on "Working it out"
        // for a dungeon whose par has been decided since the day it went out.
        if (d.draft.report) setReport(d.draft.report);
        // "Take a copy" navigates while still busy, so the desk it lands on is
        // what ends that. Otherwise a reused component instance would arrive with
        // every button disabled.
        setBusy(false);
      })
      .catch(() => setShut("missing"));
    void getJson<{ pool: PoolEntry[] }>("/api/dungeons")
      .then((d) => setPool(d.pool ?? []))
      .catch(() => setPool([]));
  }, [code]);

  /**
   * What could move par, as a string.
   *
   * Prose cannot, so typing prose must never ask the server for a verdict. This
   * is what stops an afternoon of writing being an afternoon of solves, and it
   * is four lines.
   */
  const mechanical = useMemo(() => {
    if (!draft) return "";
    return JSON.stringify([
      draft.baseVigour,
      draft.callingIds,
      draft.kitIds,
      draft.rooms.map((r) => [
        r.band,
        r.options.map((o) => [
          o.kind,
          o.ability ?? "",
          o.tn ?? 0,
          o.vigour ?? 0,
          // Marks are mechanics, not prose: change one and par can move, so the
          // desk owes the author a fresh solve.
          (o.sets ?? []).join("&"),
          (o.needs ?? []).join("&"),
          (o.forbids ?? []).join("&"),
        ]),
      ]),
    ]);
  }, [draft]);

  const lastSolved = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: Draft, solve: boolean) => {
      try {
        await saveDraft(code, next);
        // A save that worked clears whatever the last one said, so a warning
        // about words that were not kept cannot outlive the words being kept.
        setError(null);
        if (!solve) return;
        const r = await postJson<Report>(`/api/dungeons/${code}/report`, {});
        setReport(r);
        setAnnounce(r.summary);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [code]
  );

  // Save always, solve only when the mechanics moved.
  useEffect(() => {
    if (!draft) return;
    /**
     * A published dungeon never autosaves.
     *
     * The route refuses one with a 409 by design, so this timer was firing a
     * request per keystroke that the server threw away. The desk is read-only in
     * that state now, but the guard belongs here as well: this is the effect that
     * would otherwise go on quietly pretending the work was being kept.
     */
    if (draft.publishedAt) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const solve = mechanical !== lastSolved.current;
    saveTimer.current = setTimeout(() => {
      if (solve) lastSolved.current = mechanical;
      void persist(draft, solve);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, mechanical, persist]);

  if (shut) return <Shut kind={shut} code={code} />;
  if (!draft) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Opening the desk" />
      </div>
    );
  }

  const edit = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const editRoom = (i: number, patch: Partial<Room>) => {
    const rooms = [...draft.rooms];
    rooms[i] = { ...rooms[i], ...patch };
    edit({ rooms });
  };
  const editOption = (i: number, j: number, patch: Partial<Option>) => {
    const rooms = [...draft.rooms];
    const options = [...rooms[i].options];
    options[j] = { ...options[j], ...patch };
    rooms[i] = { ...rooms[i], options };
    edit({ rooms });
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.rooms.length) return;
    const rooms = [...draft.rooms];
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
    edit({ rooms });
    setAnnounce(`${rooms[j].title || "That floor"} is now floor ${i + 1}`);
  };

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ ok: boolean; code: string }>(`/api/dungeons/${code}/publish`, {});
      if (res.ok) {
        setLink(`${window.location.origin}/d/${res.code}`);
        /**
         * The desk freezes the moment it publishes.
         *
         * The row on the server now has a publishedAt and refuses every save, and
         * the local copy did not know: the author carried on typing into a form
         * whose every keystroke was being turned away.
         */
        setDraft((d) => (d ? { ...d, publishedAt: new Date().toISOString() } : d));
        setAnnounce("Published. The desk is read only now, and there is a link to the door.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * TAKE A COPY: the only way to change something already out there.
   *
   * No copy endpoint, and it does not need one. Opening a draft and saving these
   * rooms into it is the same two requests the desk already makes every few
   * seconds, where a server-side clone would be a third code path to keep in step
   * with the save schema. The copy gets its own code, so it throws its own dice
   * and the published one's par is left exactly where the leaderboard left it,
   * which is the entire reason the original is frozen.
   */
  async function takeCopy(from: Draft) {
    setBusy(true);
    setError(null);
    try {
      // Sliced to the byline's own limit: a signed-in profile name can be longer
      // than the create route accepts, and the route prefers the profile anyway,
      // so this only ever feeds the guest path.
      const made = await postJson<{ code: string }>("/api/dungeons", {
        name: from.authorName.slice(0, 20),
      });
      await saveDraft(made.code, { ...from, title: `${from.title} again`.slice(0, 80) });
      router.push(`/write/${made.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** Out in the world, therefore frozen: read the desk, do not write on it. */
  const frozen = !!draft.publishedAt;
  const canPublish = !!report?.ok && draft.title.trim().length > 0 && !frozen;

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border-dim pb-4">
        <div>
          <p className="label-caps">The desk · {frozen ? "published, and read only" : "a draft"}</p>
          <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi">
            {draft.title || "Something new"}
          </h1>
        </div>
        <span className="num rounded-md border border-border-strong px-3 py-1 text-sm text-accent">
          {draft.code}
        </span>
      </header>

      {/*
       * PUBLISHED, SO THE DESK IS SHUT.
       *
       * This said nothing at all: the form opened as normal, every autosave was
       * turned away by the route with a 409, and an author could write a floor and
       * lose it. The reason is worth the paragraph, because being told "no" without
       * being told why is what makes somebody try it again in another browser.
       */}
      {frozen && (
        <Card className="mb-5 border-accent/60 bg-accent-dim">
          <p className="label-caps">Out in the world</p>
          <p className="prose-read mt-1 text-text-hi">
            You can read this one but not change it. Its dice are pinned and its par is the number
            everybody who has the link is playing against, so an edit now would move the target
            under somebody who is halfway down. A copy has its own code and throws its own dice,
            and you can do what you like to it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => void takeCopy(draft)}>
              {busy ? "Taking a copy" : "Take a copy and write on that"}
            </Button>
            <Link href={`/d/${draft.code}`} className={WAY_ON}>
              Go and look at the door
            </Link>
          </div>
          {/* Beside the button that failed. The reckoning shows nothing while
              frozen, so this is the only place a copy going wrong can land. */}
          {error && (
            <div className="mt-3">
              <ErrorNote message={error} />
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/*
         * One disabled fieldset is the whole read-only mode.
         *
         * Native: every input, select, textarea and button inside it stops taking
         * input and announces itself as disabled, which a hand-rolled `readOnly`
         * pass over forty fields would only approximate. The floors still open, so
         * a published dungeon is still there to read.
         */}
        <fieldset disabled={frozen} className="min-w-0">
          {/* ------------------------------------------------ the settings */}
          <section className="mb-7">
            <h2 className="label-caps mb-2">One. The rules of this one</h2>
            <Card>
              <label className="block">
                <span className="label-caps mb-1 block">Title</span>
                <input
                  type="text"
                  value={draft.title}
                  maxLength={80}
                  onChange={(e) => edit({ title: e.target.value })}
                  className="min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-3 text-base text-text-hi"
                />
              </label>

              <label className="mt-4 block">
                <span className="label-caps mb-1 block">
                  What they should know before they build
                </span>
                <textarea
                  value={draft.intro}
                  maxLength={600}
                  rows={3}
                  onChange={(e) => edit({ intro: e.target.value })}
                  className="w-full rounded-md border border-border-input bg-bg-0 px-3 py-2 text-base text-text-hi"
                />
                <span className="mt-1 block text-xs text-text-low">
                  Shown on the door, before anybody makes a character. {draft.intro.length} of 600.
                </span>
              </label>

              <Toggles
                legend="Callings on the table"
                hint="Fewer means a narrower dungeon. Three is the daily's own number, four is the most."
                items={CALLINGS.map(([id, name]) => ({ id, name }))}
                chosen={draft.callingIds}
                onChange={(callingIds) => edit({ callingIds })}
              />
              <Toggles
                legend="On the shelf"
                hint="They take two of these with them. Six is the most."
                items={KIT.map(([id, name]) => ({ id, name }))}
                chosen={draft.kitIds}
                onChange={(kitIds) => edit({ kitIds })}
              />

              <fieldset className="mt-4">
                <legend className="label-caps mb-1">Vigour they start with</legend>
                <div className="flex flex-wrap gap-2">
                  {[7, 9, 11].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={draft.baseVigour === v}
                      onClick={() => edit({ baseVigour: v })}
                      className={`min-h-11 rounded-md border px-4 ${
                        draft.baseVigour === v
                          ? "border-accent bg-accent-dim text-text-hi"
                          : "border-border-strong bg-bg-2 text-text-mid"
                      }`}
                    >
                      <span aria-hidden className="mr-1.5 font-mono text-xs">
                        {draft.baseVigour === v ? "✓" : "○"}
                      </span>
                      {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Card>
          </section>

          {/* -------------------------------------------------- the floors */}
          <section>
            <h2 className="label-caps mb-2">Two. The way down</h2>

            {draft.rooms.map((room, i) => (
              <Floor
                key={room.id}
                room={room}
                index={i}
                die={dice[i] ?? DIE_UNKNOWN}
                last={i === draft.rooms.length - 1}
                flagged={report?.notes.filter((n) => n.floor === i + 1) ?? []}
                onEdit={(patch) => editRoom(i, patch)}
                onOption={(j, patch) => editOption(i, j, patch)}
                onMove={(by) => move(i, by)}
                onRemove={() => edit({ rooms: draft.rooms.filter((_, k) => k !== i) })}
              />
            ))}

            {/* Not offered at all on a published one: a disabled pair of buttons
                that can never come back is furniture. */}
            {draft.rooms.length < 8 && !frozen && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    const room = pick
                      ? { ...pick.room, id: `p-${pick.id}` }
                      : { ...blankRoom(), title: "A floor of your own" };
                    edit({ rooms: [...draft.rooms, room] });
                    setAnnounce(pick ? `Took ${pick.room.title} from the shelf` : "Added an empty floor");
                  }}
                >
                  Take one from the house
                </Button>
                <Button variant="secondary" onClick={() => edit({ rooms: [...draft.rooms, blankRoom()] })}>
                  Write one of your own
                </Button>
              </div>
            )}

            <p className="mt-3 text-sm text-text-low">
              Three floors is a legal dungeon and eight is the most the solver will take. Every
              slot opens on somebody else&rsquo;s work, because nobody abandons an edit and
              plenty of people abandon a blank card.
            </p>
          </section>
        </fieldset>

        {/* ------------------------------------------------ the reckoning */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="label-caps mb-2">Three. The reckoning</h2>
          <Card className="border-border-strong">
            <p className="label-caps">The verdict</p>
            <p
              className={`font-display mt-1 text-2xl ${
                report ? (report.ok ? "text-success" : "text-danger") : "text-text-mid"
              }`}
            >
              {report ? (report.ok ? "It holds." : "Not yet.") : "Working it out"}
            </p>
            {report?.ok && (
              <span className="num mt-1 inline-block rounded border border-border-strong px-2 py-1 text-xs uppercase tracking-widest text-accent">
                {report.difficulty}
              </span>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Figure label="Par" value={report?.ok ? String(report.par) : PENDING} />
              <Figure
                label="Get out"
                value={report && report.builds > 0 ? `${report.out}/${report.builds}` : PENDING}
              />
            </div>

            <ul aria-live="polite" className="mt-4 space-y-2">
              {(report?.notes ?? []).map((n, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  {/* Never colour alone: the glyph and the words both say it. */}
                  <span
                    aria-hidden
                    className={`font-mono ${
                      n.severity === "block"
                        ? "text-danger"
                        : n.severity === "warn"
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {n.severity === "block" ? "✕" : n.severity === "warn" ? "▲" : "✓"}
                  </span>
                  <span className={n.severity === "block" ? "text-text-hi" : "text-text-mid"}>
                    {n.text}
                  </span>
                </li>
              ))}
            </ul>

            {report?.ok && <p className="mt-3 text-sm text-text-mid">{report.summary}</p>}
            {/* While frozen the only thing that can fail is the copy, and the copy
                button is at the top of the screen with an ErrorNote of its own.
                Two role="alert" strips for one failure announce it twice. */}
            {!frozen && <ErrorNote message={error} />}

            {link || frozen ? (
              <div className="mt-4 rounded-md border border-accent/60 bg-accent-dim p-3">
                <p className="label-caps">It is out there</p>
                {link && <p className="mt-1 break-all text-sm text-text-hi">{link}</p>}
                <Link href={`/d/${draft.code}`} className="mt-2 inline-block text-sm text-accent underline">
                  Go and look at the door
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {/*
                 * The licence, and the one paragraph on the desk with legal weight.
                 * It was set in paper ink on a dark card, which measures about
                 * 2.1:1, so the terms nobody could read were the terms they were
                 * agreeing to. Dark-surface ink, and the link takes the accent so
                 * it reads as something you can press.
                 */}
                <p className="mb-2 text-xs text-text-mid">
                  Publishing keeps this yours and gives me permission to host it and show it, for
                  as long as it is up. Your own writing only, and nothing you would not want a
                  stranger to open. The{" "}
                  <a href="/terms" className="text-accent underline">
                    terms
                  </a>{" "}
                  say it in five sentences.
                </p>
                <Button size="lg" disabled={!canPublish || busy} onClick={() => void publish()}>
                  {/* It has to say what it does. "Keep it and take the link" was the
                      only control on the screen that publishes, and the paragraph
                      above it talks about publishing, so the two did not meet. */}
                  {canPublish
                    ? "Publish it and take the link"
                    : !report
                      ? "Still working it out"
                      : !report.ok
                        ? "Fix the blocks first"
                        : "Give it a name first"}
                </Button>
                <Link
                  href={`/d/${draft.code}?preview=1`}
                  className={WAY_ON}
                >
                  Play it yourself first
                </Link>
              </div>
            )}

            {!frozen && (
              <p className="mt-3 text-xs text-text-low">
                Prose never moves par, so typing never re-runs this. Changing a door, a depth or a
                mark does.
              </p>
            )}
          </Card>
        </aside>
      </div>

      <Announcer message={announce} />
    </div>
  );
}

/**
 * What both headline figures said before the first solve landed: an em-dash.
 *
 * Which is not a character this product's copy uses, and told a first-time author
 * nothing at all about whether the number was zero, broken or on its way.
 */
const PENDING = "Not worked out yet";

function Figure({ label, value }: { label: string; value: string }) {
  // A word standing where a number goes does not get the number's size: PENDING
  // at 28px in tabular mono would break the two-column grid on a phone, and it is
  // running text rather than a figure anyway.
  const digits = /^[\d/]+$/.test(value);
  return (
    <div className="rounded-md border border-border-dim bg-bg-2 px-3 py-2">
      <div className="label-caps">{label}</div>
      <div className={digits ? "num text-2xl text-text-hi" : "text-sm text-text-mid"}>{value}</div>
    </div>
  );
}

/**
 * The desk did not open. Two reasons, both of which end the screen.
 *
 * This was one red ErrorNote on an otherwise empty page, which is the shape of a
 * site that has fallen over rather than of a code that belongs to somebody else.
 * Say which of the two it is, and give the three places worth going next.
 */
function Shut({ kind, code }: { kind: "not-yours" | "missing"; code: string }) {
  const someoneElses = kind === "not-yours";
  return (
    <section className="mx-auto w-full max-w-xl py-16">
      <Card className="border-border-strong">
        <p className="label-caps">The desk stayed shut</p>
        <h1 className="font-display mt-1 text-2xl font-bold uppercase text-text-hi">
          {someoneElses ? "Somebody else wrote that one" : "No dungeon by that name"}
        </h1>
        <p className="prose-read mt-3 text-text-mid">
          {someoneElses
            ? `${code} exists, and only the person who wrote it can change it. You can still go down it.`
            : `Nothing answers to ${code}. Either the code has a letter wrong in it, or that one has been taken down.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {someoneElses && (
            <Link href={`/d/${code}`} className={WAY_ON}>
              Go and look at the door
            </Link>
          )}
          <Link href="/write" className={WAY_ON}>
            Write one of your own
          </Link>
          <Link href="/dungeons" className={WAY_ON}>
            See what else is down there
          </Link>
        </div>
      </Card>
    </section>
  );
}

function Toggles({
  legend,
  hint,
  items,
  chosen,
  onChange,
}: {
  legend: string;
  hint: string;
  items: { id: string; name: string }[];
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="label-caps mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const on = chosen.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? chosen.filter((x) => x !== it.id) : [...chosen, it.id])}
              className={`min-h-11 rounded-md border px-3 text-sm ${
                on ? "border-accent bg-accent-dim text-text-hi" : "border-border-strong bg-bg-2 text-text-mid"
              }`}
            >
              <span aria-hidden className="mr-1.5 font-mono text-xs">
                {on ? "✓" : "○"}
              </span>
              {it.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-text-low">{hint}</p>
    </fieldset>
  );
}

/**
 * One floor, on parchment.
 *
 * A native `<details>` rather than a bespoke accordion, because it collapses
 * without JavaScript, it is keyboard-operable for free, and a screen reader
 * already knows what it is.
 */
function Floor({
  room,
  index,
  die,
  last,
  flagged,
  onEdit,
  onOption,
  onMove,
  onRemove,
}: {
  room: Room;
  index: number;
  /**
   * The die this floor has ALREADY thrown, from the dungeon's code.
   *
   * The most useful fact on the desk and the one an author cannot get by reading
   * their own writing. It is what makes the three difficulty words mean anything:
   * see lib/daily/targets.ts for what a fixed band table did to the house's own
   * demo dungeon.
   */
  die: number;
  last: boolean;
  flagged: Note[];
  onEdit: (patch: Partial<Room>) => void;
  onOption: (j: number, patch: Partial<Option>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  /**
   * The door list on a collapsed floor, in the words the play screen uses.
   *
   * It printed "brace", which is the word the schema uses for a door that always
   * works and appears nowhere a player can see. Read off `kind` rather than off a
   * missing ability, so an option carrying a stale ability cannot mislabel itself.
   */
  const doors = room.options
    .map((o) => (o.kind === "brace" || !o.ability ? "always works" : ABILITY_LABEL[o.ability]))
    .join(" · ");
  return (
    <div className="sheet mb-3">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3">
          <span className="num rounded border border-paper-rule px-2 py-0.5 text-xs text-paper-ink-mid">
            {index + 1}
          </span>
          <span className="font-display min-w-0 flex-1 truncate text-paper-ink">
            {room.title || "Empty slot"}
          </span>
          {flagged.length > 0 && <Pill tone="warning">{flagged.length} to look at</Pill>}
          <span className="num hidden text-xs text-paper-ink-mid sm:inline">{doors}</span>
        </summary>

        <div className="border-t border-paper-rule p-4">
          {flagged.map((n, i) => (
            <p key={i} className="mb-2 text-sm text-paper-ink">
              <span aria-hidden className="mr-1 font-mono">▲</span>
              {n.text}
            </p>
          ))}

          <label className="block">
            <span className="sheet-label">What it is called</span>
            <input
              type="text"
              value={room.title}
              maxLength={80}
              onChange={(e) => onEdit({ title: e.target.value })}
              className="min-h-11 w-full rounded border border-paper-rule bg-paper-field px-3 text-paper-ink"
            />
          </label>

          <label className="mt-3 block">
            <span className="sheet-label">What they walk into</span>
            <textarea
              value={room.setup}
              rows={2}
              maxLength={600}
              onChange={(e) => onEdit({ setup: e.target.value })}
              className="w-full rounded border border-paper-rule bg-paper-field px-3 py-2 text-paper-ink"
            />
          </label>

          {/* A ruled box you read, not a well you write in, so it takes the
              sheet's own read-box class rather than the field tint. */}
          <p className="sheet-box mt-3 p-2 text-sm text-paper-ink">
            <span aria-hidden className="mr-1 font-mono">&#9860;</span>
            {readingOf(die)}
          </p>

          <label className="mt-3 block">
            <span className="sheet-label">How deep this one is</span>
            <select
              value={room.band}
              onChange={(e) => {
                const band = Number(e.target.value) as 1 | 2 | 3;
                // The word fills the number in, so changing the depth re-fills every
                // door on the floor rather than leaving stale targets behind.
                // Depth sets the PRICE. It no longer touches the targets, because a
                // target only means anything against this floor's die and the die
                // does not change when the author decides the floor is deeper.
                onEdit({
                  band,
                  options: room.options.map((o) => ({ ...o, vigour: COST[band] })),
                });
              }}
              className="min-h-11 rounded border border-paper-rule bg-paper-field px-3 text-paper-ink"
            >
              {([1, 2, 3] as const).map((b) => (
                <option key={b} value={b}>
                  {BAND_WORD[b]}
                </option>
              ))}
            </select>
          </label>

          {room.options.map((o, j) => (
            <div key={o.id} className="mt-4 border-t border-paper-rule pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="sheet-label">Door {j + 1}</span>
                {o.kind === "check" ? (
                  <>
                    <select
                      aria-label={`Which ability door ${j + 1} asks for`}
                      value={o.ability}
                      onChange={(e) => onOption(j, { ability: e.target.value as Ability })}
                      className="min-h-11 rounded border border-paper-rule bg-paper-field px-2 text-paper-ink"
                    >
                      {ABILITIES.map((a) => (
                        <option key={a} value={a}>
                          {ABILITY_LABEL[a]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`How hard door ${j + 1} is`}
                      value={wordFor(die, o.tn ?? targetsFor(die).fair)}
                      onChange={(e) =>
                        onOption(j, {
                          tn: targetsFor(die)[e.target.value as "easy" | "fair" | "hard"],
                        })
                      }
                      className="min-h-11 rounded border border-paper-rule bg-paper-field px-2 text-paper-ink"
                    >
                      <option value="easy">most get through</option>
                      <option value="fair">about half</option>
                      <option value="hard">few do</option>
                    </select>
                    <span className="num text-xs text-paper-ink-mid">
                      needs {o.tn}, this floor throws {die}, costs{" "}
                      {(o.vigour ?? 0) + FAILED_CHECK_EXTRA} if it goes wrong
                    </span>
                  </>
                ) : (
                  <span className="num text-xs text-paper-ink-mid">
                    always works and clears the floor, costs {o.vigour} every time
                  </span>
                )}
              </div>

              <input
                type="text"
                placeholder="What they try"
                aria-label={`What door ${j + 1} is called`}
                value={o.label}
                maxLength={80}
                onChange={(e) => onOption(j, { label: e.target.value })}
                className="min-h-11 w-full rounded border border-paper-rule bg-paper-field px-3 text-paper-ink"
              />
              <input
                type="text"
                placeholder="In their own words, before they know if it works"
                aria-label={`What door ${j + 1} promises`}
                value={o.promise}
                maxLength={200}
                onChange={(e) => onOption(j, { promise: e.target.value })}
                className="mt-2 min-h-11 w-full rounded border border-paper-rule bg-paper-field px-3 text-sm text-paper-ink"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea
                  placeholder="It works"
                  aria-label={`What happens when door ${j + 1} works`}
                  value={o.win}
                  rows={2}
                  maxLength={400}
                  onChange={(e) =>
                    onOption(j, o.kind === "brace" ? { win: e.target.value, lose: e.target.value } : { win: e.target.value })
                  }
                  className="w-full rounded border border-paper-rule bg-paper-field px-3 py-2 text-sm text-paper-ink"
                />
                {o.kind === "check" ? (
                  <textarea
                    placeholder="It does not"
                    aria-label={`What happens when door ${j + 1} does not work`}
                    value={o.lose}
                    rows={2}
                    maxLength={400}
                    onChange={(e) => onOption(j, { lose: e.target.value })}
                    className="w-full rounded border border-paper-rule bg-paper-field px-3 py-2 text-sm text-paper-ink"
                  />
                ) : (
                  // A brace always works, so it has one ending and writing a second
                  // would be writing something nobody can ever reach.
                  <p className="self-center text-xs text-paper-ink-mid">
                    This one always works, so it only has the one ending.
                  </p>
                )}
              </div>
              <Marks door={j} option={o} onChange={(patch) => onOption(j, patch)} />
            </div>
          ))}
        </div>
      </details>

      {/*
       * THE FLOOR'S OWN CONTROLS, OUTSIDE THE SUMMARY.
       *
       * They used to sit inside it, so a screen reader read the disclosure's name
       * as "Floor 3, empty slot, move floor 3 up, move floor 3 down, remove floor
       * 3", and Enter on the summary meant either open the floor or fire whichever
       * button had focus. Out here they are three plain buttons, and the click no
       * longer has to preventDefault its way out of toggling the disclosure.
       *
       * A strip on the sheet rather than absolutely positioned over the title row:
       * three 44px targets floating over a truncating title, a warning pill and the
       * door list is the layout that breaks at 360px and nobody notices. Costs a
       * second row per floor, which the reorder job is worth.
       */}
      <div className="flex items-center gap-1 border-t border-paper-rule px-3 py-2">
        <span className="sheet-label mr-auto">Floor {index + 1}</span>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Move floor ${index + 1} up`}
          className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label={`Move floor ${index + 1} down`}
          className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink disabled:opacity-40"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onRemove()}
          aria-label={`Remove floor ${index + 1}`}
          className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
