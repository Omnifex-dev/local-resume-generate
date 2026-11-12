import "server-only";
import { and, desc, eq, gte, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { decodeCursor, encodeCursor, type HistoryEntry, type HistoryPage, type HistoryTab } from "@/lib/history";
import { db } from "../db/client";
import { generations } from "../db/schema";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only returns the row if it belongs to `userId`. */
export async function getOwnGeneration(userId: string, id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .limit(1);
  return row ?? null;
}

type Row = typeof generations.$inferSelect;

/** Strips server-only fields (prompt, profile snapshot) and serialises dates. */
export function toHistoryEntry(r: Row): HistoryEntry {
  return {
    id: r.id,
    status: r.status,
    role: r.role,
    company: r.company,
    model: r.model,
    content: r.content,
    extras: r.extras,
    jobDescription: r.jobDescription,
    error: r.error,
    pdfFileName: r.pdfFileName,
    jsonFileName: r.jsonFileName,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

/** Everything created at or after `since` (the workspace's "today"), newest first. */
export async function listGenerationsSince(userId: string, since: Date, limit = 500): Promise<HistoryEntry[]> {
  const rows = await db
    .select()
    .from(generations)
    .where(and(eq(generations.userId, userId), gte(generations.createdAt, since)))
    .orderBy(desc(generations.createdAt), desc(generations.id))
    .limit(limit);
  return rows.map(toHistoryEntry);
}

export type HistorySearch = {
  tab: HistoryTab;
  /** Matches role, company or PDF file name (case-insensitive, substring). */
  q?: string;
  /** Created in [from, to). The browser turns a picked day into its own local range. */
  from?: Date;
  to?: Date;
  cursor?: string | null;
  limit: number;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Postgres keeps microseconds but the cursor (a JS Date) only milliseconds, so
// order and compare on the millisecond value to never skip or repeat a row.
const createdMs = sql`date_trunc('milliseconds', ${generations.createdAt})`;

/** One page of the user's history, newest first (keyset pagination on created_at, id). */
export async function searchGenerations(userId: string, s: HistorySearch): Promise<HistoryPage> {
  const where: (SQL | undefined)[] = [
    eq(generations.userId, userId),
    s.tab === "created" ? eq(generations.status, "succeeded") : ne(generations.status, "succeeded"),
  ];
  const q = s.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(or(ilike(generations.role, like), ilike(generations.company, like), ilike(generations.pdfFileName, like)));
  }
  if (s.from) where.push(gte(generations.createdAt, s.from));
  if (s.to) where.push(lt(generations.createdAt, s.to));
  const cursor = decodeCursor(s.cursor);
  if (cursor) where.push(sql`(${createdMs}, ${generations.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`);

  const rows = await db
    .select()
    .from(generations)
    .where(and(...where))
    .orderBy(desc(createdMs), desc(generations.id))
    .limit(s.limit + 1);

  const records = rows.slice(0, s.limit).map(toHistoryEntry);
  const last = records[records.length - 1];
  return { records, nextCursor: rows.length > s.limit && last ? encodeCursor(last) : null };
}
