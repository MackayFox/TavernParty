/**
 * The contract everything type-checks against.
 *
 * The game types live below the errors and are filled in as the design settles.
 * Everything a route handler or the store touches must be described here, so the
 * engine stays the single source of truth about shape.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The only error the engine ever throws.
 *
 * `code` drives the HTTP status in lib/api.ts and is matched on by the client,
 * so treat the codes as part of the public API: `not_found` becomes a 404,
 * `internal` a 500, everything else a 400 with the message shown to the player.
 */
export class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}
