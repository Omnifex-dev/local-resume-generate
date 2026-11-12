"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Modal, SmallButton, Spinner } from "@/components/ui";
import type { HistoryEntry } from "@/lib/history";

/**
 * Checkbox selection over the shown records. Generating records can't be
 * deleted or downloaded, so they can't be selected either.
 */
export function useRecordSelection(shown: HistoryEntry[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectable = shown.filter((r) => r.status !== "pending");
  const chosen = selectable.filter((r) => selected.has(r.id));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const toggle = useCallback(
    (id: string, on: boolean) =>
      setSelected((s) => {
        const next = new Set(s);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const drop = useCallback(
    (ids: string[]) =>
      setSelected((s) => {
        const next = new Set(s);
        ids.forEach((id) => next.delete(id));
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected,
    selectable,
    chosen,
    allChosen,
    toggle,
    drop,
    clear,
    setAll: (on: boolean) => setSelected(on ? new Set(selectable.map((r) => r.id)) : new Set()),
  };
}

export type RecordSelection = ReturnType<typeof useRecordSelection>;

/** "Select all" checkbox with the bulk actions for the chosen records. */
export function SelectionBar({ selection: s, note, onDelete, children }: {
  selection: RecordSelection;
  /** Shown after the count, e.g. "(20 loaded)". */
  note?: ReactNode;
  onDelete: (targets: HistoryEntry[]) => void;
  /** Extra bulk actions, shown before Delete while something is chosen. */
  children?: ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.allChosen}
          ref={(el) => {
            if (el) el.indeterminate = s.chosen.length > 0 && !s.allChosen;
          }}
          disabled={s.selectable.length === 0}
          onChange={(e) => s.setAll(e.target.checked)}
          className="size-4 cursor-pointer accent-indigo-600 dark:accent-cyan-400"
        />
        <span>
          {s.chosen.length > 0 ? `${s.chosen.length} selected` : "Select all"}
          {note && <span className="text-xs text-slate-500"> {note}</span>}
        </span>
      </label>
      {s.chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SmallButton onClick={s.clear}>Clear selection</SmallButton>
          {children}
          <button
            type="button"
            onClick={() => onDelete(s.chosen)}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
          >
            Delete selected ({s.chosen.length})
          </button>
        </div>
      )}
    </div>
  );
}

/** Bulk action: retries the chosen failed records. Hidden when none of them failed. */
export function RetrySelectedButton({ selection, retryMany }: {
  selection: RecordSelection;
  /** Re-queues on the server; returns an error message, or null. */
  retryMany: (targets: HistoryEntry[]) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failed = selection.chosen.filter((r) => r.status === "failed");
  if (failed.length === 0 && !error) return null;

  return (
    <>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      {failed.length > 0 && (
        <SmallButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const err = await retryMany(failed);
            setBusy(false);
            if (err) setError(err);
            else selection.drop(failed.map((r) => r.id));
          }}
        >
          <span className="flex items-center gap-1">
            {busy && <Spinner className="h-3 w-3" />}
            Retry selected ({failed.length})
          </span>
        </SmallButton>
      )}
    </>
  );
}

/** Confirms deleting one or many records. `targets` null → closed. */
export function DeleteRecordsModal({ targets, remove, onDone, onClose }: {
  targets: HistoryEntry[] | null;
  /** Deletes on the server; returns an error message, or null. */
  remove: (targets: HistoryEntry[]) => Promise<string | null>;
  /** Called after an attempt with the records it covered (to drop them from a selection). */
  onDone?: (targets: HistoryEntry[]) => void;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    if (deleting) return;
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={targets !== null}
      onClose={close}
      title={targets && targets.length > 1 ? `Delete ${targets.length} resumes?` : "Delete resume?"}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <SmallButton onClick={close} disabled={deleting}>
            Cancel
          </SmallButton>
          <button
            type="button"
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-60"
            onClick={async () => {
              if (!targets) return;
              setDeleting(true);
              setError(null);
              const err = await remove(targets);
              setDeleting(false);
              onDone?.(targets);
              if (err) setError(err);
              else onClose();
            }}
          >
            {deleting && <Spinner />}
            Delete
          </button>
        </div>
      }
    >
      <ul className="scroll-panel max-h-60 space-y-1 overflow-y-auto text-sm">
        {targets?.map((t) => (
          <li key={t.id} className="min-w-0">
            <span className="block truncate font-medium">{[t.role, t.company].filter(Boolean).join(" · ") || "Untitled resume"}</span>
            {t.pdfFileName && <span className="block truncate text-xs text-slate-500">{t.pdfFileName}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {targets && targets.length > 1 ? "They are" : "It is"} removed from your history for good. PDFs you already downloaded are not affected.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}
