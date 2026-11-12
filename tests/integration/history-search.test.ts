// Runs against the real Postgres from docker-compose (npm run db:up + db:migrate).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.HAS_TEST_DB === "1";

describe.skipIf(!enabled)("history search (integration)", () => {
  let userId: string;
  let repo: typeof import("@/server/generation/repository");
  let dbMod: typeof import("@/server/db/client");
  let schema: typeof import("@/server/db/schema");
  const base = Date.parse("2026-03-10T12:00:00.000Z");

  beforeAll(async () => {
    repo = await import("@/server/generation/repository");
    dbMod = await import("@/server/db/client");
    schema = await import("@/server/db/schema");
    const [u] = await dbMod.db
      .insert(schema.users)
      .values({ username: `it_hist_${Date.now()}`, passwordHash: "x" })
      .returning({ id: schema.users.id });
    userId = u!.id;

    // 25 succeeded rows, some sharing a millisecond (and differing only in microseconds), plus 2 failed.
    const rows = Array.from({ length: 25 }, (_, i) => ({
      userId,
      status: "succeeded" as const,
      role: i % 5 === 0 ? "Data Scientist" : "Backend Engineer",
      company: `Co${i}`,
      jobDescription: "jd",
      prompt: "p",
      model: "m",
      pdfFileName: `file-${i}.pdf`,
      createdAt: new Date(base - Math.floor(i / 3) * 3_600_000),
    }));
    await dbMod.db.insert(schema.generations).values(rows);
    await dbMod.db.insert(schema.generations).values(
      [0, 1].map(() => ({ userId, status: "failed" as const, role: "Failed Role", jobDescription: "jd", prompt: "p", model: "m", createdAt: new Date(base) })),
    );
    const { sql, eq } = await import("drizzle-orm");
    await dbMod.db
      .update(schema.generations)
      .set({ createdAt: sql`${schema.generations.createdAt} + (random() * interval '900 microseconds')` })
      .where(eq(schema.generations.userId, userId));
  });

  afterAll(async () => {
    if (!userId) return;
    const { eq } = await import("drizzle-orm");
    await dbMod.db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("pages through every row exactly once, newest first", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await repo.searchGenerations(userId, { tab: "created", cursor, limit: 4 });
      seen.push(...page.records.map((r) => r.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 20);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    expect(pages).toBe(7);
  });

  it("filters by tab, text and date range", async () => {
    expect((await repo.searchGenerations(userId, { tab: "not-created", limit: 50 })).records).toHaveLength(2);
    expect((await repo.searchGenerations(userId, { tab: "created", q: "data sci", limit: 50 })).records).toHaveLength(5);
    expect((await repo.searchGenerations(userId, { tab: "created", q: "file-1", limit: 50 })).records.length).toBeGreaterThan(1);
    expect((await repo.searchGenerations(userId, { tab: "created", q: "%", limit: 50 })).records).toHaveLength(0);
    const inRange = await repo.searchGenerations(userId, {
      tab: "created",
      from: new Date(base - 3_600_000),
      to: new Date(base + 1),
      limit: 50,
    });
    expect(inRange.records).toHaveLength(6);
  });

  it("deletes own finished records only", async () => {
    const service = await import("@/server/generation/service");
    const { eq } = await import("drizzle-orm");
    const [pending, failed] = await dbMod.db
      .insert(schema.generations)
      .values([
        { userId, status: "pending" as const, jobDescription: "jd", prompt: "p", model: "m" },
        { userId, status: "failed" as const, jobDescription: "jd", prompt: "p", model: "m" },
      ])
      .returning({ id: schema.generations.id });

    await expect(service.deleteGeneration(userId, pending!.id)).rejects.toMatchObject({ code: "busy" });
    await expect(service.deleteGeneration("00000000-0000-4000-8000-000000000000", failed!.id)).rejects.toMatchObject({ code: "not_found" });
    await service.deleteGeneration(userId, failed!.id);
    expect(await dbMod.db.select().from(schema.generations).where(eq(schema.generations.id, failed!.id))).toHaveLength(0);
    await dbMod.db.delete(schema.generations).where(eq(schema.generations.id, pending!.id));
  });

  it("bulk-deletes own finished records and skips generating or foreign ones", async () => {
    const service = await import("@/server/generation/service");
    const { eq } = await import("drizzle-orm");
    const rows = await dbMod.db
      .insert(schema.generations)
      .values(
        (["failed", "succeeded", "pending"] as const).map((status) => ({ userId, status, jobDescription: "jd", prompt: "p", model: "m" })),
      )
      .returning({ id: schema.generations.id });
    const ids = rows.map((r) => r.id);

    expect(await service.deleteGenerations("00000000-0000-4000-8000-000000000000", ids)).toEqual([]);
    expect((await service.deleteGenerations(userId, ids)).sort()).toEqual([ids[0], ids[1]].sort());
    const left = await dbMod.db.select({ id: schema.generations.id }).from(schema.generations).where(eq(schema.generations.id, ids[2]!));
    expect(left).toHaveLength(1);
    await dbMod.db.delete(schema.generations).where(eq(schema.generations.id, ids[2]!));
  });
});
