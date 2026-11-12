import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isProd, env } from "../env";
import * as schema from "./schema";

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const client = globalForDb.pgClient ?? postgres(env.DATABASE_URL, { max: 10 });
if (!isProd) globalForDb.pgClient = client;

export const db = drizzle(client, { schema });

/** Postgres unique_violation, unwrapping Drizzle's error wrapper if present. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
