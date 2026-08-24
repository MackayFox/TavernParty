import { NextResponse } from "next/server";
import { z } from "zod";
import { GameError } from "./game/types";

/** Uniform error surface: GameError -> 4xx with a user-facing message. */
export function handleError(err: unknown): NextResponse {
  if (err instanceof GameError) {
    const status =
      err.code === "not_found" ? 404 : err.code === "internal" ? 500 : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: "That request did not look right. Try again.", code: "bad_request" },
      { status: 400 }
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: "Something went wrong on our end. Try again.", code: "internal" },
    { status: 500 }
  );
}

/** Parse a JSON body, tolerating an empty one. */
export async function jsonBody(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}));
}
