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

/**
 * A menu in the header. Escape closes it, a click outside closes it.
 *
 * Generalised from a hardcoded dailies menu because the Hall and the Desk were
 * items seven and eight of eight INSIDE it, under a button that said "Daily".
 * Neither of them is daily. Somebody who wanted to write a dungeon had to open a
 * menu promising something else and read past four puzzle names, "All four today"
 * and "Past days" to find the biggest feature on the site.
 */
function Menu({
  label,
  items,
}: {
  label: string;
  items: { href: string; text: string; note?: string }[];
}) {
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
    "flex min-h-11 flex-col justify-center rounded-md px-3 py-1 text-sm font-semibold text-text-mid hover:bg-bg-2 hover:text-text-hi";
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className={NAV_LINK}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden>{open ? "\u25b4" : "\u25be"}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-0.5 rounded-lg border border-border-strong bg-bg-1 p-2 shadow-[var(--tp-shadow-3)]"
        >
          {items.map((entry) => (
            <Link
              key={entry.href}
              role="menuitem"
              href={entry.href}
              className={item}
              onClick={() => setOpen(false)}
            >
              {entry.text}
              {entry.note && (
                <span className="text-xs font-normal text-text-low">{entry.note}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DailyMenu() {
  return (
    <Menu
      label="Daily"
      items={[
        ...DAILY_GAMES.map((g) => ({ href: DAILY_META[g].path, text: DAILY_META[g].name })),
        { href: "/daily", text: "All four today" },
        { href: "/daily/archive", text: "Past days" },
      ]}
    />
  );
}

/**
 * THE ONE THING THAT MAKES THIS SITE DIFFERENT, given its own button.
 *
 * Every label here carries the gloss rather than the room name. The pages already
 * introduce themselves properly, and then the nav threw all of that away and
 * shipped the bare words "The Hall", which tell a stranger nothing. The fiction
 * survives where it belongs: on the page, as an eyebrow, and in prose.
 *
 * The house dungeon has a permanent link so that no path here can land on an empty
 * shelf. A gallery with one thing in it is honest; a gallery with nothing in it is
 * a dead end.
 */
export function DungeonMenu() {
  return (
    <Menu
      label="Dungeons"
      items={[
        {
          href: "/write",
          text: "Write a dungeon",
          note: "A solver tells you if it works",
        },
        {
          href: "/dungeons",
          text: "Dungeons people wrote",
          note: "Ranked by the people who finished them",
        },
        {
          href: "/d/LNGWLK",
          text: "The Stone Walk",
          note: "Six floors, ours, to see how it goes",
        },
      ]}
    />
  );
}

export function Nav() {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border-dim py-3">
      <Wordmark />
      {/* The auth controls land in here later, next to Tables. Leaving the row
          as a flex gap means adding one link then is not a layout change. */}
      <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <DungeonMenu />
        <DailyMenu />
        <Link href="/tables" className={NAV_LINK}>
          Tables
        </Link>
      </nav>
    </header>
  );
}
