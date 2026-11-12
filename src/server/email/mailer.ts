import "server-only";
import { env, isProd } from "../env";
import { logger } from "../logger";
import { sendMail, SmtpError } from "./smtp";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't set up on this server yet. Please contact the administrator.");
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function verificationEmail(username: string, code: string, minutes: number) {
  const subject = `${code} is your Resume Generate code`;
  const text = [
    `Hi ${username},`,
    "",
    `Your Resume Generate verification code is: ${code}`,
    "",
    `It expires in ${minutes} minutes. If you didn't try to create an account, you can ignore this email.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:linear-gradient(90deg,#06b6d4,#6366f1,#d946ef);height:6px"></td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 4px;font-size:14px;color:#64748b">Resume Generate</p>
<h1 style="margin:0 0 16px;font-size:22px">Verify your email</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">Hi ${escapeHtml(username)}, enter this code to finish creating your account:</p>
<p style="margin:0 0 24px;font-size:34px;font-weight:700;letter-spacing:8px;font-family:Consolas,Menlo,monospace">${code}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b">It expires in ${minutes} minutes. If you didn't try to create an account, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/**
 * Development without SMTP: the latest code per email, so the verify page can show it.
 * Kept on globalThis so it survives hot reloads. Never used in production.
 */
const g = globalThis as typeof globalThis & { __rgDevCodes?: Map<string, string> };
const devCodes = (g.__rgDevCodes ??= new Map<string, string>());

/** The code to show on screen in development when email isn't configured; otherwise null. */
export function devVerificationCode(email: string): string | null {
  if (isProd || env.SMTP_HOST) return null;
  return devCodes.get(email.toLowerCase()) ?? null;
}

/** Sends the sign-up code. Without SMTP in development, the code is written to the server log instead. */
export async function sendVerificationCode(to: string, username: string, code: string, minutes: number): Promise<void> {
  if (!env.SMTP_HOST) {
    if (isProd) throw new EmailNotConfiguredError();
    devCodes.set(to.toLowerCase(), code);
    logger.warn({ to, code }, "SMTP_HOST is not set: verification code logged instead of emailed (development only)");
    return;
  }
  const from = env.SMTP_FROM ?? env.SMTP_USER;
  if (!from) throw new EmailNotConfiguredError();

  const mail = verificationEmail(username, code, minutes);
  try {
    await sendMail(
      { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, pass: env.SMTP_PASS },
      { from, to, ...mail },
    );
  } catch (err) {
    logger.error({ err: err instanceof SmtpError ? err.message : err, host: env.SMTP_HOST }, "sending verification email failed");
    throw err;
  }
}
