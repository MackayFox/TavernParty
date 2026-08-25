/**
 * A dungeon row, turned into something playable. Server-only.
 *
 * The one place that knows a stored dungeon is a `Design`, so nothing else has
 * to. Kept separate from `store.ts` because the store talks to Postgres and this
 * talks to the engine, and separate from `gate.ts` because the gate is the thing
 * that decides whether a design is allowed to exist.
 */
import { puzzleFrom, type Design, type Puzzle } from "@/lib/daily/deeprun";
import type { RoomDef } from "@/lib/daily/deeprun-data";
import type { DungeonRow } from "./types";

export function designOf(row: DungeonRow): Design {
  return {
    // The code, not the date. A dungeon's dice are pinned to its own name and
    // never move again, which is what lets an author tune against a fact and
    // what makes two players' scores on it mean the same thing.
    seed: row.code,
    label: row.title || row.code,
    rooms: row.rooms,
    callingIds: row.callingIds,
    kitIds: row.kitIds,
    baseVigour: row.baseVigour,
  };
}

export function puzzleOf(row: DungeonRow): Puzzle {
  return puzzleFrom(designOf(row));
}

/** The prose the runner needs, which never goes to the client before a choice. */
export function defsOf(row: DungeonRow): RoomDef[] {
  return row.rooms;
}

/**
 * What a player is told about a dungeon before they open it.
 *
 * The par and the difficulty are read off the row rather than recomputed: the
 * dice are pinned to the code, so par is a constant, and a cold instance should
 * never burn a search to learn a number that was true at publish time.
 */
export function doorFor(row: DungeonRow) {
  return {
    code: row.code,
    title: row.title,
    intro: row.intro,
    author: row.authorName,
    floors: row.rooms.length,
    par: row.par,
    difficulty: row.difficulty,
    baseVigour: row.baseVigour,
    callings: row.callingIds.length,
    kit: row.kitIds.length,
    plays: row.plays,
    finishes: row.finishes,
    chosenAt: row.chosenAt,
  };
}
