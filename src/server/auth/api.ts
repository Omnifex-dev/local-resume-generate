import "server-only";
import { getCurrentUser, type SessionUser } from "./session";

/** For route handlers of the resume workspace: a signed-in, non-admin user, or an error response. */
export async function workspaceUser(): Promise<{ user: SessionUser; error?: never } | { user?: never; error: Response }> {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: { code: "unauthenticated", message: "Please sign in again." } }, { status: 401 }) };
  if (user.role !== "user") {
    return { error: Response.json({ error: { code: "forbidden", message: "Admins use the admin site." } }, { status: 403 }) };
  }
  return { user };
}
