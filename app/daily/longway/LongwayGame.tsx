"use client";

/**
 * THE LONG WAY DOWN. Five Acts, played solo, one at a time.
 *
 * No import of `lib/daily/longway`: it computes par. Every ledger comes back
 * from the route, which replays the whole night from the date and the choices,
 * so this component holds no rules and cannot be argued with about arithmetic.
 *
 * The character is on the sheet and the Act is on the dark, which is the
 * signature contrast of the product. The ledger is the narration: named
 * contributions, in the order they should be read out, and never a bare total.
 */
import { useEffect, useRef, useState } from "react";
import { Announcer, Card, Die, ErrorNote, Pill, Sheet, Spinner } from "@/components/ui";
import { postJson } from "@/components/client";
import { useLanded } from "@/components/daily/landed";
import { DailyHeader, DieRule, NextUp, RuleLine, ShareCard, finishDaily, getPuzzle } from "../shell";
import { reachNote } from "@/lib/daily/core";
import { readProgress, writeProgress } from "@/lib/daily/local";
import {
  ABILITY_LABEL,
  AFFINITY_BONUS,
  DREAD_DOUBLE_AT,
  FLINCH_DREAD,
  FLINCH_RENOWN,
  HOOK_TOKEN_VALUE,
  MARK_FLINCH_PENALTY,
  abilityMod,
} from "@/lib/game/rules";
import type { Ability } from "@/lib/game/types";

const GAME = "longway" as const;
const FLINCH = "flinch";

type Door = {
  id: string;
  label: string;
  ability: Ability;
  tn: number;
  deed: number;
  cost: { renown: number; dread: number };
  reckless: boolean;
};

type ActCard = {
  index: number;
  sceneId: string;
  title: string;
  setup: string;
  tags: string[];
  marked: boolean;
  face: number;
  doors: Door[];
};

type Payload = {
  date: string;
  archive: boolean;
  who: {
    callingName: string;
    affinities: [Ability, Ability];
    failingTag: string;
    failingText: string;
    kitName: string;
    kitBlurb: string;
    kitBonus: { ability: Ability; value: number } | null;
    hookName: string;
    hookBlurb: string;
    callTag: string;
    scores: Record<Ability, number>;
  };
  acts: ActCard[];
  hookTokens: number;
};

type Ledger = {
  index: number;
  doorId: string;
  doorLabel: string;
  mods: { label: string; value: number }[];
  total: number;
  tn: number;
  success: boolean;
  line: string;
  renownDelta: number;
  dreadDelta: number;
  renownAfter: number;
  dreadAfter: number;
  tokensAfter: number;
  hookRefilled: boolean;
  costDoubled: boolean;
};

type Choice = { doorId: string; spend: number };

type Reply = {
  ledgers: Ledger[];
  renown: number;
  dread: number;
  tokens: number;
  complete: boolean;
  archive?: boolean;
  par?: number;
  parLine?: Choice[];
  share?: string;
};

type Saved = { choices: Choice[]; reply: Reply | null };

function usable(value: Reply | null | undefined, acts: number): Reply | null {
  if (!value || !Array.isArray(value.ledgers) || value.ledgers.length > acts) return null;
  if (typeof value.renown !== "number" || typeof value.dread !== "number") return null;
  if (value.complete && typeof value.share !== "string") return null;
  return value;
}

