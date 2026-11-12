"use client";

import { useState } from "react";

export const icons = {
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5",
  at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  key: "M15 7a4 4 0 1 1-3.9 5H8v2H6v2H3v-3l5.1-5.1A4 4 0 0 1 15 7zM16 9.5h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  mailOpen: "M3 9l9-6 9 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9l9 6 9-6",
};

export function Icon({ d, className = "size-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Solid (not see-through) panel so the background never shows inside the form. */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-indigo-900/10 sm:p-10 dark:border-white/10 dark:bg-[#0a0e1f] dark:shadow-black/70">
      <div aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent dark:via-cyan-300/60" />
      {children}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${
        tone === "error"
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      }`}
    >
      {children}
    </p>
  );
}

type FieldProps = {
  id: string;
  label: string;
  icon: string;
  errors?: string[];
  password?: boolean;
  inputClassName?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({ id, label, icon, errors, password, inputClassName = "", type = "text", ...input }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const error = errors?.[0];
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium tracking-wide text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400 transition-colors group-focus-within:text-cyan-600 dark:text-slate-500 dark:group-focus-within:text-cyan-300">
          <Icon d={icon} />
        </span>
        <input
          id={id}
          name={id}
          type={password ? (visible ? "text" : "password") : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-xl border bg-slate-50 py-3 pl-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:bg-white focus:ring-4 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/[0.07] ${
            password ? "pr-12" : "pr-3.5"
          } ${
            error
              ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-500/15"
              : "border-slate-300 hover:border-slate-400 focus:border-cyan-500 focus:ring-cyan-500/15 dark:border-white/10 dark:hover:border-white/20 dark:focus:border-cyan-400/70 dark:focus:ring-cyan-400/15"
          } ${inputClassName}`}
          {...input}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-1.5 my-1.5 grid w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:outline-cyan-300"
          >
            <Icon d={visible ? icons.eyeOff : icons.eye} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel = "Please wait…" }: { pending: boolean; children: React.ReactNode; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-70"
    >
      <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      <span className="relative">{pending ? pendingLabel : children}</span>
    </button>
  );
}
