import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Accessibility as an enforced invariant, not a claim in a comment.
 *
 * The palette is read straight out of design/tokens.css, so the moment somebody
 * nudges a hex for aesthetic reasons and drops a pairing below AA, this fails
 * with the exact ratio. Carried over from Shareholder Party, where the same test
 * found five real failures that the token comments had confidently described as
 * passing, one of them on the signature element of the whole product.
 *
 * WCAG 2.1: 4.5:1 for body text, 3:1 for large text (24px, or 19px bold) and for
 * the boundary of a UI component.
 */

const CSS = readFileSync(join(process.cwd(), "design", "tokens.css"), "utf8");

/** Pull a `--tp-name: #RRGGBB;` value straight out of the stylesheet. */
function token(name: string): string {
  const match = CSS.match(new RegExp(`--tp-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`token --tp-${name} not found in design/tokens.css`);
  return match[1].toUpperCase();
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every dark surface a piece of text can land on. */
const SURFACES = ["bg-0", "bg-1", "bg-2", "bg-3"] as const;

describe("ink on the table", () => {
  for (const text of ["text-hi", "text-mid", "text-low"] as const) {
    for (const surface of SURFACES) {
      it(`${text} reads on ${surface}`, () => {
        const ratio = contrast(token(text), token(surface));
        expect(ratio, `${text} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("the three lights", () => {
  // Semantic colour is never the only signal in the UI, but it still has to be
  // readable when it carries a number or a word.
  for (const signal of ["accent", "danger", "success", "arcane", "warning"] as const) {
    for (const surface of SURFACES) {
      it(`${signal} reads on ${surface}`, () => {
        const ratio = contrast(token(signal), token(surface));
        expect(ratio, `${signal} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("puts legible ink on a filled button", () => {
    for (const fill of ["accent", "danger", "success"] as const) {
      const ratio = contrast(token("ink"), token(fill));
      expect(ratio, `ink on ${fill} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the character sheet", () => {
  // The signature surface. If paper stops working the product stops working.
  it("sets its ink dark enough to read", () => {
    const ratio = contrast(token("paper-ink"), token("paper"));
    expect(ratio, `paper-ink on paper is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps its secondary ink legible too", () => {
    const ratio = contrast(token("paper-ink-mid"), token("paper"));
    expect(ratio, `paper-ink-mid on paper is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("rules its boxes visibly enough to see, as a component boundary", () => {
    const ratio = contrast(token("paper-rule"), token("paper"));
    expect(ratio, `paper-rule on paper is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.4);
  });

  it("stays a light surface, so it always reads as paper on a dark table", () => {
    // Not a contrast rule, an identity rule: if paper ever darkens toward the
    // table the whole visual argument collapses.
    expect(luminance(token("paper"))).toBeGreaterThan(0.5);
    expect(luminance(token("bg-0"))).toBeLessThan(0.05);
  });
});

describe("party colours", () => {
  it("carries dark initials on every one of the eight", () => {
    for (let i = 0; i < 8; i++) {
      const ratio = contrast(token(`party-${i}`), token("ink"));
      expect(ratio, `party-${i} with ink is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps all eight distinguishable from the table behind them", () => {
    for (let i = 0; i < 8; i++) {
      const ratio = contrast(token(`party-${i}`), token("bg-1"));
      expect(ratio, `party-${i} on bg-1 is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("controls", () => {
  it("gives an input a visible edge on every surface it sits on", () => {
    for (const surface of SURFACES) {
      const ratio = contrast(token("border-input"), token(surface));
      expect(ratio, `border-input on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not pretend the decorative divider is a control edge", () => {
    // --tp-border is deliberately too faint for a control. This test exists so
    // nobody "fixes" a missing outline by reaching for it.
    expect(contrast(token("border"), token("bg-0"))).toBeLessThan(3);
  });
});
