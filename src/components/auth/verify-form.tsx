"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { cancelSignupAction, resendCodeAction, verifyCodeAction, type AuthFormState } from "@/server/auth/actions";
import { Alert, AuthCard, Field, Icon, icons, SubmitButton } from "./ui";

type Props = { maskedEmail: string; resendAt: number; cooldownSec: number; devCode?: string | null };

export function VerifyForm({ maskedEmail, resendAt, cooldownSec, devCode }: Props) {
  const [state, verify, verifying] = useActionState(verifyCodeAction, {});
  const [resent, resend, resending] = useActionState<AuthFormState>(resendCodeAction, {});
  const [now, setNow] = useState(() => Date.now());
  const [nextResendAt, setNextResendAt] = useState(resendAt);

  // After a successful resend the cooldown starts again.
  useEffect(() => {
    if (resent.notice) setNextResendAt(Date.now() + cooldownSec * 1000);
  }, [resent, cooldownSec]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const wait = Math.max(0, Math.ceil((nextResendAt - now) / 1000));
  const latest = (resent.nonce ?? 0) > (state.nonce ?? 0) ? resent : state;
  const restart = state.restart || resent.restart;
  const shownDevCode = resent.devCode ?? devCode;

  return (
    <AuthCard>
      <div className="mb-6 grid size-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
        <Icon d={icons.mailOpen} className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white">Check your email</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
        We sent a 6-digit code to <span className="font-medium text-slate-200">{maskedEmail}</span>. Enter it below to finish creating your account.
      </p>

      {shownDevCode && !restart && (
        <div className="mt-5 rounded-xl border border-dashed border-amber-300/30 px-3.5 py-2.5 text-xs text-amber-200/80">
          Email sending is off (SMTP isn&apos;t set in .env), so here is your code:{" "}
          <span className="font-mono text-sm font-semibold tracking-[0.3em] text-amber-100">{shownDevCode}</span>
        </div>
      )}

      <form action={verify} noValidate className="mt-7 space-y-4">
        {latest.error && <Alert tone="error">{latest.error}</Alert>}
        {!latest.error && latest.notice && <Alert tone="success">{latest.notice}</Alert>}

        {restart ? (
          <Link
            href="/register"
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Register again
          </Link>
        ) : (
          <>
            <Field
              id="code"
              label="Verification code"
              icon={icons.key}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="000000"
              autoFocus
              defaultValue={state.values?.code}
              errors={state.fieldErrors?.code}
              inputClassName="font-mono text-lg tracking-[0.5em] placeholder:tracking-[0.5em]"
            />
            <SubmitButton pending={verifying} pendingLabel="Verifying…">
              Verify &amp; create account
            </SubmitButton>
          </>
        )}
      </form>

      {!restart && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <form action={resend}>
            <button
              type="submit"
              disabled={wait > 0 || resending}
              className="font-medium text-cyan-300 hover:text-cyan-200 hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
            >
              {resending ? "Sending…" : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
            </button>
          </form>
          <form action={cancelSignupAction}>
            <button type="submit" className="text-slate-400 hover:text-white hover:underline">
              Use a different email
            </button>
          </form>
        </div>
      )}
    </AuthCard>
  );
}
