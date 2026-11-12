import "server-only";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { SIGNUP_COOKIE } from "@/lib/constants";
import { db } from "../db/client";
import { pendingSignups, users } from "../db/schema";
import { isProd } from "../env";

export const CODE_TTL_MIN = 10;
export const RESEND_COOLDOWN_SEC = 60;
export const MAX_SENDS = 5;
export const MAX_ATTEMPTS = 5;
/** A sign-up not finished within this time is dropped. */
const SIGNUP_TTL_MS = 60 * 60 * 1000;

export type PendingSignup = typeof pendingSignups.$inferSelect;

const newCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");
const hashCode = (id: string, code: string) => createHash("sha256").update(`${id}:${code}`).digest("hex");
const codeExpiry = () => new Date(Date.now() + CODE_TTL_MIN * 60 * 1000);

/** "jane.doe@gmail.com" → "ja•••@gmail.com" */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}•••@${domain}`;
}

/** Which of username / email already belong to an account. */
export async function findTaken(username: string, email: string): Promise<{ username: boolean; email: boolean }> {
  const rows = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)));
  return { username: rows.some((r) => r.username === username), email: rows.some((r) => r.email === email) };
}

/** Stores the sign-up and returns the code to email. Starting again with the same email replaces the old one. */
export async function startSignup(input: { username: string; email: string; passwordHash: string }) {
  const id = randomUUID();
  const code = newCode();
  await db.delete(pendingSignups).where(or(lt(pendingSignups.createdAt, new Date(Date.now() - SIGNUP_TTL_MS)), eq(pendingSignups.email, input.email)));
  await db.insert(pendingSignups).values({ id, ...input, codeHash: hashCode(id, code), codeExpiresAt: codeExpiry() });
  return { id, code };
}

export async function deleteSignup(id: string) {
  await db.delete(pendingSignups).where(eq(pendingSignups.id, id));
}

export async function setSignupCookie(id: string) {
  (await cookies()).set(SIGNUP_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SIGNUP_TTL_MS / 1000,
  });
}

export async function clearSignupCookie() {
  (await cookies()).delete(SIGNUP_COOKIE);
}

/** This browser's unfinished sign-up, if any. */
export async function getPendingSignup(): Promise<PendingSignup | null> {
  const id = (await cookies()).get(SIGNUP_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(pendingSignups).where(eq(pendingSignups.id, id)).limit(1);
  if (!row || row.createdAt.getTime() < Date.now() - SIGNUP_TTL_MS) return null;
  return row;
}

export type CodeCheck = { ok: true } | { ok: false; reason: "wrong"; attemptsLeft: number } | { ok: false; reason: "expired" | "locked" };

export async function checkCode(row: PendingSignup, code: string): Promise<CodeCheck> {
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (row.codeExpiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(row.id, code), "hex");
  if (expected.length === actual.length && timingSafeEqual(expected, actual)) return { ok: true };

  const [updated] = await db
    .update(pendingSignups)
    .set({ attempts: sql`${pendingSignups.attempts} + 1` })
    .where(eq(pendingSignups.id, row.id))
    .returning({ attempts: pendingSignups.attempts });
  const left = MAX_ATTEMPTS - (updated?.attempts ?? MAX_ATTEMPTS);
  return left > 0 ? { ok: false, reason: "wrong", attemptsLeft: left } : { ok: false, reason: "locked" };
}

/** Creates the account from a verified sign-up. Throws a unique violation if the name or email was taken meanwhile. */
export async function completeSignup(row: PendingSignup): Promise<string> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ username: row.username, email: row.email, passwordHash: row.passwordHash })
      .returning({ id: users.id });
    await tx.delete(pendingSignups).where(eq(pendingSignups.id, row.id));
    return user!.id;
  });
}

export type Resend = { ok: true; code: string } | { ok: false; reason: "cooldown"; waitSec: number } | { ok: false; reason: "limit" };

/** A fresh code (old one stops working, wrong-code count resets), within the resend limits. */
export async function refreshCode(row: PendingSignup): Promise<Resend> {
  const wait = Math.ceil((row.lastSentAt.getTime() + RESEND_COOLDOWN_SEC * 1000 - Date.now()) / 1000);
  if (wait > 0) return { ok: false, reason: "cooldown", waitSec: wait };
  if (row.sends >= MAX_SENDS) return { ok: false, reason: "limit" };
  const code = newCode();
  await db
    .update(pendingSignups)
    .set({
      codeHash: hashCode(row.id, code),
      codeExpiresAt: codeExpiry(),
      attempts: 0,
      sends: sql`${pendingSignups.sends} + 1`,
      lastSentAt: new Date(),
    })
    .where(eq(pendingSignups.id, row.id));
  return { ok: true, code };
}
