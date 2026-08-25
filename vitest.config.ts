import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    /**
     * Put every spy back after each test, always.
     *
     * One suite spies on global `Math.random` to force the rate limiter's
     * sampled garbage collection, and dungeon codes are generated from the same
     * global. When those two files shared a worker the spy could still be live
     * while a code was generated, which produced the same code twice, which
     * produced a collision, which made a test about the gate fail roughly one run
     * in ten with a message about publishing. A flake that only appears in a full
     * run is the worst kind: it trains people to re-run rather than to look.
     */
    restoreMocks: true,
    unstubGlobals: true,
  },
});
