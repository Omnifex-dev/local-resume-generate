"use client";

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:focus:bg-white/[0.07]";

/** Section colors shared by Card, Panel and Modal: header, body and footer each get their own band. */
const HEADER_BAND = "border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.045]";
const BODY_BAND = "bg-white dark:bg-[#0a0e1f]";
const FOOTER_BAND = "border-t border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-[#060914]";

function TopGlow() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 z-10 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent dark:via-cyan-300/50" />;
}

export function Card({ title, description, actions, footer, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-white/10 dark:shadow-2xl dark:shadow-black/60">
      <TopGlow />
      <div className={`flex flex-wrap items-start justify-between gap-2 px-6 py-4 ${HEADER_BAND}`}>
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
        {actions}
      </div>
      <div className={`p-6 ${BODY_BAND}`}>{children}</div>
      {footer && <div className={`flex flex-wrap items-center gap-3 px-6 py-3 ${FOOTER_BAND}`}>{footer}</div>}
    </section>
  );
}

/** A compact Card for the workspace columns. */
export function Panel({ title, actions, footer, children, className = "", fill = false }: {
  title: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** On large screens: grow to the parent's height and scroll the body inside. */
  fill?: boolean;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-lg shadow-indigo-900/5 dark:border-white/10 dark:shadow-2xl dark:shadow-black/60 ${fill ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""} ${className}`}
    >
      <TopGlow />
      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${HEADER_BAND}`}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-cyan-200/80">{title}</h2>
        {actions}
      </div>
      <div className={`p-4 ${BODY_BAND} ${fill ? "scroll-panel lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""}`}>{children}</div>
      {footer && <div className={`flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5 ${FOOTER_BAND}`}>{footer}</div>}
    </section>
  );
}

type FieldProps =Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
};

export function Field({ label, value, onChange, error, hint, id, ...rest }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`${inputClass} ${error ? "border-red-500 dark:border-red-500" : ""}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function SmallButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 px-2 py-1 text-xs transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/10"
      {...rest}
    >
      {children}
    </button>
  );
}

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  showCount?: number;
};

export function TextArea({ label, value, onChange, error, showCount, id, ...rest }: TextAreaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {showCount !== undefined && (
          <span className={`text-xs ${value.length > showCount ? "text-red-600" : "text-slate-500"}`}>
            {value.length.toLocaleString()} / {showCount.toLocaleString()}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`${inputClass} min-h-40 font-mono text-xs leading-relaxed ${error ? "border-red-500 dark:border-red-500" : ""}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25 px-4 py-2 text-sm font-medium text-white hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-60 transition ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const MODAL_WIDTH = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" } as const;

/**
 * Modal on the native <dialog>: focus trapping, Esc to close and the backdrop come
 * from the browser. Children stay mounted while closed, so typed text survives
 * closing and reopening.
 */
export function Modal({ open, onClose, title, size = "lg", children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof MODAL_WIDTH;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className={`m-auto w-[calc(100%-2rem)] ${MODAL_WIDTH[size]} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 dark:backdrop:bg-[#03040c]/75 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#0a0e1f] dark:text-slate-100 dark:shadow-black/70`}
    >
      <TopGlow />
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className={`flex shrink-0 items-center justify-between gap-4 px-5 py-3 ${HEADER_BAND}`}>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className={`scroll-panel min-h-0 flex-1 overflow-y-auto px-5 py-4 ${BODY_BAND}`}>{children}</div>
        {footer && <div className={`shrink-0 px-5 py-3 ${FOOTER_BAND}`}>{footer}</div>}
      </div>
    </dialog>
  );
}
