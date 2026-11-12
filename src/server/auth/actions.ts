"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, isUniqueViolation } from "../db/client";
import { users } from "../db/schema";
import { devVerificationCode, EmailNotConfiguredError, sendVerificationCode } from "../email/mailer";
import { env } from "../env";
import { logger } from "../logger";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { RateLimiter } from "./rate-limit";
import { createSession, destroySession, homeFor } from "./session";
import {
  checkCode,
  clearSignupCookie,
  CODE_TTL_MIN,
  completeSignup,
  deleteSignup,
  findTaken,
  getPendingSignup,
  refreshCode,
} from "./signup";
import { codeSchema, loginSchema, registerSchema } from "./validation";

export type AuthFormState = {
  error?: string;
  /** A success message that keeps the user on the page (e.g. "new code sent"). */
  notice?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** What the user typed, so the form can be refilled after an error (never passwords). */
  values?: Record<string, string>;
  /** Sign-up is gone (expired / finished elsewhere): the form offers to start again. */
  restart?: boolean;
  /** Development only (no SMTP): the code that would have been emailed. */
  devCode?: string;
  /** Bumped on every reply so the client can tell which reply is newest. */
  nonce?: number;
};

const FIFTEEN_MIN = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const loginPerAccount = new RateLimiter(5, FIFTEEN_MIN);
const loginPerIp = new RateLimiter(30, FIFTEEN_MIN);
const registerPerIp = new RateLimiter(10, HOUR);
const codesPerEmail = new RateLimiter(6, HOUR);
const verifyPerIp = new RateLimiter(30, FIFTEEN_MIN);

const reply = (s: AuthFormState): AuthFormState => ({ ...s, nonce: Date.now() });

async function clientIp(): Promise<string> {
  if (!env.TRUST_PROXY) return "direct";
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function tooMany(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function emailFailure(err: unknown): string {
  if (err instanceof EmailNotConfiguredError) return err.message;
  return "We couldn't send the email. Check the address and try again.";
}

// ---------------------------------------------------------------------------
// Register → email code → verify
// ---------------------------------------------------------------------------

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { username: text(formData.get("username")), email: text(formData.get("email")) };
  const parsed = registerSchema.safeParse({ ...values, password: text(formData.get("password")) });
  if (!parsed.success) return reply({ fieldErrors: parsed.error.flatten().fieldErrors, values });

  const ip = await clientIp();
  const limit = registerPerIp.check(ip);
  if (!limit.ok) return reply({ error: tooMany(limit.retryAfterSec), values });

  const { username, email, password } = parsed.data;
  try {
    const taken = await findTaken(username, email);
    if (taken.username || taken.email) {
      return reply({
        fieldErrors: {
          ...(taken.username && { username: ["That username is already taken"] }),
          ...(taken.email && { email: ["An account with this email already exists"] }),
        },
        values,
      });
    }

    // Email verification is disabled: the account is created and signed in right away.
    const [user] = await db
      .insert(users)
      .values({ username, email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    await clearSignupCookie();
    await createSession(user!.id);
    logger.info({ userId: user!.id }, "user registered");
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply({ error: "That username or email was just taken. Please choose another.", values });
    }
    logger.error({ err }, "registration failed");
    return reply({ error: "Something went wrong. Please try again.", values });
  }

  redirect("/generate"); // outside try: redirect() works by throwing
}

export async function verifyCodeAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { code: text(formData.get("code")) };
  const limit = verifyPerIp.check(await clientIp());
  if (!limit.ok) return reply({ error: tooMany(limit.retryAfterSec), values });

  const row = await getPendingSignup();
  if (!row) return reply({ error: "This sign-up has expired. Please register again.", restart: true });

  const parsed = codeSchema.safeParse(values.code);
  if (!parsed.success) return reply({ fieldErrors: { code: [parsed.error.issues[0]!.message] }, values });

  const result = await checkCode(row, parsed.data);
  if (!result.ok) {
    if (result.reason === "wrong") {
      const left = result.attemptsLeft;
      return reply({ fieldErrors: { code: [`That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`] }, values });
    }
    return reply({
      error: result.reason === "expired" ? "This code has expired. Send a new one below." : "Too many wrong codes. Send a new code below.",
    });
  }

  try {
    const userId = await completeSignup(row);
    await clearSignupCookie();
    await createSession(userId);
    logger.info({ userId }, "user registered (email verified)");
  } catch (err) {
    if (isUniqueViolation(err)) {
      await deleteSignup(row.id).catch(() => undefined);
      await clearSignupCookie();
      return reply({ error: "That username or email was taken in the meantime. Please register again.", restart: true });
    }
    logger.error({ err }, "completing sign-up failed");
    return reply({ error: "Something went wrong. Please try again.", values });
  }

  redirect("/generate");
}

export async function resendCodeAction(): Promise<AuthFormState> {
  const row = await getPendingSignup();
  if (!row) return reply({ error: "This sign-up has expired. Please register again.", restart: true });

  const perEmail = codesPerEmail.check(row.email);
  const next = perEmail.ok ? await refreshCode(row) : ({ ok: false, reason: "limit" } as const);
  if (!next.ok) {
    return reply({
      error:
        next.reason === "cooldown"
          ? `Please wait ${next.waitSec}s before asking for another code.`
          : "Too many codes were sent for this sign-up. Please register again later.",
    });
  }
  try {
    await sendVerificationCode(row.email, row.username, next.code, CODE_TTL_MIN);
  } catch (err) {
    return reply({ error: emailFailure(err) });
  }
  const devCode = devVerificationCode(row.email);
  if (devCode) return reply({ notice: "New code created (email is off in development).", devCode });
  return reply({ notice: "We sent you a new code. Codes from earlier emails no longer work." });
}

export async function cancelSignupAction(): Promise<void> {
  const row = await getPendingSignup();
  if (row) await deleteSignup(row.id);
  await clearSignupCookie();
  redirect("/register");
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { identifier: text(formData.get("identifier")) };
  const parsed = loginSchema.safeParse({ ...values, password: text(formData.get("password")) });
  if (!parsed.success) return reply({ fieldErrors: parsed.error.flatten().fieldErrors, values });

  const { identifier, password } = parsed.data;
  const ip = await clientIp();
  const accountKey = `${ip}:${identifier}`;
  for (const [limiter, key] of [
    [loginPerIp, ip],
    [loginPerAccount, accountKey],
  ] as const) {
    const res = limiter.check(key);
    if (!res.ok) return reply({ error: tooMany(res.retryAfterSec), values });
  }

  let destination = "/generate";
  try {
    const byEmail = identifier.includes("@");
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, role: users.role, active: users.active })
      .from(users)
      .where(byEmail ? eq(users.email, identifier) : eq(users.username, identifier))
      .limit(1);

    let valid = false;
    if (user) valid = await verifyPassword(user.passwordHash, password);
    else await verifyAgainstDummy(password);

    if (!user || !valid) {
      logger.info({ byEmail }, "login failed");
      return reply({ error: "Invalid username, email or password", values });
    }
    if (!user.active) {
      logger.info({ userId: user.id }, "login refused: account disabled");
      return reply({ error: "This account is disabled. Contact the administrator.", values });
    }

    loginPerAccount.reset(accountKey);
    await createSession(user.id);
    destination = homeFor(user);
  } catch (err) {
    logger.error({ err }, "login error");
    return reply({ error: "Something went wrong. Please try again.", values });
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
