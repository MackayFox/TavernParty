"use client";

/**
 * TAKE THE PLAYER TO WHAT JUST HAPPENED.
 *
 * Adam, on a phone: "you click an option and the page stays scrolled down so you
 * don't even know what's happened until you manually scroll up."
 *
 * He was describing every daily on the site. All four resolve a move by adding
 * content to a single tall column and then leaving the viewport exactly where it
 * was, which on a desktop is merely untidy and on a phone means the answer to the
 * thing you just did is off the top of the screen. Before this, the whole
 * application contained no call to `scrollIntoView` and no call to `focus` outside
 * the nav menu.
 *
 * The Deep Run solves it with a modal, which is the strongest form of the fix: a
 * modal moves focus by itself and there is nothing left to scroll to. The other
 * three resolve in place, so they get this instead.
 *
 * TWO THINGS, AND BOTH ARE NEEDED. Scrolling serves the person looking at the
 * screen. Moving focus serves the person on a keyboard or a screen reader, and it
 * is also what makes the browser's own "where am I" behaviour correct afterwards.
 * Doing only the first is the common half-fix.
 */
import { useEffect, useRef } from "react";

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Attach the returned ref to the thing that appeared, and change `key` when it
 * does.
 *
 * `key` rather than a boolean, so a second result in the same session moves the
 * player again: keyed on "which result is this", it fires once per result and
 * never on a re-render that changed nothing.
 *
 * The element is given `tabIndex={-1}` by this hook, because `focus()` on a
 * non-focusable element silently does nothing, and a silent nothing is how this
 * kind of fix gets shipped broken.
 */
export function useLanded<T extends HTMLElement>(key: string | number | null) {
  const ref = useRef<T | null>(null);
  const last = useRef<string | number | null>(null);

  useEffect(() => {
    if (key === null || key === last.current) return;
    last.current = key;
    const el = ref.current;
    if (!el) return;

    if (el.tabIndex < 0) el.tabIndex = -1;
    try {
      el.scrollIntoView({
        // Somebody who asked for less movement gets taken there instantly rather
        // than smoothly. They still get taken there.
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    } catch {
      el.scrollIntoView();
    }
    /*
     * `preventScroll`, because the scroll above is the considered one and letting
     * focus do its own would fight it and win, landing the element at the very top
     * of the viewport instead of centred.
     */
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, [key]);

  return ref;
}
