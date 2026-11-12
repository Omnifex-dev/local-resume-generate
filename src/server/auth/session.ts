import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/constants";
import { db } from "../db/client";
import { sessions, users, type UserRole } from "../db/schema";
import { isProd } from "../env";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = { id: string; username: string; role: UserRole };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Must be called from a Server Action or Route Handler (it sets a cookie). */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the logged-in user once per request (memoised with React cache). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role, active: users.active, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);

  if (!row || !row.active || row.expiresAt.getTime() <= Date.now()) return null;
  return { id: row.id, username: row.username, role: row.role };
});

/** Where a user lands after login. */
export const homeFor = (user: Pick<SessionUser, "role">) => (user.role === "admin" ? "/admin" : "/generate");

/**
 * Use at the top of every resume-workspace page, action and route handler.
 * Admins have their own site and are sent there.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  return user;
}

/** Use at the top of every admin page and action. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/generate");
  return user;
}

/** Must be called from a Server Action or Route Handler. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Signs the user out everywhere except this browser (after a password change). */
export async function deleteOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(token))));
}

/** Signs the user out everywhere (admin disabled them or reset their password). */
export async function deleteAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
