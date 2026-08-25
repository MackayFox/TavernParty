/**
 * What an author writes, and what a dungeon is once they have.
 *
 * THE UNIT OF AUTHORSHIP IS THE ROOM, NOT THE DUNGEON, and that is the decision
 * the whole feature turns on. A room is about 180 words and fifteen minutes;
 * a dungeon is about 1,100 and an evening. Asking a stranger for an evening on
 * their first visit is where products like this die. So the pool holds ROOMS, a
 * dungeon is an ordered list of room ids plus settings, and the minimum publish
 * is picking six out of the pool: two minutes, and it is a real dungeon with a
 * real par and a real link.
 *
 * An authored room is a `RoomDef` and nothing more. There is no `Encounter`
 * superset and no compile step, because the party mode plays ROOMS too (a
 * dungeon is a descent, and the content unit for a descent is a room). See
 * docs/PARTY_DUNGEONS.md for why the multiplayer `Scene` direction is dead.
 */
import type { RoomDef } from "@/lib/daily/deeprun-data";

/** Where a dungeon can be seen from. */
export type Visibility =
  /** Link only. Playable by anybody with the code, listed nowhere. The default. */
  | "unlisted"
  /** Waiting for a human to look at it. */
  | "submitted"
  /** In the Hall. A person put it there. */
  | "listed"
  /** Taken down. The author can still see it. */
  | "banned";

export type DungeonRow = {
  code: string;
  /**
   * Who owns this, whoever they are: an account uuid or a signed guest id.
   *
   * Separate from `authorId` because that one is a foreign key into auth.users
   * and a guest has no row there, and separate from `authorName` because a name
   * is a label rather than an identity. Comparing ownership against the display
   * name meant a guest, who has no display name, could open a draft and then
   * never edit it: every save came back "that one is not yours". Found by
   * driving the loop against a live server rather than by reading it.
   */
  ownerKey: string;
  authorId: string | null;
  authorName: string;
  title: string;
  /** What a player should know before they build. Shown on the door. */
  intro: string;
  rooms: RoomDef[];
  callingIds: string[];
  kitIds: string[];
  baseVigour: number;
  visibility: Visibility;
  /** Null until it has passed the gate once. */
  par: number | null;
  difficulty: string | null;
  /** Frozen at publish, so a browse card never pays for a solve. */
  report: unknown;
  publishedAt: string | null;
  plays: number;
  finishes: number;
  createdAt: string;
  updatedAt: string;
};

/** A room in the shared pool, which any dungeon may pick up. */
export type PoolRoom = {
  id: string;
  authorId: string | null;
  authorName: string;
  room: RoomDef;
  /** Off means the author keeps it to themselves. On by default, and said so. */
  shared: boolean;
  /** How many dungeons have picked it up. The author's quietest reward. */
  pickups: number;
  createdAt: string;
};

/** Six characters, no vowels, so nothing spells anything. */
const ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";

export function generateDungeonCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

/** The shape a draft starts in: enough to be legal is NOT the same as enough to publish. */
export function emptyDraft(
  code: string,
  authorName: string,
  ownerKey: string
): Omit<DungeonRow, "createdAt" | "updatedAt"> {
  return {
    code,
    ownerKey,
    authorId: null,
    authorName,
    title: "",
    intro: "",
    rooms: [],
    // The daily's own three, as a starting point somebody can narrow.
    callingIds: ["warden", "knife", "hedgewitch"],
    kitIds: ["tarred-rope", "whetstone", "pitch-torches", "cracked-mirror"],
    baseVigour: 9,
    visibility: "unlisted",
    par: null,
    difficulty: null,
    report: null,
    publishedAt: null,
    plays: 0,
    finishes: 0,
  };
}
