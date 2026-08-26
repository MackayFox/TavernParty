#!/usr/bin/env node
/**
 * LOOK AT IT. A headless pass that plays the Deep Run and photographs it.
 *
 * This exists because two rounds of UI went out unverified and a person found
 * the bugs on their phone both times: the full sheet unusable at 390px, the
 * ability boxes printing a modifier with no score behind it, and no way off the
 * descent at all because the stage covers the site nav. Every one of those is
 * visible in one screenshot and invisible in a passing test suite.
 *
 * Not a test and deliberately not in `npm test`: it needs a server, it takes
 * seconds, and its output is pictures for a human. Run it against dev.
 *
 *   node scripts/shots.mjs [--base=http://localhost:3000] [--out=./shots]
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out", "shots");
mkdirSync(OUT, { recursive: true });

const shots = [];
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
  console.log("  shot", path);
}

/** Build a character and go down. The build screen is a form, so drive it. */
async function goDown(page) {
  await page.goto(`${BASE}/daily/deeprun`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Trained in/ }).first().click();
  await page.getByRole("button", { name: "Spread it the safe way" }).click();
  const kit = page.locator('button[aria-pressed="false"]', { hasText: /^\s*○/ });
  // The two kit cards are the only remaining unpressed cards below the sheet.
  const cards = await page.locator("button[aria-pressed]").all();
  let taken = 0;
  for (const c of cards) {
    if (taken >= 2) break;
    const label = (await c.textContent()) ?? "";
    if (/\+\d\s+(Brawn|Deft|Grit|Wits|Nerve|Charm)/.test(label)) {
      await c.click();
      taken++;
    }
  }
  await page.getByRole("button", { name: "Go down" }).click();
  /*
   * The descent is a client tree behind a fetch. In dev it takes a moment to
   * hydrate, and a click that lands before that hits dead HTML and does nothing
   * at all, which is exactly how this script convinced me the full sheet was
   * broken when it was not. Wait for the rail, then give React a beat.
   */
  await page.waitForSelector('nav[aria-label="The descent so far"]');
  await page.waitForTimeout(2000);
  void kit;
}

const runs = [
  { name: "phone", ctx: { ...devices["iPhone 13"] } },
  { name: "desktop", ctx: { viewport: { width: 1280, height: 860 } } },
];

const browser = await chromium.launch();
try {
  for (const { name, ctx } of runs) {
    const context = await browser.newContext(ctx);
    const page = await context.newPage();
    console.log(name);

    await page.goto(`${BASE}/daily/deeprun`, { waitUntil: "networkidle" });
    await shot(page, `${name}-1-build`);

    await goDown(page);
    await shot(page, `${name}-2-descent`);

    await page.getByRole("button", { name: /Full sheet/ }).click();
    await page.waitForSelector("dialog[open]", { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, `${name}-3-fullsheet`);

    // Prove the sheet can be dismissed without scrolling back up.
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(400);
    const stillOpen = await page.locator("dialog[open]").count();
    console.log("  sheet closed on Close:", stillOpen === 0 ? "yes" : "NO");

    /*
     * THE WHOLE MOBILE CONTRACT, ASSERTED.
     *
     * A phone cannot show prose, four doors and your character at once, so the
     * deal is: the roll and the outcome are a modal, and the next floor begins
     * at its beginning. That is two claims and both are checkable. Scroll to the
     * bottom of the floor first, because landing at the top is only meaningful
     * if you were somewhere else.
     */
    const stageSel = 'div[class*="overflow-y-auto"]';
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollTop = el.scrollHeight;
    }, stageSel);
    await page.waitForTimeout(200);
    const before = await page.evaluate(
      (sel) => document.querySelector(sel)?.scrollTop ?? -1,
      stageSel
    );
    console.log("  scrolled to bottom of floor 1:", Math.round(before) + "px");

    await page.locator("article ul li button:not([disabled])").first().click();
    await page.waitForSelector("dialog[open]", { timeout: 15000 });
    await page.waitForTimeout(2600);
    await shot(page, `${name}-4-reveal`);
    console.log("  outcome arrived in a modal:", (await page.locator("dialog[open]").count()) > 0 ? "yes" : "NO");

    await page.getByRole("button", { name: /Press on|See how it went/ }).click();
    await page.waitForTimeout(900);
    const after = await page.evaluate(
      (sel) => document.querySelector(sel)?.scrollTop ?? -1,
      stageSel
    );
    const floor = await page.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find((n) =>
        /^Floor [0-9]+ of [0-9]+$/i.test((n.textContent || "").trim())
      );
      return el ? el.textContent.trim() : "?";
    });
    console.log("  next floor starts at:", Math.round(after) + "px", "(" + floor + ")");
    console.log("  landed at the top:", after === 0 ? "yes" : "NO");
    await shot(page, `${name}-5-nextfloor`);

    // And the way out is reachable from the descent.
    const out = await page.getByRole("link", { name: /Leave the descent/ }).count();
    console.log("  way out present:", out > 0 ? "yes" : "NO");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    console.log("  horizontal overflow:", overflow ? "YES (bad)" : "no");

    await context.close();
  }
} finally {
  await browser.close();
}
console.log("\n" + shots.length + " shots in " + OUT);
