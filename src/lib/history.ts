import type { ResumeExtras } from "@/resume/model";

export type GenerationStatus = "pending" | "succeeded" | "failed";

/** A generation record as the browser sees it (dates as ISO strings). */
export type HistoryEntry = {
  id: string;
  status: GenerationStatus;
  role: string | null;
  company: string | null;
  model: string;
  content: Record<string, string[]> | null;
  extras: ResumeExtras | null;
  jobDescription: string;
  error: string | null;
  pdfFileName: string | null;
  jsonFileName: string | null;
  createdAt: string;
  finishedAt: string | null;
};

/** Status filter of the history views: "created" = succeeded, "not-created" = pending or failed. */
export type HistoryTab = "created" | "not-created";

/** One page of the server's history search. `nextCursor` is null on the last page. */
export type HistoryPage = { records: HistoryEntry[]; nextCursor: string | null };

export const HISTORY_PAGE_SIZE = 20;

/** Keyset cursor "{createdAt ISO}_{id}" pointing at the last record of a page. */
export function encodeCursor(r: Pick<HistoryEntry, "createdAt" | "id">): string {
  return `${r.createdAt}_${r.id}`;
}

export function decodeCursor(cursor: string | null | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.lastIndexOf("_");
  if (i <= 0) return null;
  const createdAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { createdAt, id };
}

export const inTab = (r: HistoryEntry, tab: HistoryTab) => (tab === "created") === (r.status === "succeeded");

/** Client-side search: role, company, PDF file name or the shown date/time text. */
export function matchesQuery(r: HistoryEntry, query: string, dateText = ""): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [r.role, r.company, r.pdfFileName, dateText].some((v) => v?.toLowerCase().includes(q));
}
