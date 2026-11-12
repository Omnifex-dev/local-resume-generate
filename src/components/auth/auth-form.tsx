"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/server/auth/actions";
import { Alert, AuthCard, Field, icons, SubmitButton } from "./ui";

type Props = {
  mode: "login" | "register";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";
  const fe = state.fieldErrors ?? {};

  return (
    <AuthCard>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{isRegister ? "Create your account" : "Welcome back"}</h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        {isRegister ? "It only takes a moment." : "Sign in with your username or email."}
      </p>

      <form action={formAction} noValidate className="mt-7 space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}

        {isRegister ? (
          <>
            <Field
              id="username"
              label="Username"
              icon={icons.user}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={state.values?.username}
              required
              maxLength={32}
              errors={fe.username}
            />
            <Field
              id="email"
              label="Email"
              icon={icons.mail}
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              defaultValue={state.values?.email}
              required
              maxLength={254}
              errors={fe.email}
            />
          </>
        ) : (
          <Field
            id="identifier"
            label="Username or email"
            icon={icons.at}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.values?.identifier}
            required
            maxLength={254}
            errors={fe.identifier}
          />
        )}

        <Field
          id="password"
          label="Password"
          icon={icons.lock}
          password
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          maxLength={128}
          errors={fe.password}
        />
        {isRegister && !fe.password && <p className="-mt-2 text-xs text-slate-500">At least 8 characters.</p>}

        <SubmitButton pending={pending} pendingLabel={isRegister ? "Creating account…" : "Signing in…"}>
          {isRegister ? "Create account" : "Sign in"}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link href={isRegister ? "/login" : "/register"} className="font-medium text-cyan-700 hover:text-cyan-600 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200">
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </AuthCard>
  );
}
