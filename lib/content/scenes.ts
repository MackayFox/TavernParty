/**
 * The scene pool.
 *
 * Split across two files purely so two people can write scenes at once without
 * fighting over one file. Deck A leans on the opening of a bad night, Deck B on
 * the part where consequences start arriving, but the engine draws from the
 * combined pool and does not care which half a scene came from.
 */
import type { Scene } from "@/lib/game/types";
import { SCENES_A } from "./scenes-a";
import { SCENES_B } from "./scenes-b";

export const SCENES: Scene[] = [...SCENES_A, ...SCENES_B];

export const SCENES_BY_ID: Record<string, Scene> = Object.fromEntries(
  SCENES.map((s) => [s.id, s])
);

export function getScene(id: string): Scene | undefined {
  return SCENES_BY_ID[id];
}

/** The one approach per scene whose target number is hidden until bought. */
export function recklessOf(scene: Scene) {
  return scene.approaches.find((a) => a.reckless);
}
