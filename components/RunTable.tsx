/**
 * A list of finished runs. Server component: it only ever renders rows that
 * `lib/stats.ts` already fetched, so nothing here reaches the database.
 */
import { BLOODS } from "@/lib/content/bloods";
import { CALLINGS } from "@/lib/content/callings";
import { HOOKS } from "@/lib/content/hooks";
import type { RunRow } from "@/lib/stats";

const CALLING_NAME = new Map(CALLINGS.map((c) => [c.id, c.name]));
const BLOOD_NAME = new Map(BLOODS.map((b) => [b.id, b.name]));
const HOOK_NAME = new Map(HOOKS.map((h) => [h.id, h.name]));

function when(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function RunTable({ rows }: { rows: RunRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border-dim bg-bg-1 p-4 text-text-mid">
        No finished runs yet. Sit down at a table and see the night through.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-dim">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">Finished runs, most recent first</caption>
        <thead>
          <tr className="bg-bg-1 text-left">
            <th scope="col" className="px-3 py-2 font-normal label-caps">Night</th>
            <th scope="col" className="px-3 py-2 font-normal label-caps">Character</th>
            <th scope="col" className="px-3 py-2 font-normal label-caps">Hook</th>
            <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Renown</th>
            <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Scars</th>
            <th scope="col" className="px-3 py-2 text-right font-normal label-caps">Total</th>
            <th scope="col" className="px-3 py-2 font-normal label-caps">Finish</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.runId} className="border-t border-border-dim align-top">
              <td className="px-3 py-2 text-text-mid">
                {when(r.finishedAt)}
                <span className="block text-xs text-text-low">
                  {r.players} at the table, {r.acts} acts
                </span>
              </td>
              <td className="px-3 py-2 text-text-hi">
                {CALLING_NAME.get(r.callingId ?? "") ?? "Unrecorded"}
                <span className="block text-xs text-text-low">
                  {BLOOD_NAME.get(r.bloodId ?? "") ?? ""}
                </span>
              </td>
              <td className="px-3 py-2 text-text-mid">
                {HOOK_NAME.get(r.hookId ?? "") ?? "None"}
              </td>
              <td className="px-3 py-2 text-right num text-text-hi">{r.renown}</td>
              <td className="px-3 py-2 text-right num text-text-hi">{r.keptScars}</td>
              <td className="px-3 py-2 text-right num text-text-hi">{r.total}</td>
              <td className="px-3 py-2">
                {/* Not colour alone: the word and the crown both say it. */}
                {r.hoard ? (
                  <span className="text-accent">Took the Hoard</span>
                ) : (
                  <span className="text-text-mid">{ordinal(r.placement)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
