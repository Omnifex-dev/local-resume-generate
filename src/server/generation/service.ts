import "server-only";
import { and, eq, gte, inArray, ne, notInArray } from "drizzle-orm";
import { fileNumber, resumeFileBase } from "@/lib/filename";
import { normalizeEdit, type ResumeEdit } from "@/lib/edit-schema";
import type { JobDescription } from "@/lib/jd";
import type { ProfileSnapshot } from "@/resume/model";
import { getSharedApiKey, SharedKeyUnreadableError } from "../admin/app-settings";
import { chatCompletionJson, OpenAIError } from "../ai/openai";
import { buildResumeMessages, parseAiOutput, responseSchema, toResumeContent, toResumeExtras } from "../ai/resume-content";
import { db } from "../db/client";
import { generations } from "../db/schema";
import { env } from "../env";
import { logger } from "../logger";
import { getProfile } from "../profile/repository";
import { getSettings } from "../settings/repository";
import { getOwnGeneration } from "./repository";

export type GenerationErrorCode = "no_api_key" | "empty_profile" | "not_found" | "busy" | "internal";

export class GenerationError extends Error {
  constructor(
    public readonly code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Background queue. Kept on globalThis so dev hot-reloads don't lose it.
// Every pending record of this server process is either queued or running;
// a pending record that is in neither was interrupted (server restart).
// ---------------------------------------------------------------------------

// One at a time: parallel calls slow each other down (and hit rate limits),
// which made long reasoning-model calls time out.
const CONCURRENCY = 1;
type QueueState = { waiting: string[]; running: Set<string> };
const g = globalThis as unknown as { __resumeQueue?: QueueState };
const queue: QueueState = (g.__resumeQueue ??= { waiting: [], running: new Set() });

function enqueue(id: string) {
  if (!queue.waiting.includes(id) && !queue.running.has(id)) queue.waiting.push(id);
  pump();
}

function pump() {
  while (queue.running.size < CONCURRENCY && queue.waiting.length > 0) {
    const id = queue.waiting.shift()!;
    queue.running.add(id);
    void runGeneration(id)
      .catch((err) => logger.error({ err, generationId: id }, "generation worker crashed"))
      .finally(() => {
        queue.running.delete(id);
        pump();
      });
  }
}

const inQueue = () => [...queue.waiting, ...queue.running];

/** Marks this user's pending records that no worker owns any more as failed. */
export async function failInterrupted(userId: string): Promise<void> {
  const owned = inQueue();
  await db
    .update(generations)
    .set({ status: "failed", error: "Interrupted because the server restarted. Please retry.", finishedAt: new Date() })
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.status, "pending"),
        owned.length ? notInArray(generations.id, owned) : undefined,
      ),
    );
}

// ---------------------------------------------------------------------------

/** Checks that generating can work at all, so the user sees problems before any record is made. */
async function readyInputs(userId: string) {
  const [profile, settings, apiKey] = await Promise.all([
    getProfile(userId),
    getSettings(userId),
    getSharedApiKey().catch((err: unknown) => {
      if (err instanceof SharedKeyUnreadableError) throw new GenerationError("no_api_key", err.message);
      throw err;
    }),
  ]);
  if (!apiKey) throw new GenerationError("no_api_key", "The administrator hasn't set an OpenAI API key yet.");
  if (profile.experiences.length === 0) {
    throw new GenerationError("empty_profile", "Add at least one company to your profile first.");
  }
  const snapshot: Partial<typeof profile> = { ...profile };
  delete snapshot.exists; // not part of the stored snapshot
  return { snapshot, settings };
}

/**
 * Creates one pending record per job (role, company, date, job description and the
 * inputs used) and queues them. Returns at once; the AI work runs in the background.
 */
