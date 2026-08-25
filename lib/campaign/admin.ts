/**
 * Who is allowed to put things on the shelf out front. Server-only.
 *
 * A list of usernames in an environment variable, and that is the whole system.
 * It is not a role table because there is one moderator, and a role table for one
 * person is a schema nobody maintains and a second place for the answer to be
 * wrong. When there are three moderators this becomes a table; the trigger is a
 * third moderator, not a tidier design.
 *
 * A guest is never an admin, whatever their display name says: the check is on a
 * signed-in username, because a guest name is typed into a box.
 */
import { getIdentity } from "@/lib/identity";

export function adminNames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const names = adminNames();
  if (names.length === 0) return false;
  const identity = await getIdentity();
  // Signed in, with a real profile username. Never a guest.
  if (!identity || identity.kind !== "user" || !identity.username) return false;
  return names.includes(identity.username.toLowerCase());
}
