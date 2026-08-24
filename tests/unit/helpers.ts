import type { Player, Scores } from "@/lib/game/types";
import type { Rng } from "@/lib/game/random";

/** A die that returns exactly what you tell it to, in order, then repeats. */
export function fixedRng(values: readonly number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Deterministic pseudo-random, so a test can be varied without being random. */
export function rngFor(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** A die guaranteed to roll `face`. d20 is `1 + floor(rng() * 20)`. */
export function dieShowing(face: number): Rng {
  return fixedRng([(face - 1) / 20 + 0.001]);
}

export const EVEN_SCORES: Scores = {
  brawn: 12,
  deft: 12,
  grit: 12,
  wits: 12,
  nerve: 12,
  charm: 12,
};

export function makePlayer(over: Partial<Player> = {}): Player {
  return {
    id: over.id ?? "p_a",
    name: over.name ?? "ALEX",
    isHost: false,
    isBot: false,
    connected: true,
    disconnectedAt: null,
    callingId: null,
    bloodId: null,
    kitIds: [],
    hookId: null,
    scores: { ...EVEN_SCORES },
    renown: 0,
    hookTokens: 2,
    scars: [],
    torches: 0,
    rerolls: 0,
    usedSignature: false,
    usedBloodPower: false,
    laurelFor: null,
    stats: {
      actsTaken: 0,
      recklessTaken: 0,
      flinches: 0,
      scarsKept: 0,
      scarsHidden: 0,
      crits: 0,
    },
    ...over,
  };
}
