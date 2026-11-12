"use client";

import { SmallButton, Spinner } from "@/components/ui";
import type { HistoryEntry, HistoryTab } from "@/lib/history";
import type { FileState } from "./use-history-records";

export const timeFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** The date text shown on a row, also matched by the search box. Includes the ISO day (2026-11-11). */
export function dateSearchText(r: HistoryEntry): string {
  const d = new Date(r.createdAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${timeFormat.format(d)} ${iso}`;
}

export function RecordRow({ record: r, file, onPdf, onJson, onRetry, onPreview, onEdit, onDelete, selected, onSelect }: {
  record: HistoryEntry;
  /** With onSelect, shows a checkbox (disabled while the record is generating). */
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  /** Shows a Delete button (not while the record is generating). */
  onDelete?: () => void;
  file?: FileState;
  onPdf: () => void;
  onJson: () => void;
  onRetry: () => void;
  /** Opens the PDF preview (finished records). */
  onPreview?: () => void;
  /** Opens the text editor (finished records). */
  onEdit?: () => void;
}) {
  const title = [r.role, r.company].filter(Boolean).join(" · ") || r.jobDescription.split("\n")[0]?.slice(0, 80) || "Job description";
  const done = r.status === "succeeded";

  return (
    <li
      className={`rounded-lg border px-3 py-1.5 transition ${selected ? "border-cyan-400/70 bg-cyan-50/60 dark:border-cyan-400/40 dark:bg-cyan-400/[0.06]" : "border-slate-200 dark:border-white/10"}`}
    >
      <div className="flex items-center justify-between gap-2">
        {onSelect && (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            disabled={r.status === "pending"}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select ${title}`}
            className="size-4 shrink-0 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:accent-cyan-400"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-medium" title={title}>
              {title}
            </span>
            {/* Server and browser time zones differ; the browser's value wins. */}
            <time dateTime={r.createdAt} suppressHydrationWarning className="shrink-0 whitespace-nowrap text-xs text-slate-500">
              {timeFormat.format(new Date(r.createdAt))}
            </time>
          </p>
          {done && r.pdfFileName && (
            <p className="truncate text-xs text-slate-500" title={r.pdfFileName}>
              {r.pdfFileName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {file?.error && (
            <span title={file.error} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Download failed
            </span>
          )}
          {r.status === "pending" && (
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-cyan-300">
              <Spinner className="h-3 w-3" /> Generating…
            </span>
          )}
          {r.status === "failed" && (
            <>
              <span title={r.error ?? undefined} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                Failed
              </span>
              <SmallButton onClick={onRetry}>Retry</SmallButton>
            </>
          )}
          {done && onPreview && (
            <IconButton label={`Preview ${title}`} title="Preview PDF" onClick={onPreview}>
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path fillRule="evenodd" d="M.66 10.59a1.65 1.65 0 0 1 0-1.19A10 10 0 0 1 10 3c4.25 0 7.88 2.65 9.34 6.4.15.39.15.8 0 1.19A10 10 0 0 1 10 17c-4.25 0-7.88-2.65-9.34-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
            </IconButton>
          )}
          {done && onEdit && (
            <IconButton label={`Edit ${title}`} title="Edit text" onClick={onEdit}>
              <path d="m5.43 13.82-1.4 3.5a.5.5 0 0 0 .65.65l3.5-1.4a4 4 0 0 0 1.34-.89l7.5-7.5a1.88 1.88 0 0 0-2.65-2.65l-7.5 7.5a4 4 0 0 0-.89 1.34Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </IconButton>
          )}
          {done && (
            <>
              <SmallButton onClick={onPdf} disabled={Boolean(file?.busy)}>
                <span className="flex items-center gap-1">
                  {file?.busy === "pdf" && <Spinner className="h-3 w-3" />}
                  PDF
                </span>
              </SmallButton>
              <SmallButton onClick={onJson} disabled={Boolean(file?.busy)}>
                JSON
              </SmallButton>
            </>
          )}
          {onDelete && r.status !== "pending" && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${title}`}
              title="Delete"
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.18-2.36.3a.75.75 0 1 0 .23 1.49l.15-.02.84 10.52A2.75 2.75 0 0 0 7.6 19h4.8a2.75 2.75 0 0 0 2.74-2.52l.84-10.52.15.02a.75.75 0 0 0 .23-1.49c-.78-.12-1.56-.22-2.36-.3v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function IconButton({ label, title, onClick, children }: { label: string; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-cyan-300"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}

/** Created / Not created switch. Counts are optional (the paged history page doesn't know them). */
export function StatusTabs({ tab, onChange, counts, generating, className = "" }: {
  tab: HistoryTab;
  /** e.g. "w-full" to stretch the tabs across their box. */
  className?: string;
  onChange: (tab: HistoryTab) => void;
  counts?: Record<HistoryTab, number>;
  generating: number;
}) {
  const tabs = [
    ["created", "Created"],
    ["not-created", "Not created"],
  ] as const;
  return (
    <div role="tablist" aria-label="Resume status" className={`inline-flex rounded-lg border border-slate-200 p-1 dark:border-white/15 ${className}`}>
      {tabs.map(([value, label]) => (
        <button
          key={value}
          role="tab"
          type="button"
          aria-selected={tab === value}
          onClick={() => onChange(value)}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm ${tab === value ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"}`}
        >
          {value === "not-created" && generating > 0 && <Spinner className="h-3.5 w-3.5" />}
          {label}
          {counts && <span className={`rounded-full px-1.5 text-xs ${tab === value ? "bg-white/20" : "bg-slate-100 dark:bg-white/[0.06]"}`}>{counts[value]}</span>}
        </button>
      ))}
    </div>
  );
}

export const searchInputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/15 dark:border-white/15 dark:bg-[#0a0e1f]";
