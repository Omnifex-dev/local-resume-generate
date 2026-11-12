"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAutoDownload } from "@/components/history/auto-download";
import { EditResumeModal, PdfPreviewModal, useRecordDialogs } from "@/components/history/record-dialogs";
import { dateSearchText, RecordRow, searchInputClass, StatusTabs } from "@/components/history/record-row";
import { errorMessage, redirectToLogin, useHistoryRecords } from "@/components/history/use-history-records";
import { JdInput } from "@/components/jd/jd-input";
import { Modal, Panel, PrimaryButton, Spinner } from "@/components/ui";
import { inTab, matchesQuery, type HistoryEntry, type HistoryTab } from "@/lib/history";
import type { JobDescription } from "@/lib/jd";
import type { PageSize, ThemeId } from "@/lib/themes";
import { ThemePicker } from "./theme-picker";

type Blocker = { message: string } | null;

type Props = {
  blocker: Blocker;
  initialTheme: ThemeId;
  pageSize: PageSize;
  previews: Record<ThemeId, string>;
  /** Records of the last 24 hours; the browser keeps the ones from its own "today". */
  history: HistoryEntry[];
  /** Left column (server-rendered profile summary). */
  profile: ReactNode;
  /** Right column (model and prompt). */
  generationSettings: ReactNode;
};

const localMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Start of the browser's day, refreshed at midnight. null until mounted: the
 * server doesn't know the browser's time zone, so it renders the whole 24 hours.
 */
function useDayStart(): number | null {
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = localMidnight();
      setStart(s);
      timer = setTimeout(tick, s + 86_400_000 - Date.now() + 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return start;
}

export function GenerateWorkspace({ blocker, initialTheme, pageSize, previews, history, profile, generationSettings }: Props) {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const { records, files, fetchPdf, downloadPdf, downloadJson, saveEdit, retry, addCreated, generating } = useHistoryRecords(history, theme);
  const dialogs = useRecordDialogs(records);
  const [autoDownload, setAutoDownload] = useAutoDownload();
  const [tab, setTab] = useState<HistoryTab>("created");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [jdKey, setJdKey] = useState(0);
  const dayStart = useDayStart();

  /** Creates the records, then closes the modal. Returns an error message for the form, or null. */
  const create = async (jobs: JobDescription[]): Promise<string | null> => {
    const res = await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs }),
    });
    if (res.status === 401) {
      redirectToLogin();
      return null;
    }
    if (!res.ok) return errorMessage(res, "Could not start");
    const { records: created } = (await res.json()) as { records: HistoryEntry[] };
    addCreated(created);
    setTab("created");
    setNewOpen(false);
    setJdKey((k) => k + 1); // fresh, empty form next time
    return null;
  };

  // Pending records always stay visible, even if they started before midnight.
  const today = records.filter((r) => dayStart === null || r.status === "pending" || Date.parse(r.createdAt) >= dayStart);
  const counts = { created: today.filter((r) => inTab(r, "created")).length, "not-created": today.filter((r) => inTab(r, "not-created")).length };
  const shown = today.filter((r) => inTab(r, tab) && matchesQuery(r, query, dateSearchText(r)));
  const q = query.trim();

  // Each column fills its grid cell; the panels inside scroll their own content.
  const column = "lg:flex lg:min-h-0 lg:flex-col";

  return (
    // Large screens: exactly the viewport below the header (h-16) and main padding (p-4).
    <div className="grid gap-4 lg:h-[calc(100dvh-4rem-2rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]">
      {/* Phones: today's resumes, then theme, then prompt, then profile. */}
      <aside aria-label="Profile" className={`order-3 lg:order-none ${column}`}>
        {profile}
      </aside>

      <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-none lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,11fr)_minmax(0,9fr)]">
        <section aria-label="Today's resumes" className={`flex min-w-0 flex-col gap-4 ${column}`}>
          {blocker && (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {blocker.message}
            </p>
          )}

          <Panel
            fill
            title="Today's history"
            actions={
              <div className="flex items-center gap-3">
                <Link href="/history" className="text-xs font-medium text-indigo-700 hover:underline dark:text-cyan-300">
                  All history →
                </Link>
                <PrimaryButton
                  type="button"
                  onClick={() => generating === 0 && setNewOpen(true)}
                  disabled={generating > 0}
                  className="flex items-center gap-2"
                  aria-live="polite"
                >
                  {generating > 0 ? (
                    <>
                      <Spinner />
                      Generating {generating}…
                    </>
                  ) : (
                    "+ New resume"
                  )}
                </PrimaryButton>
                <AutoDownloadSwitch on={autoDownload} onChange={setAutoDownload} />
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <StatusTabs tab={tab} onChange={setTab} counts={counts} generating={generating} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search role, PDF name or time"
                aria-label="Search today's resumes"
                className={`${searchInputClass} sm:w-60`}
              />
            </div>

            {shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {q
                  ? `Nothing today matches “${q}”.`
                  : tab === "created"
                    ? "No resumes yet today. Click “New resume” to create one."
                    : "Nothing in progress and no failed attempts today."}
              </p>
            ) : (
              <ul className="space-y-1.5">
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
                  />
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section aria-label="Theme" className={`min-w-0 ${column}`}>
          <Panel title="Theme" fill>
            <ThemePicker previews={previews} value={theme} onChange={setTheme} pageSize={pageSize} />
          </Panel>
        </section>
      </div>

      <aside aria-label="Prompt" className={`order-2 min-w-0 lg:order-none ${column}`}>
        <Panel title="Model & prompt" fill>
          {generationSettings}
        </Panel>
      </aside>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New resume" size="lg">
        <JdInput key={jdKey} onSubmit={create} disabled={Boolean(blocker)} />
      </Modal>
      <PdfPreviewModal record={dialogs.preview} theme={theme} fetchPdf={fetchPdf} onEdit={dialogs.openEdit} onClose={dialogs.closePreview} />
      <EditResumeModal record={dialogs.edit} onSave={saveEdit} onClose={dialogs.closeEdit} />
    </div>
  );
}

/** On: a new resume's PDF downloads by itself when ready. Off: use the row's PDF button. */
function AutoDownloadSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"
      title={on ? "PDFs download automatically when ready" : "PDFs download only when you click PDF"}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
          on ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500" : "bg-slate-300 dark:bg-white/15"
        }`}
      >
        <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
      Auto download
    </label>
  );
}