export async function createGenerations(userId: string, jobs: JobDescription[]) {
  const { snapshot, settings } = await readyInputs(userId);
  const rows = await db
    .insert(generations)
    .values(
      jobs.map((job) => ({
        userId,
        status: "pending" as const,
        role: job.role,
        company: job.company,
        jobDescription: job.description,
        prompt: settings.effectivePrompt,
        model: settings.effectiveModel,
        profileSnapshot: snapshot,
      })),
    )
    .returning();
  rows.forEach((r) => enqueue(r.id));
  logger.info({ userId, count: rows.length }, "generations queued");
  return rows;
}

/** Puts a failed record back in the queue with the current profile, prompt and model. */
export async function retryGeneration(userId: string, id: string) {
  const row = await getOwnGeneration(userId, id);
  if (!row) throw new GenerationError("not_found", "Resume not found.");
  if (row.status === "pending" && inQueue().includes(id)) return row;
  if (row.status === "succeeded") return row;

  const { snapshot, settings } = await readyInputs(userId);
  const [updated] = await db
    .update(generations)
    .set({
      status: "pending",
      error: null,
      prompt: settings.effectivePrompt,
      model: settings.effectiveModel,
      profileSnapshot: snapshot,
      finishedAt: null,
    })
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning();
  enqueue(id);
  return updated!;
}

/**
 * Puts several failed records back in the queue (oldest first), like
 * retryGeneration. Ids that aren't the user's or aren't failed are skipped.
 */
export async function retryGenerations(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const { snapshot, settings } = await readyInputs(userId);
  const rows = await db
    .update(generations)
    .set({
      status: "pending",
      error: null,
      prompt: settings.effectivePrompt,
      model: settings.effectiveModel,
      profileSnapshot: snapshot,
      finishedAt: null,
    })
    .where(and(eq(generations.userId, userId), inArray(generations.id, ids), eq(generations.status, "failed")))
    .returning();
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).forEach((r) => enqueue(r.id));
  logger.info({ userId, count: rows.length }, "generations re-queued");
  return rows;
}

/**
 * Saves the user's edits of a finished record. Bullets of companies that aren't
 * in the record are ignored; companies missing from the edit keep their bullets.
 * The file names follow a changed role or company (same number).
 */
export async function updateGenerationContent(userId: string, id: string, edit: ResumeEdit) {
  const row = await getOwnGeneration(userId, id);
  if (!row) throw new GenerationError("not_found", "Resume not found.");
  if (row.status !== "succeeded" || !row.content) throw new GenerationError("busy", "Only finished resumes can be edited.");

  const e = normalizeEdit(edit);
  const content = Object.fromEntries(Object.entries(row.content).map(([k, v]) => [k, e.content[k] ?? v]));
  const base = resumeFileBase(fileNumber(row.pdfFileName), e.role, e.company);

  const [updated] = await db
    .update(generations)
    .set({ role: e.role, company: e.company, content, extras: e.extras, pdfFileName: `${base}.pdf`, jsonFileName: `${base}.json` })
    .where(and(eq(generations.id, id), eq(generations.userId, userId), eq(generations.status, "succeeded")))
    .returning();
  if (!updated) throw new GenerationError("busy", "This resume changed meanwhile. Reload and try again.");
  return updated;
}

/** Deletes one of the user's records. A record that is still generating can't be deleted. */
export async function deleteGeneration(userId: string, id: string): Promise<void> {
  const row = await getOwnGeneration(userId, id);
  if (!row) throw new GenerationError("not_found", "Resume not found.");
  const deleted = await db
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId), ne(generations.status, "pending")))
    .returning({ id: generations.id });
  if (deleted.length === 0) throw new GenerationError("busy", "This resume is still generating. Delete it once it has finished.");
}

/**
 * Deletes several of the user's records at once. Ids that aren't the user's or
 * are still generating are skipped. Returns the ids that were deleted.
 */
export async function deleteGenerations(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const deleted = await db
    .delete(generations)
    .where(and(eq(generations.userId, userId), inArray(generations.id, ids), ne(generations.status, "pending")))
    .returning({ id: generations.id });
  return deleted.map((d) => d.id);
}

/**
 * The next free number for a resume finished today (server's local day): one
 * more than the highest number used today, so numbers stay unique even after a
 * delete. Safe without locking because the queue runs one job at a time.
 */
