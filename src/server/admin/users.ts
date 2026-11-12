import "server-only";
import { and, count, desc, eq, max, ne, sql } from "drizzle-orm";
import { db } from "../db/client";
import { generations, users } from "../db/schema";

export type AdminUserRow = {
  id: string;
  username: string;
  email: string | null;
  role: "user" | "admin";
  active: boolean;
  createdAt: string;
  resumes: number;
  failed: number;
  lastGeneratedAt: string | null;
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      resumes: sql<number>`count(${generations.id}) filter (where ${generations.status} = 'succeeded')`.mapWith(Number),
      failed: sql<number>`count(${generations.id}) filter (where ${generations.status} = 'failed')`.mapWith(Number),
      lastGeneratedAt: max(generations.createdAt),
    })
    .from(users)
    .leftJoin(generations, eq(generations.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(users.role), users.username);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastGeneratedAt: r.lastGeneratedAt ? new Date(r.lastGeneratedAt).toISOString() : null,
  }));
}

/** Number of active admins other than `exceptId` (guards against locking everyone out). */
export async function otherActiveAdmins(exceptId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, exceptId)));
  return r?.n ?? 0;
}
