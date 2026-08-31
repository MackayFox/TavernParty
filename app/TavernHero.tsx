"use client";

/**
 * The interactive half of the hero: a name, and three ways into a game.
 *
 * A cold visitor should be at a table in one click. The only thing between them
 * and one is the name box, and it remembers itself after the first time, so the
 * second visit really is one click. No account, ever, for guest play.
 *
 * The length of the night is the one setting here, and it is pre-answered rather
 * than asked: leaving it alone is the standard run, so it costs nobody a click.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Announcer, Button, Card, ErrorNote, Field, Input, Pill } from "@/components/ui";
import { readName, writeName } from "@/lib/daily/local";
import {
  DEFAULT_SETTINGS,
  estimateRunMs,
  formatDuration,
  MAX_ACTS,
  MIN_ACTS,
} from "@/lib/game/rules";

/** The room-code alphabet from lib/game/store.ts: no O, 0, I, L or 1. */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{6}$`);

/**
 * How long a night, offered where a table is opened.
 *
 * The engine has accepted MIN_ACTS to MAX_ACTS since the first commit and the API
 * validates it, but nothing in the product ever sent it, so every table ever
 * created ran the default while the lobby, the tables list and the run history all
 * printed an Acts count as though it were a choice somebody had made. Same failure
 * as the maxPlayers one documented in DEFAULT_SETTINGS: a setting advertised
 * everywhere and reachable from nowhere.
 */
const ACT_CHOICES = Array.from({ length: MAX_ACTS - MIN_ACTS + 1 }, (_, i) => MIN_ACTS + i);

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error;
    const err = new Error(message ?? "That did not work. Try again in a moment.") as Error & {
      status?: number;
    };
    /*
     * Carry the status. "Try again" is honest for a 400 and a lie for a 500:
     * when the lobby is down every one of these buttons fails identically
     * forever, and a person presses four times before opening devtools. The
     * caller uses this to swap the note for the truth.
     */
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export function TavernHero() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [acts, setActs] = useState(DEFAULT_SETTINGS.acts);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** A 5xx from the table routes: the lobby is down, not the request wrong. */
  const [lobbyDown, setLobbyDown] = useState(false);
  const [busy, setBusy] = useState<"quick" | "create" | null>(null);

  // Read after mount: localStorage does not exist during the server render, and
  // seeding state from it directly would be a hydration mismatch.
  useEffect(() => setName(readName()), []);

  const setAndRemember = (value: string) => {
    setName(value);
    writeName(value);
  };

  const go = async (which: "quick" | "create") => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Put a name to your character first.");
      return;
    }
    setBusy(which);
    setError(null);
    setLobbyDown(false);
    try {
      const { code: tableCode } = await (which === "quick"
        ? post<{ code: string }>("/api/quick-match", { displayName: trimmed })
        : post<{ code: string }>("/api/tables", {
            name: `${trimmed.toUpperCase()}'s table`,
            visibility: "public",
            displayName: trimmed,
            // Only on create. A quick match sits down at somebody else's table
            // and does not get to relitigate its settings.
            settings: { acts },
          }));
      router.push(`/room/${tableCode}`);
    } catch (e) {
      const err = e as Error & { status?: number };
      // 5xx is the lobby, not the request. See the note under the buttons.
      setLobbyDown((err.status ?? 0) >= 500);
      setError(err.message);
      setBusy(null);
    }
  };

  const join = () => {
    const clean = code.trim().toUpperCase();
    if (!CODE_RE.test(clean)) {
      // Named the wrong three. The alphabet drops the digits as well as the
      // letters they look like, so somebody typing the zero they can plainly see
      // in a screenshot was told the rule was about the letter O.
      setError("A table code is six letters and numbers, and never O, I, L, zero or one.");
      return;
    }
    setError(null);
    setLobbyDown(false);
    router.push(`/room/${clean}`);
  };

  const status =
    busy === "quick"
      ? "Looking for a table with a spare chair."
      : busy === "create"
        ? "Opening a table for you."
        : "";

  return (
    <div className="flex w-full flex-col gap-3">
      <Announcer message={status} />

      <label className="block">
        <span className="label-caps mb-1 block">Your character&apos;s name</span>
        <Input
          placeholder="e.g. RUE"
          maxLength={20}
          value={name}
          onChange={(e) => setAndRemember(e.target.value)}
          autoComplete="off"
          aria-describedby="name-help"
        />
        <span id="name-help" className="mt-1 block text-xs text-text-low">
          No account needed. This is the name the rest of the party will see.
        </span>
      </label>

      <Field
        label="How long a night"
        hint="Used when you open a table. A quick match takes the table it finds."
      >
        <select
          value={acts}
          onChange={(e) => setActs(Number(e.target.value))}
          className="min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-4 py-2.5 text-base text-text-hi"
        >
          {ACT_CHOICES.map((n) => (
            <option key={n} value={n}>
              {n} encounters, {formatDuration(estimateRunMs({ acts: n }))}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          disabled={busy !== null}
          onClick={() => void go("quick")}
        >
          {busy === "quick" ? "Finding a table…" : "Quick match"}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={busy !== null}
          onClick={() => void go("create")}
        >
          {busy === "create" ? "Setting it up…" : "Create a table"}
        </Button>
      </div>

      {/*
        THE NOTE GOES UNDER THE BUTTONS THAT FAILED.
        It used to be injected between the name field and the "how long a night"
        select, two controls above the button anybody had actually pressed, and
        it pushed everything below it down 44px as it appeared.

        And when the lobby is down it says so, with the way out, rather than
        "Try again" -- which on a 500 is an instruction to keep pressing a button
        that cannot work. `/tables` has always had this copy; the home page,
        where almost everybody meets the failure first, did not.
      */}
      {lobbyDown ? (
        <Card className="border-danger/60" role="alert">
          <p className="font-display text-lg text-text-hi">
            <span aria-hidden>✕ </span>The lobby is not answering
          </p>
          <p className="mt-1 text-text-mid">
            We cannot open a table or find you one at the moment. It is our end, not
            yours, and pressing it again will not help.
          </p>
          <p className="mt-1 text-text-mid">
            The four daily puzzles need none of this and are working normally.
          </p>
          <Link
            href="/daily"
            className="font-display mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
          >
            Play tonight's puzzles
          </Link>
        </Card>
      ) : (
        <ErrorNote message={error} />
      )}

      {/*
        The label was sr-only, so a sighted first-timer saw a centred six-wide box
        with "ABC234" in it and nothing saying whose code goes there. Not `Field`,
        because that wraps its children in the <label> and the Join button would
        have been read out as part of the input's name.
      */}
      <div>
        <label htmlFor="table-code" className="label-caps mb-1 block">
          Table code
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="table-code"
            placeholder="ABC234"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
            className="num flex-1 text-center text-xl uppercase tracking-[0.3em]"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            aria-describedby="code-help"
          />
          <Button variant="secondary" onClick={join}>
            Join by code
          </Button>
        </div>
        <span id="code-help" className="mt-1 block text-xs text-text-low">
          Six characters, from whoever opened the table. It never contains O, I, L, zero or one.
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-3 text-sm text-text-mid">
        {/*
          THE SAFE FIRST CLICK, and it goes first.

          Everything above this needs at least one other person, or a willingness
          to sit at a table with strangers, and both of those are a bigger ask
          than a stranger's first five seconds will carry. The four puzzles are
          one player, two minutes, no account and nothing to arrange -- and on a
          phone the first mention of them was 1,800px down the page, two full
          screens past a hero asking you to gather a party.

          They are also the half of the site that needs no database, so on the
          day the lobby is not answering this is the link that still works.
        */}
        <a
          href="/daily"
          className="inline-flex min-h-11 items-center underline hover:text-text-hi"
        >
          Or play tonight&apos;s puzzles on your own
        </a>
        <a
          href="/tables"
          className="inline-flex min-h-11 items-center underline hover:text-text-hi"
        >
          Or look at the open tables
        </a>
        {/*
          The only hero-level mention, and it belongs here: on your own, the thing
          to do is write one. The shelf of other people's is one click further in,
          because a shelf with one dungeon on it is not a hero claim.
        */}
        <a
          href="/write"
          className="inline-flex min-h-11 items-center underline hover:text-text-hi"
        >
          Or write a dungeon
        </a>
        <Pill tone="accent">Free · nothing to install</Pill>
      </p>
    </div>
  );
}
