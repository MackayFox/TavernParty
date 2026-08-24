"use client";

/**
 * The interactive half of the hero: a name, and three ways into a game.
 *
 * A cold visitor should be at a table in one click. The only thing between them
 * and one is the name box, and it remembers itself after the first time, so the
 * second visit really is one click. No account, ever, for guest play.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Announcer, Button, ErrorNote, Input, Pill } from "@/components/ui";
import { readName, writeName } from "@/lib/daily/local";

/** The room-code alphabet from lib/game/store.ts: no O, 0, I, L or 1. */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{6}$`);

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error;
    throw new Error(message ?? "That did not work. Try again in a moment.");
  }
  return data as T;
}

export function TavernHero() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    try {
      const { code: tableCode } = await (which === "quick"
        ? post<{ code: string }>("/api/quick-match", { displayName: trimmed })
        : post<{ code: string }>("/api/tables", {
            name: `${trimmed.toUpperCase()}'s table`,
            visibility: "public",
            displayName: trimmed,
          }));
      router.push(`/room/${tableCode}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const join = () => {
    const clean = code.trim().toUpperCase();
    if (!CODE_RE.test(clean)) {
      setError("A table code is six letters and numbers, with no O, I or L in it.");
      return;
    }
    setError(null);
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

      <ErrorNote message={error} />

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

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Table code</span>
          <Input
            placeholder="ABC234"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
            className="num text-center text-xl uppercase tracking-[0.3em]"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
        </label>
        <Button variant="secondary" onClick={join}>
          Join by code
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-3 text-sm text-text-mid">
        <a
          href="/tables"
          className="inline-flex min-h-11 items-center underline hover:text-text-hi"
        >
          Or look at the open tables
        </a>
        <Pill tone="accent">Free · nothing to install</Pill>
      </p>
    </div>
  );
}
