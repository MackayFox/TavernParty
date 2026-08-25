"use client";

/**
 * Shared primitives, built on design/tokens.css. Small on purpose.
 *
 * Two rules run through all of it. Every interactive target is at least 44px,
 * because the whole product has to work one-handed on a phone. And no state is
 * ever carried by colour alone: every colour signal is paired with a word, a
 * glyph or a shape doing the same job, so it survives colour blindness and a
 * bad screen in a pub.
 */
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
}) {
  // Takes a ref, like Card and Input. Needed because a screen that moves focus
  // deliberately has to be able to point at the button it is moving focus to.
  //
  const tone = {
    primary:
      "bg-accent text-ink font-semibold hover:bg-accent-hover active:bg-accent-press",
    secondary:
      "bg-bg-2 text-text-hi border border-border-strong font-medium hover:border-accent/50 hover:bg-bg-3",
    ghost: "text-text-mid font-medium hover:bg-bg-2 hover:text-text-hi",
    danger: "bg-danger text-ink font-semibold hover:bg-danger-press",
  }[variant];
  const box = size === "lg" ? "min-h-14 px-7 text-lg" : "min-h-11 px-5 text-base";
  return (
    <button
      className={`font-display inline-flex items-center justify-center gap-2 rounded-md transition-all duration-[120ms] ease-out disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${box} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-md border border-border-input bg-bg-0 px-4 py-2.5 text-base text-text-hi placeholder:text-text-low ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-caps mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-low">{hint}</span>}
    </label>
  );
}

/**
 * Takes a ref, like `Input` already did.
 *
 * Needed because the dailies now move focus to the thing that just resolved, and
 * the thing that just resolved is a Card. React 19 passes `ref` as an ordinary
 * prop to a function component, so this is a type change rather than a
 * forwardRef wrapper.
 */
export function Card({ className = "", ...props }: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      className={`rounded-lg border border-border-dim bg-bg-1 p-4 ${className}`}
      {...props}
    />
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "danger" | "success" | "arcane" | "warning";
  children: React.ReactNode;
}) {
  const style = {
    neutral: "border-border-strong text-text-mid",
    accent: "border-accent/60 text-accent",
    danger: "border-danger/60 text-danger",
    success: "border-success/60 text-success",
    arcane: "border-arcane/60 text-arcane",
    warning: "border-warning/60 text-warning",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] ${style}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// THE CHARACTER SHEET — the signature surface
// ---------------------------------------------------------------------------

/**
 * Paper on a dark table. Anything about *you* goes on it: your character, your
 * wounds, your loot, your epitaph. It is the only light surface in the product,
 * so putting something here is a statement that it is yours.
 *
 * `torn` is for a character who did not make it. It is a modifier on the same
 * surface rather than a different component, because the point is that it is
 * still your sheet.
 */
export function Sheet({
  title,
  subtitle,
  torn = false,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: string;
  torn?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  /**
   * The default width applies only where the caller has not named one.
   *
   * max-w-xl was hardcoded, and most sheets sit in a wider column with cards
   * above and below them, so a stacked screen stepped in and out horizontally as
   * each section turned out to be a different width from the last. A caller can
   * now pass its own max-w-* and have it mean something.
   *
   * Read off the className rather than added as a `width` prop, so the callers
   * already passing max-w-none keep working untouched, and so no screen depends
   * on Tailwind's utility ordering to settle which of two max-widths wins.
   */
  const width = /(?:^|\s)max-w-/.test(className) ? "" : "max-w-xl";
  return (
    <article
      className={`sheet tp-anim-sheet mx-auto w-full ${width} p-5 sm:p-6 ${className}`}
      style={torn ? { filter: "saturate(0.72)" } : undefined}
    >
      {(title || subtitle) && (
        <header className="mb-4 border-b border-paper-rule pb-3">
          {subtitle && <p className="sheet-label mb-1">{subtitle}</p>}
          {title && (
            <h2 className="font-display text-2xl font-bold text-paper-ink">{title}</h2>
          )}
        </header>
      )}
      {children}
      {torn && (
        <p className="sheet-label mt-4 border-t border-paper-rule pt-3">
          This sheet has been set aside
        </p>
      )}
    </article>
  );
}

/** A hand-ruled box on the sheet. Used for ability scores and slots. */
export function SheetBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="sheet-box flex flex-col items-center gap-0.5 px-2 py-2">
      <span className="sheet-label">{label}</span>
      <span className="num text-xl leading-none text-paper-ink">{value}</span>
      {hint && <span className="sheet-label opacity-80">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * Stable string hash. Same answer on the server and the client, every render.
 *
 * Exported because the party colours are not the only thing that needs a spread
 * nobody can steer: ASSIGN uses it to open on a different suggested Hook for
 * each player, which is what stops a whole table defaulting to the same past.
 */
export function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable per-player colour. Same hash on the server and the client. */
export function partyIndex(id: string): number {
  return hashOf(id) % 8;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  id,
  name,
  size = 32,
  ring = null,
  dimmed = false,
}: {
  id: string;
  name: string;
  size?: number;
  /** "turn" = it is their move, "you" = this is you. Never colour alone. */
  ring?: "turn" | "you" | null;
  dimmed?: boolean;
}) {
  const ringStyle =
    ring === "turn"
      ? "0 0 0 2px var(--tp-accent)"
      : ring === "you"
        ? "0 0 0 2px var(--tp-text-hi)"
        : undefined;
  return (
    <span
      aria-hidden
      className="font-mono inline-grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        background: `var(--tp-party-${partyIndex(id)})`,
        color: "var(--tp-ink)",
        boxShadow: ringStyle,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dice and numbers
// ---------------------------------------------------------------------------

/**
 * One die. `sides` only affects the label, never the maths: the engine has
 * already decided the face and the server is authoritative about it.
 *
 * A critical or a fumble is marked with a word as well as a colour, because a
 * red 1 and a gold 20 must still be distinguishable in greyscale. The word
 * carries what the rule is, not just its name: "Critical" and "Fumble" were
 * printed under the die and defined nowhere, so a first-timer watching a 1 beat
 * a total of 24 had no way to know the face had overruled the sum.
 */
export function Die({
  face,
  sides = 20,
  rolling = false,
  size = 56,
}: {
  face: number;
  sides?: number;
  rolling?: boolean;
  size?: number;
}) {
  /**
   * A die still in the air has no verdict.
   *
   * `crit` and `fumble` used to be read off `face` alone, and a caller showing a
   * placeholder while the die tumbles has to pass SOME face. The Deep Run's
   * reveal passes 20, so for the first second of every single roll the die wore
   * the gold critical border, printed the word "Critical" underneath, and told a
   * screen reader "rolled 20, a critical". Then it landed on a 7.
   */
  const crit = !rolling && face === sides;
  const fumble = !rolling && face === 1;
  const tone = crit ? "die-crit" : fumble ? "die-fail" : "";
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span
        className={`die ${tone} ${rolling ? "tp-anim-roll" : ""}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
        role="img"
        aria-label={
          rolling
            ? `d${sides}, still rolling`
            : `d${sides} rolled ${face}${crit ? ", a critical, always clears" : fumble ? ", a fumble, always fails" : ""}`
        }
      >
        {/* A die in the air shows no number, or it shows one it is not going to land on. */}
        {rolling ? <span aria-hidden>&middot;&middot;</span> : face}
      </span>
      {(crit || fumble) && (
        // Capped and centred rather than left to run: the die is a flex item in
        // a ledger row, and a single unbroken line of gloss widened the column
        // and squeezed the numbers beside it. Two short lines instead.
        <span
          className={`die-verdict font-mono max-w-[6.5rem] text-center text-[10px] font-bold uppercase leading-tight tracking-[0.1em] ${crit ? "text-accent" : "text-danger"}`}
        >
          {crit ? "Critical: always clears" : "Fumble: always fails"}
        </span>
      )}
    </span>
  );
}

/** Countdown ring. role="timer" so a screen reader can poll it. */
export function Timer({
  endsAt,
  totalMs,
  size = 48,
}: {
  endsAt: number;
  totalMs: number;
  size?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, endsAt - now);
  const seconds = Math.ceil(left / 1000);
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, left / totalMs)) : 0;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const urgent = left <= 5000;
  return (
    <span
      role="timer"
      aria-label={`${seconds} seconds remaining`}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tp-bg-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--tp-danger)" : "var(--tp-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
        />
      </svg>
      <span
        className={`num absolute text-sm ${urgent ? "text-danger" : "text-text-hi"}`}
        style={{ fontSize: Math.max(11, Math.round(size * 0.28)) }}
      >
        {seconds}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/50 bg-danger/10 px-4 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

/** The one live region. Everything that changes without a click goes through it. */
export function Announcer({ message }: { message: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text-mid">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-accent"
      />
      {label}
    </span>
  );
}

/**
 * Google AdSense unit. Renders nothing at all unless
 * NEXT_PUBLIC_ADSENSE_CLIENT is set, so an unconfigured environment shows no
 * empty boxes. Never rendered during a live encounter or a daily in progress.
 */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export function AdSlot({ zone, className = "" }: { zone: string; className?: string }) {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({});
    } catch {
      // An ad failing must never break the page.
    }
  }, []);
  if (!ADSENSE_CLIENT) return null;
  return (
    <div className={className} data-zone={zone}>
      <p className="label-caps mb-1 text-text-low">Advertisement</p>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
