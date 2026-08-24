"use client";

/** Small client helpers shared across screens. */
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { readName, writeName } from "@/lib/daily/local";

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
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
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

/** null = still checking; true/false = known. Logged-in users never type a name. */
export function useLoggedIn(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) {
      setLoggedIn(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, []);
  return loggedIn;
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