export function LongwayGame({ date }: { date?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [reply, setReply] = useState<Reply | null>(null);
  const [spend, setSpend] = useState(0);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [streak, setStreak] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setRestored(false);
    setSpend(0);
    getPuzzle<Payload>(`/api/daily/longway${date ? `?date=${encodeURIComponent(date)}` : ""}`)
      .then((payload) => {
        if (!live) return;
        const stored = readProgress<Saved>(GAME, payload.date);
        const ok =
          stored &&
          Array.isArray(stored.choices) &&
          stored.choices.length <= payload.acts.length &&
          stored.choices.every((c) => typeof c?.doorId === "string");
        setData(payload);
        setChoices(ok ? stored!.choices : []);
        setReply(ok ? usable(stored!.reply, payload.acts.length) : null);
        setRestored(true);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Tonight will not load.");
        setRestored(true);
      });
    return () => {
      live = false;
    };
  }, [date]);

  useEffect(() => {
    if (!restored || !data) return;
    writeProgress(GAME, data.date, { choices, reply } satisfies Saved);
  }, [restored, data, choices, reply]);

  // The streak is recorded once, whichever way the player arrived at a finished
  // night: fresh, or by reloading onto a stored one.
  useEffect(() => {
    if (saved || !data || !reply?.complete || reply.par === undefined) return;
    setSaved(true);
    finishDaily(GAME, data.date, reply.renown, reply.par, !!reply.archive).then((next) => {
      if (alive.current) setStreak(next);
    });
  }, [saved, data, reply]);

  const done = reply?.complete === true;
  const acted = reply?.ledgers.length ?? 0;
  const act = data && !done ? data.acts[acted] : null;
  const tokens = reply?.tokens ?? data?.hookTokens ?? 0;

  async function commit(doorId: string) {
    if (!data || !act || busy || done) return;
    const next = [...choices.slice(0, acted), { doorId, spend: Math.min(spend, tokens) }];
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<Reply>("/api/daily/longway", {
        date: data.date,
        choices: next,
      });
      if (!alive.current) return;
      setChoices(next);
      setReply(res);
      setSpend(0);
      const last = res.ledgers[res.ledgers.length - 1];
      setAnnounce(
        last
          ? `${last.doorLabel}. ${last.success ? "It works" : "It does not"}. ${last.line} Renown ${res.renown}, Dread ${res.dread}.`
          : "Committed."
      );
    } catch (err: unknown) {
      if (alive.current)
        setError(err instanceof Error ? err.message : "That door would not open. Try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const latest = reply?.ledgers[reply.ledgers.length - 1] ?? null;
  const showLatest = latest !== null && latest.index === acted && !done;
  /**
   * Take the player to the Act that just resolved.
   *
   * Keyed on the Act's index, so it fires once per resolution and never on a
   * re-render that changed nothing. Before this the line appeared and the page
   * did not move, which on a phone meant the answer to what you just did was off
   * the top of the screen.
   */
  const landed = useLanded<HTMLDivElement>(showLatest && latest ? latest.index : null);

  /**
   * What a door would come to, before committing to it.
   *
   * This is the one number the page works out for itself, and it has to be the
   * same arithmetic the server uses in `ledgerFor`: the die, the ability, the
   * Calling's training, the kit, and any Hook tokens on the table. Everything
   * else on this page is the server's answer, printed.
   */
  function reachOf(face: number, ability: Ability, spending: number): number {
    if (!data) return face;
    const trained = data.who.affinities.includes(ability) ? AFFINITY_BONUS : 0;
    const carried =
      data.who.kitBonus && data.who.kitBonus.ability === ability ? data.who.kitBonus.value : 0;
    return (
      face + abilityMod(data.who.scores[ability]) + trained + carried + spending * HOOK_TOKEN_VALUE
    );
  }

  /**
   * What a failure would actually cost here, which is not the figure on the door.
   *
   * Mirrors `costMultiplier` in the engine: your Calling's Failing tag on this
   * scene doubles every cost in it, Dread at the threshold doubles it again for
   * every door except the Reckless one, and both at once is four times the
   * printed number. The doors were showing the sticker price on the daily that
   * promises you can see what is coming.
   */
  function costMultFor(card: ActCard, reckless: boolean): number {
    if (!data) return 1;
    let mult = 1;
    if (card.tags.includes(data.who.failingTag)) mult *= 2;
    if ((reply?.dread ?? 0) >= DREAD_DOUBLE_AT && !reckless) mult *= 2;
    return mult;
  }

  return (
    <section className="mx-auto w-full max-w-2xl py-6">
      <DailyHeader game={GAME} date={data?.date ?? null} archive={!!data?.archive} />
      <RuleLine game={GAME} />
      <ErrorNote message={error} />
      <Announcer message={announce} />

      {!restored ? (
        <Card className="mt-4" aria-busy="true">
          <Spinner label="Rolling tonight's character" />
        </Card>
      ) : data ? (
        <>
          <div className="mt-4">
            <Sheet title={data.who.callingName} subtitle={`Character sheet · ${data.date}`}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(Object.keys(data.who.scores) as Ability[]).map((ability) => {
                  const trained = data.who.affinities.includes(ability);
                  // Reach with no die and nothing spent is exactly the modifier.
                  const mod = reachOf(0, ability, 0);
                  return (
                    <div key={ability} className="sheet-box flex flex-col items-center px-1 py-2">
                      <span className="sheet-label">{ABILITY_LABEL[ability]}</span>
                      <span className="num text-xl leading-none text-paper-ink">
                        {data.who.scores[ability]}
                      </span>
                      <span className="sheet-label">
                        {mod >= 0 ? "+" : ""}
                        {mod}
                        {trained ? " tr" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <dl className="mt-4 space-y-2 text-paper-ink">
                <div>
                  <dt className="sheet-label">Carrying</dt>
                  <dd>
                    {data.who.kitName}. {data.who.kitBlurb}
                  </dd>
                </div>
                <div>
                  <dt className="sheet-label">Hook</dt>
                  <dd>
                    {data.who.hookName}. {data.who.hookBlurb}
                  </dd>
                </div>
                <div>
                  <dt className="sheet-label">Failing, on a {data.who.failingTag} scene</dt>
                  <dd>{data.who.failingText}</dd>
                </div>
              </dl>
            </Sheet>
          </div>

          <Card className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm text-text-mid">
              Renown <span className="num text-lg text-text-hi">{reply?.renown ?? 0}</span>
            </span>
            <span className="text-sm text-text-mid">
              Dread <span className="num text-lg text-text-hi">{reply?.dread ?? 0}</span>
            </span>
            <span className="text-sm text-text-mid">
              Hook tokens <span className="num text-lg text-text-hi">{tokens}</span>
            </span>
            <span className="text-sm text-text-mid">
              Act <span className="num text-lg text-text-hi">{Math.min(acted + 1, data.acts.length)}</span>{" "}
              of {data.acts.length}
            </span>
            {(reply?.dread ?? 0) >= DREAD_DOUBLE_AT ? (
              <Pill tone="danger">
                Dread at {DREAD_DOUBLE_AT}: every cost doubled, bar the Reckless door
              </Pill>
            ) : null}
          </Card>

          {/* The dice, all five, up front. Knowing them is the game. */}
          <Card className="mt-4">
            <p className="label-caps">Tonight&apos;s five, already thrown</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {data.acts.map((a, i) => (
                <li key={a.index} className="flex flex-col items-center gap-1">
                  <Die face={a.face} size={44} />
                  <span className="label-caps text-[10px]">
                    {i < acted ? "spent" : i === acted ? "this act" : `act ${a.index}`}
                  </span>
                </li>
              ))}
            </ul>
            <DieRule />
          </Card>

          {showLatest && latest ? (
            <Card className="tp-anim-reveal mt-4" ref={landed}>
              <p className="label-caps">Act {latest.index}</p>
              <p className="prose-read mt-1 text-text-hi">{latest.line}</p>
              <p className="num mt-3 text-sm text-text-mid">
                {latest.doorId === FLINCH
                  ? "You did not move."
                  : latest.mods
                      .map((m) => `${m.label} ${m.value >= 0 ? "+" : ""}${m.value}`)
                      .join("   ")}
              </p>
              {latest.doorId !== FLINCH ? (
                <p className="num mt-1 text-text-hi">
                  {latest.total} against {latest.tn}.{" "}
                  <span className={latest.success ? "text-success" : "text-danger"}>
                    <span aria-hidden>{latest.success ? "✓ " : "✕ "}</span>
                    {latest.success ? "It gives" : "It does not"}
                  </span>
                </p>
              ) : null}
              <p className="mt-2 flex flex-wrap gap-2">
                <Pill tone={latest.renownDelta >= 0 ? "success" : "danger"}>
                  Renown {latest.renownDelta >= 0 ? "+" : ""}
                  {latest.renownDelta}
                </Pill>
                {latest.dreadDelta > 0 ? <Pill tone="danger">Dread +{latest.dreadDelta}</Pill> : null}
                {latest.costDoubled ? <Pill tone="warning">Cost doubled</Pill> : null}
                {latest.hookRefilled ? <Pill tone="arcane">Hook tokens back to two</Pill> : null}
              </p>
            </Card>
          ) : null}

          {act ? (
            <Card className="phase-in mt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="label-caps">Act {act.index}</p>
                  <h2 className="font-display text-2xl font-bold text-text-hi">{act.title}</h2>
                </div>
                <Die face={act.face} size={52} />
              </div>
              <p className="prose-read mt-2 text-text-hi">{act.setup}</p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {act.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
                {act.marked ? (
                  <Pill tone="arcane">Marked: this one is about you, and it pays +2</Pill>
                ) : null}
                {act.tags.includes(data.who.failingTag) ? (
                  <Pill tone="warning">
                    Your failing is in this room: every cost here is doubled
                  </Pill>
                ) : null}
              </p>

              {tokens > 0 ? (
                <label className="mt-4 block">
                  <span className="label-caps mb-1 block">
                    Hook tokens to spend, worth {HOOK_TOKEN_VALUE} each
                  </span>
                  <select
                    className="min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-3 text-base text-text-hi"
                    value={Math.min(spend, tokens)}
                    onChange={(e) => setSpend(Number(e.target.value))}
                  >
                    {Array.from({ length: tokens + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "None" : `${n} (+${n * HOOK_TOKEN_VALUE} on the roll)`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <ul className="mt-4 space-y-2">
                {act.doors.map((door) => {
                  const reach = reachOf(act.face, door.ability, Math.min(spend, tokens));
                  const mult = costMultFor(act, door.reckless);
                  return (
                    <li key={door.id}>
                      <button
                        type="button"
                        onClick={() => commit(door.id)}
                        disabled={busy}
                        className="w-full rounded-md border border-border-strong bg-bg-2 p-3 text-left transition-colors hover:border-accent/60 hover:bg-bg-3 disabled:opacity-50"
                      >
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-display text-lg text-text-hi">{door.label}</span>
                          {door.reckless ? <Pill tone="danger">Reckless</Pill> : null}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-mid">
                          <span>{ABILITY_LABEL[door.ability]}</span>
                          <span className="num">needs {door.tn}</span>
                          <span className="num">pays {door.deed}</span>
                          <span className="num">
                            costs {door.cost.renown * mult}
                            {door.cost.dread > 0 ? ` and ${door.cost.dread * mult} Dread` : ""}
                            {mult > 1 ? (mult === 2 ? " (doubled)" : " (doubled twice)") : ""}
                          </span>
                        </span>
                        <span className="num mt-1 block text-sm text-accent">
                          your reach: {reach} ({reachNote(act.face, reach, door.tn)})
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => commit(FLINCH)}
                    disabled={busy}
                    className="min-h-11 w-full rounded-md border border-border-dim bg-bg-1 px-3 py-2 text-left text-text-mid transition-colors hover:border-border-strong hover:text-text-hi disabled:opacity-50"
                  >
                    Do not move.{" "}
                    <span className="num text-text-low">
                      {/* The real figures, because standing still is taxed by the
                          Failing and by Dread exactly like a door is, and being
                          Marked charges you another point for not turning up. */}
                      Costs{" "}
                      {Math.abs(
                        (FLINCH_RENOWN - (act.marked ? MARK_FLINCH_PENALTY : 0)) *
                          costMultFor(act, false)
                      )}{" "}
                      Renown and {FLINCH_DREAD * costMultFor(act, false)} Dread. Sometimes it is
                      still the cheapest door.
                    </span>
                  </button>
                </li>
              </ul>
            </Card>
          ) : null}

          {done && reply ? (
            <div className="mt-6 space-y-4">
              <Card>
                <p className="label-caps">The night, closed</p>
                <p className="num mt-1 text-4xl text-text-hi">{reply.renown}</p>
                <p className="mt-1 text-text-mid">
                  Renown, against a best possible of{" "}
                  <span className="num text-accent">{reply.par}</span>.{" "}
                  {reply.renown >= (reply.par ?? 0)
                    ? "There was no better night in it."
                    : `Somebody walked out with ${(reply.par ?? 0) - reply.renown} more.`}
                </p>
                <p className="mt-2 text-sm text-text-low">
                  Dread finished at {reply.dread}. Every cost doubles at three, which is where most
                  of the difference between a good night and a bad one is made.
                </p>
              </Card>

              <Card>
                <p className="label-caps">Door by door</p>
                <ol className="mt-2 space-y-3">
                  {reply.ledgers.map((l, i) => {
                    const best = reply.parLine?.[i];
                    const bestDoor = data.acts[i]?.doors.find((d) => d.id === best?.doorId);
                    return (
                      <li key={l.index} className="border-b border-border-dim pb-2 last:border-0">
                        <p className="text-text-hi">
                          <span className="num text-text-low">Act {l.index}. </span>
                          {l.doorLabel}
                        </p>
                        <p
                          className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${
                            l.success ? "text-success" : "text-danger"
                          }`}
                        >
                          <span aria-hidden>{l.success ? "✓ " : "✕ "}</span>
                          {l.doorId === FLINCH
                            ? "Did not move"
                            : l.success
                              ? "It worked"
                              : "It did not"}
                          <span className="num ml-2 text-text-mid">
                            {l.renownDelta >= 0 ? "+" : ""}
                            {l.renownDelta} Renown
                          </span>
                        </p>
                        {best && best.doorId !== l.doorId ? (
                          <p className="mt-1 text-sm text-text-low">
                            The best line took{" "}
                            {best.doorId === FLINCH
                              ? "no door at all"
                              : `"${bestDoor?.label ?? best.doorId}"`}
                            {best.spend > 0
                              ? `, spending ${best.spend} ${best.spend === 1 ? "token" : "tokens"}`
                              : ""}
                            .
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </Card>

              {reply.share ? <ShareCard text={reply.share} /> : null}
              <NextUp game={GAME} archive={!!reply.archive} streak={streak} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
