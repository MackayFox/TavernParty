import type { Player, Scores } from "@/lib/game/types";
import type { Rng } from "@/lib/game/random";

/** A die that returns exactly what you tell it to, in order, then repeats. */
export function fixedRng(values: readonly number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

/**
 * Deterministic pseudo-random, so a test can be varied without being random.
 *
 * The state is WARMED before the first value is handed out, and that matters more
 * than it looks. Raw xorshift on a small seed returns a tiny first number for
 * every seed in the range a test would use, so `rngFor(1)` through `rngFor(60)`
 * all produced a first value under 0.2. Any test that seeded this and then made a
 * single weighted choice was therefore exercising exactly one branch while
 * appearing to sweep sixty. That silently hid a change that made an outcome
 * variable: the test still saw one answer and concluded nothing had changed.
 */
export function rngFor(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const step = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 8; i++) step();
  return step;
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
    lastSeenAt: 0,
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