async function nextDayNumber(userId: string, now = new Date()): Promise<number> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ pdfFileName: generations.pdfFileName })
    .from(generations)
    .where(and(eq(generations.userId, userId), eq(generations.status, "succeeded"), gte(generations.finishedAt, dayStart)));
  return rows.reduce((max, r) => Math.max(max, fileNumber(r.pdfFileName) ?? 0), 0) + 1;
}

/** Tries for each resume before it is marked failed and the queue moves on. */
const MAX_ATTEMPTS = 2;

/** Errors another attempt can't fix (bad key, no credit, unusable model…). */
const isPermanent = (err: unknown) =>
  err instanceof GenerationError ||
  err instanceof SharedKeyUnreadableError ||
  (err instanceof OpenAIError && ["auth", "quota", "model", "bad_request"].includes(err.kind));

async function withAttempts<T>(id: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || isPermanent(err)) throw err;
      logger.warn({ generationId: id, attempt, kind: (err as OpenAIError).kind }, "generation attempt failed, trying again");
    }
  }
}

/** The background step: calls the AI and stores the result (or the error) on the record. */
async function runGeneration(id: string): Promise<void> {
  const [row] = await db.select().from(generations).where(eq(generations.id, id)).limit(1);
  if (!row || row.status !== "pending") return;
  const snapshot = row.profileSnapshot as ProfileSnapshot;
  const started = Date.now();

  try {
    const apiKey = await getSharedApiKey();
    if (!apiKey) throw new GenerationError("no_api_key", "The administrator hasn't set an OpenAI API key yet.");

    const history = snapshot.experiences;
    const messages = buildResumeMessages({
      history,
      candidate: {
        headline: snapshot.headline,
        location: snapshot.location,
        skills: snapshot.skills,
        languages: snapshot.languages,
        educations: snapshot.educations,
      },
      instructions: row.prompt,
      job: { role: row.role, company: row.company, description: row.jobDescription },
    });

    const { ai, model } = await withAttempts(id, async () => {
      const { data, model } = await chatCompletionJson({
        apiKey,
        model: row.model,
        messages,
        schemaName: "tailored_resume",
        schema: responseSchema(history),
        baseUrl: env.OPENAI_BASE_URL,
      });
      const ai = parseAiOutput(data);
      if (!ai) throw new OpenAIError("invalid_output", "OpenAI's answer didn't match the expected format. Please retry.");
      return { ai, model };
    });

    const role = row.role ?? (ai.target_role.trim().slice(0, 200) || "Role");
    const company = row.company ?? (ai.target_company.trim().slice(0, 200) || "Company");
    // The content (JSON) exists from here on; the PDF is rendered from it on download.
    const base = resumeFileBase(await nextDayNumber(row.userId), role, company);

    await db
      .update(generations)
      .set({
        status: "succeeded",
        role,
        company,
        model,
        content: toResumeContent(ai, history),
        extras: toResumeExtras(ai),
        pdfFileName: `${base}.pdf`,
        jsonFileName: `${base}.json`,
        error: null,
        finishedAt: new Date(),
      })
      .where(eq(generations.id, id));
    logger.info({ userId: row.userId, generationId: id, model, ms: Date.now() - started }, "resume content generated");
  } catch (err) {
    const known = err instanceof OpenAIError || err instanceof GenerationError || err instanceof SharedKeyUnreadableError;
    const message = known ? (err as Error).message : "Something went wrong while generating. Please retry.";
    if (err instanceof OpenAIError) logger.warn({ userId: row.userId, kind: err.kind, status: err.status }, "openai call failed");
    else if (!known) logger.error({ err, userId: row.userId }, "generation failed");

    await db
      .update(generations)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(generations.id, id))
      .catch((e) => logger.error({ err: e }, "could not record failed generation"));
  }
}

/** For polling: this user's records with the given ids. */
export async function getOwnGenerations(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(generations)
    .where(and(eq(generations.userId, userId), inArray(generations.id, ids)));
}
