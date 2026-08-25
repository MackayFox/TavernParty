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
import { Announcer, Button, Card, ErrorNote, Pill, Sheet, Spinner } from "@/components/ui";
import { getJson, postJson } from "@/components/client";
import { ABILITY_LABEL } from "@/lib/game/rules";
import { ABILITIES, type Ability } from "@/lib/game/types";

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
  intro: string;
  rooms: Room[];
  callingIds: string[];
  kitIds: string[];
  baseVigour: number;
  publishedAt: string | null;
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
const TN_TABLE: Record<1 | 2 | 3, Record<string, number>> = {
  1: { easy: 11, fair: 12, hard: 13 },
  2: { easy: 14, fair: 15, hard: 16 },
  3: { easy: 16, fair: 17, hard: 18 },
};
const COST: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 4 };
const BAND_WORD: Record<1 | 2 | 3, string> = { 1: "Shallow", 2: "Middling", 3: "Deep" };

/** Which word a target number currently sits on, so the select shows the truth. */
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
        className="mt-1 min-h-11 w-full rounded border border-paper-rule bg-white/40 px-3 text-sm text-paper-ink"
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

function wordFor(band: 1 | 2 | 3, tn: number): string {
  const table = TN_TABLE[band];
  const hit = Object.entries(table).find(([, v]) => v === tn);
  return hit ? hit[0] : "fair";
}

