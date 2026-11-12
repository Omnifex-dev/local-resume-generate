"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Field, Modal, PrimaryButton } from "@/components/ui";
import { logoutAction } from "@/server/auth/actions";
import { changePasswordAction, type ActionResult } from "@/server/settings/actions";
import { StatusLine } from "./generation-form";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h3>;
}

function ChangePassword() {
  const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const [values, setValues] = useState(empty);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const set = (k: keyof typeof empty) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setResult(null);
  };

  return (
    <section>
      <SectionTitle>Password</SectionTitle>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await changePasswordAction(values);
            setResult(r.ok ? { ok: true, warning: undefined } : r);
            if (r.ok) setValues(empty);
          });
        }}
      >
        <Field id="current-password" label="Current password" type="password" autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="new-password" label="New password" type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint="At least 8 characters" />
          <Field id="confirm-password" label="Repeat new password" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" disabled={pending || !values.currentPassword || !values.newPassword}>
            {pending ? "Saving…" : "Change password"}
          </PrimaryButton>
          {result?.ok ? <p role="status" className="text-sm text-green-700 dark:text-green-400">Password changed. Other devices were signed out.</p> : <StatusLine result={result} />}
        </div>
      </form>
    </section>
  );
}

const GEAR =
  "M7.84 1.8A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.8l.29 1.45c.5.2.96.47 1.38.79l1.4-.47a1 1 0 0 1 1.18.45l1.18 2.04a1 1 0 0 1-.2 1.25l-1.11.98a6.1 6.1 0 0 1 0 1.42l1.11.98a1 1 0 0 1 .2 1.25l-1.18 2.04a1 1 0 0 1-1.18.45l-1.4-.47c-.42.32-.88.59-1.38.79l-.29 1.45a1 1 0 0 1-.98.8H8.82a1 1 0 0 1-.98-.8l-.29-1.45a6 6 0 0 1-1.38-.79l-1.4.47a1 1 0 0 1-1.18-.45L2.41 13.4a1 1 0 0 1 .2-1.25l1.11-.98a6.1 6.1 0 0 1 0-1.42l-1.11-.98a1 1 0 0 1-.2-1.25l1.18-2.04a1 1 0 0 1 1.18-.45l1.4.47c.42-.32.88-.59 1.38-.79l.29-1.45ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z";
const LOGOUT =
  "M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .41.34.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Zm10.97 2.47a.75.75 0 0 1 1.06 0l2.75 2.75a.75.75 0 0 1 0 1.06l-2.75 2.75a.75.75 0 1 1-1.06-1.06l1.47-1.47H7.75a.75.75 0 0 1 0-1.5h7.69l-1.47-1.47a.75.75 0 0 1 0-1.06Z";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:bg-slate-100 focus-visible:text-slate-900 dark:text-slate-200 dark:hover:bg-white/[0.07] dark:hover:text-white dark:focus-visible:bg-white/[0.07] dark:focus-visible:text-white";

/** Header account menu: a dropdown with Settings (opens a modal) and Log out. */
export function UserMenu({ username }: { username: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close on a click outside or on Escape (focus goes back to the button).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Arrow keys move between the items.
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 py-1 pl-1 pr-2.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:focus-visible:outline-cyan-300"
      >
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 text-xs font-semibold uppercase text-white">
          {username.slice(0, 1)}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{username}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={`size-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="auth-rise absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-indigo-900/15 [animation-duration:.2s] dark:border-white/10 dark:bg-[#0a0e1f] dark:shadow-black/70"
        >
          <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent dark:via-cyan-300/60" />
          <p className="truncate px-3 pb-2 pt-1.5 text-xs text-slate-500">
            Signed in as <span className="font-medium text-slate-800 dark:text-slate-300">{username}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-4 text-slate-400">
              <path fillRule="evenodd" d={GEAR} clipRule="evenodd" />
            </svg>
            Change Password
          </button>
          <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className={`${itemClass} hover:text-rose-600 focus-visible:text-rose-600 dark:hover:text-rose-200 dark:focus-visible:text-rose-200`}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="size-4 text-slate-400">
                <path fillRule="evenodd" d={LOGOUT} clipRule="evenodd" />
              </svg>
              Log out
            </button>
          </form>
        </div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" size="md">
        <div className="space-y-6">
          <ChangePassword />
          <p className="text-xs text-slate-500">
            Page size is in the Theme panel; model and prompt are in the right-hand panel. The OpenAI key is managed by the administrator.
          </p>
        </div>
      </Modal>
    </div>
  );
}
