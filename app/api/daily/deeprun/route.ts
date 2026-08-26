import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonBody } from "@/lib/api";
import { dailyCacheControl, resolvePlayDate } from "@/lib/daily/core";
import { MAX_FLOORS } from "@/lib/campaign/gate";
import {
  ARRAY_SIZE,
  KIT_SLOTS,
  publicPuzzle,
  puzzleFor,
  run,
  shareText,
  validBuild,
} from "@/lib/daily/deeprun";
import { parFor } from "@/lib/daily/deeprun-par";
import { defsOf, doorFor, puzzleOf } from "@/lib/campaign/puzzle";
import { countPlay, getDungeon } from "@/lib/campaign/store";
import { recordRun } from "@/lib/campaign/hall";
import { getIdentity } from "@/lib/identity";

/**
 * THE DEEP RUN.
 *
 * The GET is the dungeon WITHOUT its dice. The target numbers are in it, because
 * this is a bet and not a riddle, but the number in each room is not, because
 * finding that out when you open the door is the entire game.
 *
 * The POST takes a build and EVERY DECISION SO FAR, and replays the lot. The
 * client posts again after each room, and gets back the lines for the rooms it
 * has actually committed to and nothing beyond them. So there is no session, no
 * cookie and no row in a table, and the client cannot see a die it has not yet
 * paid for by choosing.
 *
 * ponytail: nothing stops somebody posting a whole speculative run, reading the
 * dice out of the reply, and posting a better one. That is inherent to a daily
 * with no server-side session and it is the same hole as knowing today's Wordle
 * before you play it. The fix, if it ever matters, is a signed run token issued
 * on the first POST and required on the rest; the trigger is somebody bothering.
 */
/**
 * ONE HANDLER, TWO SOURCES, and this is the best single decision in the feature.
 *
 * `?c=CODE` plays somebody's dungeon; no `c` plays tonight's. Everything else
 * about this file is unchanged, because everything else about it is the part
 * that matters: the GET is the dungeon without its dice, and the POST replays
 * only the floors committed to. A second copy of this handler is how you
 * eventually ship one that forgets to strip the dice.
 */
async function sourceFor(url: URL, dateParam?: string) {
  const code = url.searchParams.get("c");
  if (!code) {
    const { date, archive } = resolvePlayDate(dateParam ?? url.searchParams.get("date"));
    return { kind: "daily" as const, puzzle: puzzleFor(date), defs: undefined, archive, date, row: null };
  }
  const row = await getDungeon(code);
  if (!row || row.visibility === "banned" || !row.publishedAt) return null;
  return {
    kind: "dungeon" as const,
    puzzle: puzzleOf(row),
    defs: defsOf(row),
    archive: false,
    date: row.code,
    row,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = await sourceFor(url);
  if (!source) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });
  // Safe to cache in public precisely because the dice are not in it: this is
  // the dungeon everybody is handed, and it changes at UTC midnight only. An
  // authored one never changes at all, because its dice are pinned to its code.
  return NextResponse.json(
    {
      // Redacted: neither the ability a door tests nor the number it wants
      // crosses the wire. See `publicPuzzle` for why the target number stopped
      // being public, which is a reversal rather than an oversight. The reveal
      // still prints it the instant a floor resolves.
      ...publicPuzzle(source.puzzle),
      archive: source.archive,
      dungeon: source.row ? doorFor(source.row) : null,
    },
    { headers: { "Cache-Control": dailyCacheControl(source.archive) } }
  );
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  callingId: z.string().min(1).max(60),
  /** One array index per ability, in the order the abilities were sent. */
  placement: z.array(z.number().int().min(0).max(ARRAY_SIZE - 1)).length(ARRAY_SIZE),
  kitIds: z.array(z.string().min(1).max(60)).length(KIT_SLOTS),
  steps: z
    .array(z.object({ optionId: z.string().min(1).max(60), knack: z.boolean().optional() }))
    .max(MAX_FLOORS + 1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await jsonBody(req));
    const source = await sourceFor(new URL(req.url), body.date);
    if (!source) return NextResponse.json({ error: "No dungeon by that name." }, { status: 404 });
    const { puzzle, defs, archive, date } = source;
    const build = {
      callingId: body.callingId,
      placement: body.placement,
      kitIds: body.kitIds,
    };
    const problem = validBuild(puzzle, build);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const result = run(puzzle, build, body.steps, defs);
    // Over when they are out, done in, or have opened every door. Depth comes off
    // the puzzle now, because an authored dungeon may be three floors or eight.
    const finished = result.out || result.vigour <= 0 || body.steps.length >= puzzle.rooms.length;
    if (!finished) return NextResponse.json({ ...result, archive, finished });

    // Read off the row for an authored one: its dice are pinned to its code, so
    // par is a constant and a cold instance should not burn a search for it.
    const { par, best } =
      source.row?.par != null ? { par: source.row.par, best: null } : parFor(puzzle);
    if (source.row) {
      await countPlay(source.row.code, result.out);
      // The FIRST run per person is the one kept: it is the one played blind,
      // and after it you know all of this dungeon's numbers.
      const who = await getIdentity(true);
      if (who) {
        await recordRun({
          code: source.row.code,
          playerKey: who.id,
          score: result.score,
          par,
          finished: result.out,
          depth: result.depth,
          stoppedOn: result.out ? null : result.depth,
        });
      }
    }
    return NextResponse.json({
      ...result,
      archive,
      finished,
      /** Every daily answers with `score` and `par`, whatever it calls them inside. */
      par,
      /** The best run there was tonight. With the score, and never before it. */
      bestRun: best,
      share: shareText(
        source.kind === "dungeon" ? puzzle.label : date,
        result,
        par,
        source.row ? { code: source.row.code, author: source.row.authorName } : null
      ),
    });
  } catch (err) {
    return handleError(err);
  }
}
