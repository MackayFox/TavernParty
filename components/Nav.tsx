"use client";

/**
 * The header: wordmark, the Daily menu, the tables list, and room for auth.
 *
 * It has to hold together at 390px, so the nav wins the space fight and the
 * wordmark is the thing that gives: TAVERN stacks over PARTY on a narrow screen
 * and sits on one line from `sm` up. Nothing here truncates or wraps mid-word.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { DAILY_GAMES, DAILY_META } from "@/lib/daily/core";

/**
 * Everything but the ink colour, which the caller supplies.
 *
 * The colour is separate because `text-text-mid` and the current page's
 * `text-text-hi` on the same element are two rules of equal weight, and which one
 * wins is decided by the order Tailwind happens to emit them rather than by the
 * order they were written. One colour class per element, always.
 */
const NAV_LINK =
  "font-display inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold uppercase tracking-wide hover:bg-bg-2 hover:text-text-hi";
const NAV_IDLE = "text-text-mid";

/**
 * The page you are already on, marked.
 *
 * Underlined as well as brightened, because "you are here" carried by a shade of
 * ink is a state told by colour alone, and the same brightening is what the hover
 * does anyway.
 *
 * Exact match, never a prefix: `/daily` is a real page of its own in the same
 * menu as `/daily/longway`, so prefix matching would mark two items at once and
 * one of them would be lying.
 */
const CURRENT = "text-text-hi underline decoration-accent underline-offset-4";

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
 *
 * A DISCLOSURE, NOT A MENU, and the roles now say so. This claimed
 * `aria-haspopup="menu"`, `role="menu"` and `role="menuitem"` while implementing
 * none of the pattern that promise buys: no arrow-key movement between items, no
 * focus moved into the list on open, and Escape dropped focus on the floor. A
 * screen reader announced "menu", its user pressed Down, and nothing moved. Six
 * links you read and click are a disclosure, so the roles are gone rather than
 * the keyboard handling being built to match a promise nothing here needed.
 * `aria-expanded` and `aria-controls` are the whole contract, and the panel is a
 * list so the count is announced.
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
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // The panel unmounts, so whatever was focused inside it goes with it and a
      // keyboard user was left on the body, tabbing from the top of the document
      // again. Escape has to hand you back the button you opened.
      button.current?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex min-h-11 flex-col justify-center rounded-md px-3 py-1 text-sm font-semibold leading-snug text-text-mid hover:bg-bg-2 hover:text-text-hi";
  return (
    <div ref={ref} className="shrink-0">
      <button
        ref={button}
        type="button"
        className={`${NAV_LINK} ${NAV_IDLE}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden>{open ? "\u25b4" : "\u25be"}</span>
      </button>
      {open && (
        /*
         * Anchored to the right edge of the whole nav, not to the button.
         * Button-anchored and 16rem wide, the leftmost menu started 79px off the
         * left of a 375px screen, and which menu that was depended on how long
         * the other labels happened to be. Anchoring both to the nav puts every
         * panel inside the page gutter whatever the labels say, and only one is
         * ever open, so they cannot overlap. The nav carries the `relative`.
         */
        <ul
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 flex w-64 flex-col gap-0.5 rounded-lg border border-border-strong bg-bg-1 p-2 shadow-[var(--tp-shadow-3)]"
        >
          {items.map((entry) => {
            const current = pathname === entry.href;
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  aria-current={current ? "page" : undefined}
                  className={item}
                  onClick={() => setOpen(false)}
                >
                  {/* The underline goes on the name alone: on the whole link it
                      would rule through the gloss underneath it as well. */}
                  <span className={current ? CURRENT : undefined}>{entry.text}</span>
                  {entry.note && (
                    <span className="text-xs font-normal text-text-low">{entry.note}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The four puzzles, each with the line the game itself opens with.
 *
 * These were four bare names, sitting next to a Dungeons menu where every item
 * was glossed. THE LEDGER and MUSTER tell a stranger nothing about which of the
 * four they want, and `rule` is already written as one short line and already
 * printed on the hub card under each name, so there is nothing new to write and
 * nothing that can drift out of step with the game.
 */
export function DailyMenu() {
  return (
    <Menu
      label="Daily"
      items={[
        ...DAILY_GAMES.map((g) => ({
          href: DAILY_META[g].path,
          text: DAILY_META[g].name,
          note: DAILY_META[g].rule,
        })),
        { href: "/daily", text: "All four today", note: "Tonight's four in one place" },
        {
          href: "/daily/archive",
          text: "Past days",
          note: "Practice, and it never counts towards a streak",
        },
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
  const pathname = usePathname();
  const tables = pathname === "/tables";
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border-dim py-3">
      <Wordmark />
      {/* The auth controls land in here later, next to Tables. Leaving the row
          as a flex gap means adding one link then is not a layout change.

          `relative` is load-bearing: both menu panels position against this
          element rather than against their own button, which is what keeps the
          leftmost one on a 375px screen. */}
      <nav
        aria-label="Main"
        className="relative flex shrink-0 items-center gap-0.5 sm:gap-1"
      >
        <DungeonMenu />
        <DailyMenu />
        <Link
          href="/tables"
          aria-current={tables ? "page" : undefined}
          className={`${NAV_LINK} ${tables ? CURRENT : NAV_IDLE}`}
        >
          Tables
        </Link>
      </nav>
    </header>
  );
}