let nextId = 0;
const freshId = (p: string) => `${p}-${Date.now().toString(36)}-${nextId++}`;

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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    void getJson<{ mine: boolean; draft?: Draft }>(`/api/dungeons/${code}`)
      .then((d) => {
        if (!d.mine || !d.draft) {
          setError("That one is not yours to write.");
          return;
        }
        setDraft(d.draft);
      })
      .catch(() => setError("Could not find that draft."));
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
        await fetch(`/api/dungeons/${code}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: next.title,
            intro: next.intro,
            rooms: next.rooms,
            callingIds: next.callingIds,
            kitIds: next.kitIds,
            baseVigour: next.baseVigour,
          }),
        });
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

  if (error && !draft) return <ErrorNote message={error} />;
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
      if (res.ok) setLink(`${window.location.origin}/d/${res.code}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPublish = !!report?.ok && draft.title.trim().length > 0 && !draft.publishedAt;

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border-dim pb-4">
        <div>
          <p className="label-caps">The desk · a draft</p>
          <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi">
            {draft.title || "Something new"}
          </h1>
        </div>
        <span className="num rounded-md border border-border-strong px-3 py-1 text-sm text-accent">
          {draft.code}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
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
                last={i === draft.rooms.length - 1}
                flagged={report?.notes.filter((n) => n.floor === i + 1) ?? []}
                onEdit={(patch) => editRoom(i, patch)}
                onOption={(j, patch) => editOption(i, j, patch)}
                onMove={(by) => move(i, by)}
                onRemove={() => edit({ rooms: draft.rooms.filter((_, k) => k !== i) })}
              />
            ))}

            {draft.rooms.length < 8 && (
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
        </div>

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
              <Figure label="Par" value={report?.ok ? String(report.par) : "—"} />
              <Figure
                label="Get out"
                value={report && report.builds > 0 ? `${report.out}/${report.builds}` : "—"}
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
            <ErrorNote message={error} />

            {link ? (
              <div className="mt-4 rounded-md border border-accent/60 bg-accent-dim p-3">
                <p className="label-caps">It is out there</p>
                <p className="mt-1 break-all text-sm text-text-hi">{link}</p>
                <Link href={`/d/${draft.code}`} className="mt-2 inline-block text-sm text-accent underline">
                  Go and look at the door
                </Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                <p className="mb-2 text-xs text-paper-ink-mid">
                  Publishing keeps this yours and gives me permission to host it and show it, for
                  as long as it is up. Your own writing only, and nothing you would not want a
                  stranger to open. The{" "}
                  <a href="/terms" className="underline">
                    terms
                  </a>{" "}
                  say it in five sentences.
                </p>
                <Button size="lg" disabled={!canPublish || busy} onClick={() => void publish()}>
                  {draft.publishedAt
                    ? "Already out there"
                    : canPublish
                      ? "Keep it and take the link"
                      : report && !report.ok
                        ? "Fix the blocks first"
                        : "Give it a name first"}
                </Button>
                <Link
                  href={`/d/${draft.code}?preview=1`}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong text-sm text-text-mid"
                >
                  Play it yourself first
                </Link>
              </div>
            )}

            <p className="mt-3 text-xs text-text-low">
              Prose never moves par, so typing never re-runs this. Changing a difficulty word
              does.
            </p>
          </Card>
        </aside>
      </div>

      <Announcer message={announce} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-dim bg-bg-2 px-3 py-2">
      <div className="label-caps">{label}</div>
      <div className="num text-2xl text-text-hi">{value}</div>
    </div>
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
  last,
  flagged,
  onEdit,
  onOption,
  onMove,
  onRemove,
}: {
  room: Room;
  index: number;
  last: boolean;
  flagged: Note[];
  onEdit: (patch: Partial<Room>) => void;
  onOption: (j: number, patch: Partial<Option>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const doors = room.options.map((o) => (o.ability ? ABILITY_LABEL[o.ability] : "brace")).join(" · ");
  return (
    <details className="sheet mb-3 max-w-none p-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3">
        <span className="num rounded border border-paper-rule px-2 py-0.5 text-xs text-paper-ink-mid">
          {index + 1}
        </span>
        <span className="font-display min-w-0 flex-1 truncate text-paper-ink">
          {room.title || "Empty slot"}
        </span>
        {flagged.length > 0 && <Pill tone="warning">{flagged.length} to look at</Pill>}
        <span className="num hidden text-xs text-paper-ink-mid sm:inline">{doors}</span>
        <span className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onMove(-1); }}
            disabled={index === 0}
            aria-label={`Move floor ${index + 1} up`}
            className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onMove(1); }}
            disabled={last}
            aria-label={`Move floor ${index + 1} down`}
            className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onRemove(); }}
            aria-label={`Remove floor ${index + 1}`}
            className="min-h-11 min-w-11 rounded border border-paper-rule text-paper-ink"
          >
            ✕
          </button>
        </span>
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
            className="min-h-11 w-full rounded border border-paper-rule bg-white/40 px-3 text-paper-ink"
          />
        </label>

        <label className="mt-3 block">
          <span className="sheet-label">What they walk into</span>
          <textarea
            value={room.setup}
            rows={2}
            maxLength={600}
            onChange={(e) => onEdit({ setup: e.target.value })}
            className="w-full rounded border border-paper-rule bg-white/40 px-3 py-2 text-paper-ink"
          />
        </label>

        <label className="mt-3 block">
          <span className="sheet-label">How deep this one is</span>
          <select
            value={room.band}
            onChange={(e) => {
              const band = Number(e.target.value) as 1 | 2 | 3;
              // The word fills the number in, so changing the depth re-fills every
              // door on the floor rather than leaving stale targets behind.
              onEdit({
                band,
                options: room.options.map((o) =>
                  o.kind === "check"
                    ? { ...o, tn: TN_TABLE[band][wordFor(room.band, o.tn ?? 15)], vigour: COST[band] }
                    : { ...o, vigour: COST[band] }
                ),
              });
            }}
            className="min-h-11 rounded border border-paper-rule bg-white/40 px-3 text-paper-ink"
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
                    className="min-h-11 rounded border border-paper-rule bg-white/40 px-2 text-paper-ink"
                  >
                    {ABILITIES.map((a) => (
                      <option key={a} value={a}>
                        {ABILITY_LABEL[a]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`How hard door ${j + 1} is`}
                    value={wordFor(room.band, o.tn ?? 15)}
                    onChange={(e) => onOption(j, { tn: TN_TABLE[room.band][e.target.value] })}
                    className="min-h-11 rounded border border-paper-rule bg-white/40 px-2 text-paper-ink"
                  >
                    <option value="easy">easy</option>
                    <option value="fair">fair</option>
                    <option value="hard">hard</option>
                  </select>
                  <span className="num text-xs text-paper-ink-mid">needs {o.tn}</span>
                </>
              ) : (
                <span className="num text-xs text-paper-ink-mid">
                  always works, costs {o.vigour}
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
              className="min-h-11 w-full rounded border border-paper-rule bg-white/40 px-3 text-paper-ink"
            />
            <input
              type="text"
              placeholder="In their own words, before they know if it works"
              aria-label={`What door ${j + 1} promises`}
              value={o.promise}
              maxLength={200}
              onChange={(e) => onOption(j, { promise: e.target.value })}
              className="mt-2 min-h-11 w-full rounded border border-paper-rule bg-white/40 px-3 text-sm text-paper-ink"
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
                className="w-full rounded border border-paper-rule bg-white/40 px-3 py-2 text-sm text-paper-ink"
              />
              {o.kind === "check" ? (
                <textarea
                  placeholder="It does not"
                  aria-label={`What happens when door ${j + 1} does not work`}
                  value={o.lose}
                  rows={2}
                  maxLength={400}
                  onChange={(e) => onOption(j, { lose: e.target.value })}
                  className="w-full rounded border border-paper-rule bg-white/40 px-3 py-2 text-sm text-paper-ink"
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
  );
}
