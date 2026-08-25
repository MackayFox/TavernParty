#!/usr/bin/env node
/**
 * Put the house's own rooms on the shelf.
 *
 *   npm run dev            # in one terminal
 *   node scripts/seed-rooms.mjs
 *
 * This is the cold-start answer, and it is the difference between a builder
 * somebody uses and one they close. A dungeon is about 1,100 words if you write
 * every floor; it is a two minute job if you pick six off a shelf. So the shelf
 * has to have something on it before the first stranger arrives, and the only
 * rooms that exist on day one are the twenty the house wrote.
 *
 * Idempotent: run it as often as you like. Rooms are keyed on their own id and a
 * second insert is a no-op.
 */

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = flag("base", process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");

// Through the API rather than by importing the pool: the data module is
// TypeScript and a plain node run cannot read it, and going through the same
// door everybody else uses is the only way to know that door works.
const res = await fetch(`${BASE}/api/dungeons/seed`, { method: "POST" });
if (!res.ok) {
  console.error(`Seeding failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const body = await res.json();
console.log(`Shelf now holds ${body.total} rooms (${body.added} added).`);
