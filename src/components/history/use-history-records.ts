"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeEdit } from "@/lib/edit-schema";
import { resumeFileBase } from "@/lib/filename";
import type { HistoryEntry } from "@/lib/history";
import { downloadBlob } from "@/lib/save-files";
import type { ThemeId } from "@/lib/themes";
import { useAutoDownload } from "./auto-download";

const POLL_MS = 2000;

export type FileState = { busy?: "pdf" | "json"; error?: string };

const byNewest = (a: HistoryEntry, b: HistoryEntry) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export function mergeRecords(current: HistoryEntry[], updates: HistoryEntry[]): HistoryEntry[] {
  const map = new Map(current.map((r) => [r.id, r]));
  for (const u of updates) map.set(u.id, u);
  return [...map.values()].sort(byNewest);
}

const fileBase = (r: HistoryEntry) => resumeFileBase(r.role ?? "Role", r.company ?? "Company", Date.parse(r.createdAt));

export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return data?.error?.message ?? `${fallback} (HTTP ${res.status}).`;
}

export function redirectToLogin() {
  window.location.href = "/login";
}

/**
 * Records shown in a history list plus their actions: PDF/JSON download, PDF
 * preview, edit, retry, and polling of pending records. A record created or
 * retried in this tab downloads its PDF by itself when it is ready, but only
 * while the "Auto download" switch is on.
 */
export function useHistoryRecords(initial: HistoryEntry[], theme: ThemeId) {
  const [records, setRecords] = useState<HistoryEntry[]>(() => [...initial].sort(byNewest));
  const [files, setFiles] = useState<Record<string, FileState>>({});
  const autoDownload = useRef(new Set<string>());
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  const [autoDownloadOn] = useAutoDownload();
  const autoDownloadOnRef = useRef(autoDownloadOn);
  useEffect(() => {
    autoDownloadOnRef.current = autoDownloadOn;
  }, [autoDownloadOn]);

  const setFile = (id: string, state: FileState) => setFiles((f) => ({ ...f, [id]: state }));

  /** The record's PDF in `theme` (default: the selected theme). Throws with a readable message. */
  const fetchPdf = useCallback(async (r: HistoryEntry, theme?: ThemeId, signal?: AbortSignal): Promise<Blob> => {
    const res = await fetch(`/api/generations/${encodeURIComponent(r.id)}/pdf?theme=${encodeURIComponent(theme ?? themeRef.current)}`, { signal });
    if (res.status === 401) redirectToLogin();
    if (!res.ok) throw new Error(await errorMessage(res, "PDF failed"));
    // Typed explicitly so an <iframe> shows it with the browser's PDF viewer.
    return new Blob([await res.arrayBuffer()], { type: "application/pdf" });
  }, []);

  const downloadPdf = useCallback(async (r: HistoryEntry) => {
    setFile(r.id, { busy: "pdf" });
    try {
      downloadBlob(r.pdfFileName ?? `${fileBase(r)}.pdf`, await fetchPdf(r));
      setFile(r.id, {});
    } catch (e) {
      setFile(r.id, { error: (e as Error).message });
    }
  }, [fetchPdf]);

  /** Saves edited text of a finished record. Returns an error message, or null. */
  const saveEdit = useCallback(async (r: HistoryEntry, edit: ResumeEdit): Promise<string | null> => {
    const res = await fetch(`/api/generations/${encodeURIComponent(r.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (res.status === 401) {
      redirectToLogin();
      return null;
    }
    if (!res.ok) return errorMessage(res, "Saving failed");
    const { record } = (await res.json()) as { record: HistoryEntry };
    setRecords((cur) => mergeRecords(cur, [record]));
    return null;
  }, []);

  const downloadJson = useCallback((r: HistoryEntry) => {
    if (!r.content) return;
    downloadBlob(r.jsonFileName ?? `${fileBase(r)}.json`, new Blob([JSON.stringify(r.content, null, 2)], { type: "application/json" }));
    setFile(r.id, {});
  }, []);

  const retry = useCallback(async (r: HistoryEntry) => {
    setFile(r.id, {});
    const res = await fetch(`/api/generations/${encodeURIComponent(r.id)}/retry`, { method: "POST" });
    if (!res.ok) {
      setFile(r.id, { error: await errorMessage(res, "Retry failed") });
      return;
    }
    const { record } = (await res.json()) as { record: HistoryEntry };
    autoDownload.current.add(record.id);
    setRecords((cur) => mergeRecords(cur, [record]));
  }, []);

  /**
   * Deletes the records (one or many) and drops them from the list. Records the
   * server skipped (still generating) stay. Returns an error message, or null.
   */
  const remove = useCallback(async (targets: HistoryEntry[]): Promise<string | null> => {
    const res = await fetch("/api/generations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: targets.map((t) => t.id) }),
    });
    if (res.status === 401) {
      redirectToLogin();
      return null;
    }
    if (!res.ok) return errorMessage(res, "Delete failed");
    const { deleted } = (await res.json()) as { deleted: string[] };
    // Ids the server didn't delete and that aren't generating were already gone.
    const gone = new Set(targets.filter((t) => t.status !== "pending").map((t) => t.id).concat(deleted));
    gone.forEach((id) => autoDownload.current.delete(id));
    setRecords((cur) => cur.filter((x) => !gone.has(x.id)));
    setFiles((f) => Object.fromEntries(Object.entries(f).filter(([id]) => !gone.has(id))));
    const skipped = targets.length - gone.size;
    return skipped > 0 ? `${skipped} resume${skipped === 1 ? " is" : "s are"} still generating and ${skipped === 1 ? "was" : "were"} not deleted.` : null;
  }, []);

  /** Adds records just created in this tab; their PDFs download when ready (if auto download is on). */
  const addCreated = useCallback((created: HistoryEntry[]) => {
    created.forEach((r) => autoDownload.current.add(r.id));
    setRecords((cur) => mergeRecords(cur, created));
  }, []);

  const pendingIds = useMemo(() => records.filter((r) => r.status === "pending").map((r) => r.id), [records]);
  const pendingKey = pendingIds.join(",");
  useEffect(() => {
    if (!pendingKey) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/generations?ids=${pendingKey}`, { cache: "no-store" });
        if (res.status === 401) return redirectToLogin();
        if (!res.ok || stopped) return;
        const { records: updates } = (await res.json()) as { records: HistoryEntry[] };
        setRecords((cur) => mergeRecords(cur, updates));
        for (const u of updates) {
          if (u.status === "pending" || !autoDownload.current.has(u.id)) continue;
          autoDownload.current.delete(u.id);
          if (u.status === "succeeded" && autoDownloadOnRef.current) void downloadPdf(u);
        }
      } catch {
        /* offline for a moment: try again on the next tick */
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pendingKey, downloadPdf]);

  return { records, setRecords, files, fetchPdf, downloadPdf, downloadJson, saveEdit, retry, remove, addCreated, generating: pendingIds.length };
}
