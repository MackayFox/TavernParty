"use client";

/**
 * The header: wordmark, the Daily menu, the tables list, and room for auth.
 *
 * It has to hold together at 390px, so the nav wins the space fight and the
 * wordmark is the thing that gives: TAVERN stacks over PARTY on a narrow screen
 * and sits on one line from `sm` up. Nothing here truncates or wraps mid-word.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";

const NAV_LINK =
  "font-display inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold uppercase tracking-wide text-text-mid hover:bg-bg-2 hover:text-text-hi";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Tavern Party, home"
      className={`font-display min-w-0 text-lg font-bold uppercase leading-none sm:text-xl ${className}`}
    >
      <span className="block text-accent sm:inline">Tavern</span>{" "}
      <span className="block text-text-hi sm:inline">Party</span>
    </Link>
  );
}

/** The four dailies, in a real menu: Escape closes it, a click outside closes it. */
export function DailyMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-text-mid hover:bg-bg-2 hover:text-text-hi";
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className={NAV_LINK}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Daily <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 flex w-60 flex-col gap-0.5 rounded-lg border border-border-strong bg-bg-1 p-2 shadow-[var(--tp-shadow-3)]"
        >
          {DAILY_GAMES.map((g) => (
            <Link
              key={g}
              role="menuitem"
              href={DAILY_META[g].path}
              className={item}
              onClick={() => setOpen(false)}
            >
              {DAILY_META[g].name}
            </Link>
          ))}
          <Link role="menuitem" href="/daily" className={item} onClick={() => setOpen(false)}>
            All four today
          </Link>
          <Link
            role="menuitem"
            href="/daily/archive"
            className={item}
            onClick={() => setOpen(false)}
          >
            Past days
          </Link>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border-dim py-3">
      <Wordmark />
      {/* The auth controls land in here later, next to Tables. Leaving the row
          as a flex gap means adding one link then is not a layout change. */}
      <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <DailyMenu />
        <Link href="/tables" className={NAV_LINK}>
          Tables
        </Link>
      </nav>
    </header>
  );
}
