"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, SmallButton, Spinner } from "@/components/ui";
import { HISTORY_PAGE_SIZE, inTab, type HistoryEntry, type HistoryPage, type HistoryTab } from "@/lib/history";
import { THEMES, type ThemeId } from "@/lib/themes";
import { EditResumeModal, PdfPreviewModal, useRecordDialogs } from "./record-dialogs";
import { RecordRow, searchInputClass, StatusTabs } from "./record-row";
import { DeleteRecordsModal, RetrySelectedButton, SelectionBar, useRecordSelection } from "./record-selection";
import { errorMessage, mergeRecords, redirectToLogin, useHistoryRecords } from "./use-history-records";

type Filters = { tab: HistoryTab; q: string; date: string };

const SEARCH_DEBOUNCE_MS = 300;

/** A picked day (YYYY-MM-DD) as the browser's local [from, to). */
function dayRange(date: string): { from: string; to: string } | null {
  const from = new Date(`${date}T00:00:00`);
  if (Number.isNaN(from.getTime())) return null;
  const to = new Date(from);
  to.setDate(to.getDate() + 1); // not +24h: DST days are 23 or 25 hours long
  return { from: from.toISOString(), to: to.toISOString() };
}

function pageUrl(f: Filters, cursor: string | null): string {
  const p = new URLSearchParams({ tab: f.tab, limit: String(HISTORY_PAGE_SIZE) });
  if (f.q.trim()) p.set("q", f.q.trim());
  const range = f.date ? dayRange(f.date) : null;
  if (range) {
    p.set("from", range.from);
    p.set("to", range.to);
  }
  if (cursor) p.set("cursor", cursor);
  return `/api/generations?${p}`;
}

/** Every record of the user, searchable, loaded page by page as the list scrolls. */
export function HistoryBrowser({ initial, theme }: { initial: HistoryPage; theme: ThemeId }) {
  const { records, setRecords, files, fetchPdf, downloadPdf, downloadJson, saveEdit, retry, retryMany, remove, generating } = useHistoryRecords(initial.records, theme);
  const dialogs = useRecordDialogs(records);
  const [filters, setFilters] = useState<Filters>({ tab: "created", q: "", date: "" });
  const [queryInput, setQueryInput] = useState("");
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<HistoryEntry[] | null>(null);
  const shown = records.filter((r) => inTab(r, filters.tab));
  const selection = useRecordSelection(shown);
  const clearSelection = selection.clear;
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const firstFilters = useRef(true);

  /** Loads the page after `after` (null → first page, replacing the list). Stale answers are dropped. */
  const load = useCallback(
    async (f: Filters, after: string | null) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(pageUrl(f, after), { cache: "no-store" });
        if (res.status === 401) return redirectToLogin();
        if (!res.ok) throw new Error(await errorMessage(res, "Loading history failed"));
        const page = (await res.json()) as HistoryPage;
        if (id !== requestId.current) return;
        setRecords((cur) => (after ? mergeRecords(cur, page.records) : page.records));
        setCursor(page.nextCursor);
      } catch (e) {
        if (id === requestId.current) setError((e as Error).message);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [setRecords],
  );

  // Typing settles for a moment before it searches.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === queryInput ? f : { ...f, q: queryInput })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [queryInput]);

  // New filters → start again from the first page (the server already rendered the default one).
  useEffect(() => {
    if (firstFilters.current) {
      firstFilters.current = false;
      return;
    }
    setRecords([]);
    clearSelection();
    setCursor(null);
    window.scrollTo({ top: 0 });
    void load(filters, null);
  }, [filters, load, setRecords, clearSelection]);

  // Infinite scroll: fetch the next page when the sentinel below the list comes into view.
  // Re-created after every load, so a short page that leaves it visible loads again.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || loading || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void load(filters, cursor);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, error, filters, load]);

  const askDelete = (targets: HistoryEntry[]) => setToDelete(targets);
  const filtered = Boolean(filters.q.trim() || filters.date);
  const themeName = THEMES.find((t) => t.id === theme)?.name ?? theme;

  return (
    <div className="mx-auto max-w-4xl">
      <Panel
        title="All history"
        actions={
          <Link href="/generate" className="text-xs font-medium text-indigo-700 hover:underline dark:text-cyan-300">
            ← Workspace
          </Link>
        }
      >
        {/* Tabs, date and search share the row equally (stacked on phones); Clear sits at the end. */}
        <div className={`mb-3 grid items-center gap-3 ${filtered ? "sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]" : "sm:grid-cols-3"}`}>
          <StatusTabs tab={filters.tab} onChange={(tab) => setFilters((f) => ({ ...f, tab }))} generating={generating} className="w-full" />
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            aria-label="Created on"
            className={`${searchInputClass} h-full dark:[color-scheme:dark]`}
          />
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search role, company or PDF name"
            aria-label="Search by role, company or PDF name"
            className={`${searchInputClass} h-full`}
          />
          {filtered && (
            <SmallButton
              onClick={() => {
                setQueryInput("");
                setFilters((f) => ({ ...f, q: "", date: "" }));
              }}
            >
              Clear
            </SmallButton>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">PDFs download in your selected theme ({themeName}).</p>

        {shown.length === 0 && !loading && !error ? (
          <p className="py-10 text-center text-sm text-slate-500">
            {filtered ? "Nothing matches this search." : filters.tab === "created" ? "No resumes yet." : "Nothing in progress and no failed attempts."}
          </p>
        ) : (
          <>
            <SelectionBar selection={selection} onDelete={askDelete} note={cursor ? `(${selection.selectable.length} loaded)` : undefined}>
              <RetrySelectedButton selection={selection} retryMany={retryMany} />
            </SelectionBar>
            <ul className="space-y-1.5" aria-busy={loading}>
              {shown.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  file={files[r.id]}
                  onPdf={() => void downloadPdf(r)}
                  onJson={() => downloadJson(r)}
                  onRetry={() => void retry(r)}
                  onPreview={() => dialogs.openPreview(r)}
                  onEdit={() => dialogs.openEdit(r)}
                  onDelete={() => askDelete([r])}
                  selected={selection.selected.has(r.id)}
                  onSelect={(on) => selection.toggle(r.id, on)}
                />
              ))}
            </ul>
          </>
        )}

        <div ref={sentinel} aria-hidden="true" className="h-px" />
        <div className="flex min-h-10 items-center justify-center pt-3 text-sm text-slate-500" aria-live="polite">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Loading…
            </span>
          ) : error ? (
            <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
              {error}
              <SmallButton onClick={() => void load(filters, cursor)}>Try again</SmallButton>
            </span>
          ) : !cursor && shown.length > 0 ? (
            <span>That’s everything.</span>
          ) : null}
        </div>
      </Panel>

      <PdfPreviewModal record={dialogs.preview} theme={theme} fetchPdf={fetchPdf} onEdit={dialogs.openEdit} onClose={dialogs.closePreview} />
      <EditResumeModal record={dialogs.edit} onSave={saveEdit} onClose={dialogs.closeEdit} />

      <DeleteRecordsModal
        targets={toDelete}
        remove={remove}
        onDone={(targets) => selection.drop(targets.map((t) => t.id))}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
