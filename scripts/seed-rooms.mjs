#!/usr/bin/env node
/**
 * Put the house's own rooms on the shelf, and the house's own dungeon in the Hall.
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

const d = body.demo;
if (!d) {
  console.log("No demo dungeon in the response.");
} else if (d.already && d.stale) {
  console.log(`
THE STONE WALK (${d.code}) is out of date and has been played ${d.plays} times.`);
  console.log(d.note);
  process.exitCode = 1;
} else if (d.already) {
  console.log(`
THE STONE WALK (${d.code}) is already up. ${d.difficulty}, par ${d.par}.`);
} else if (!d.published) {
  console.log(`
THE STONE WALK did NOT publish. The gate said:`);
  for (const n of d.report?.notes ?? []) console.log(`  [${n.severity}] ${n.text}`);
  process.exitCode = 1;
} else {
  console.log(`
THE STONE WALK (${d.code}) published. ${d.difficulty}, par ${d.par}.`);
  console.log(`  ${d.out} of the ${d.builds} characters it allows get out alive.`);
  for (const n of d.notes ?? []) console.log(`  [${n.severity}] ${n.text}`);
  console.log(`  ${BASE}/d/${d.code}`);
}
