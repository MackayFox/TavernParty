"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Browser client (publishable/anon key). Null when Supabase isn't configured. */
export function browserClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createBrowserClient(url, key);
  return cached;
}

/**
 * Whether a room should hold a Realtime connection at all.
 *
 * The same variable `dbstore` checks before it broadcasts. Realtime is an
 * accelerant: a broadcast triggers an early refetch and carries no state, so
 * with it off the room runs on its 2.5s poll, which is what advances the game
 * anyway. The free tier allows 200 concurrent connections, one per player, which
 * is thirty-three tables, so it stays off until there is a plan that pays for it.
 *
 * Callers have to read this variable themselves before importing this module,
 * not import this constant: the point of the flag is that the Supabase client is
 * never fetched, and you cannot learn that from inside the thing you are trying
 * not to fetch.
 */
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_REALTIME === "1";

/**
 * Subscribe to a table's broadcast channel. Returns the unsubscribe.
 *
 * IMPORTANT: reach this through `await import("@/lib/supabase/browser")`, never
 * a static import from a page. Importing this module drags in the whole Supabase
 * client, 227 KB minified, and the room was paying that in its first load for
 * one broadcast channel it is built to work without.
 */
export function subscribeToTable(code: string, onUpdate: () => void): () => void {
  const supabase = REALTIME_ENABLED ? browserClient() : null;
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`tp:table:${code}`)
    .on("broadcast", { event: "update" }, onUpdate)
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
