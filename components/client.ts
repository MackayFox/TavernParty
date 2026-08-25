"use client";

/**
 * Small client helpers shared across screens.
 *
 * Nothing in here may import the Supabase client. Five screens import this
 * module for `postJson` alone, and a `useLoggedIn` hook that nothing has ever
 * called was enough to put the whole 227 KB client into all five bundles.
 */
import { useEffect, useState } from "react";
import { readName, writeName } from "@/lib/daily/local";

/**
 * An error a route refused with, carrying whatever else the route said.
 *
 * A refusal is often not just a sentence. The Ledger answers a fourth check with
 * "that is all three checks" AND the count it is holding, because the client's
 * own count has just been proved wrong and needs correcting. Throwing the
 * message alone threw that away, so the screen apologised and went on showing
 * the wrong number.
 */
export class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> | null
  ) {
    super(message);
    this.name = "RouteError";
  }
}

/** POST JSON and surface the server's user-facing error message on failure. */
export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  // Parse defensively: proxies and framework errors can return non-JSON, and
  // nobody should ever see a SyntaxError.
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new RouteError(data?.error ?? "Something went wrong. Try again.", res.status, data);
  return data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
  return data as T;
}

export async function deleteJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
  return data as T;
}

/** Display name persisted per browser so guests are not re-asked every game. */
export function useDisplayName(): [string, (v: string) => void, boolean] {
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setName(readName());
    setLoaded(true);
  }, []);
  const update = (v: string) => {
    setName(v);
    writeName(v);
  };
  return [name, update, loaded];
}

/** A ticking `Date.now()` for countdown displays. */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Copy to clipboard, falling back to a hidden textarea on browsers (and
 * insecure contexts) without the async API.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Share via the Web Share API where available, else copy. */
export async function shareOrCopy(text: string): Promise<"shared" | "copied" | "failed"> {
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ text });
      return "shared";
    } catch {
      // User cancelled, or share failed — fall through to copying.
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}
