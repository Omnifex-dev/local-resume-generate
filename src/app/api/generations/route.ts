import { HISTORY_PAGE_SIZE } from "@/lib/history";
import { jdBatchSchema } from "@/lib/jd";
import { workspaceUser } from "@/server/auth/api";
import { RateLimiter } from "@/server/auth/rate-limit";
import { searchGenerations, toHistoryEntry, UUID } from "@/server/generation/repository";
import { createGenerations, deleteGenerations, failInterrupted, GenerationError, getOwnGenerations } from "@/server/generation/service";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

const perUser = new RateLimiter(20, 60 * 1000);
const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** POST { jobs: JobDescription[] } → creates pending records and queues them. */
export async function POST(req: Request) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = perUser.check(user.id);
  if (!limit.ok) return fail(429, "rate_limited", `Too many generations. Try again in ${limit.retryAfterSec}s.`);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }
  const parsed = jdBatchSchema.safeParse((body as { jobs?: unknown })?.jobs);
  if (!parsed.success) return fail(400, "invalid_job", parsed.error.issues[0]?.message ?? "Invalid job description.");

  try {
    const rows = await createGenerations(user.id, parsed.data);
    return Response.json({ records: rows.map(toHistoryEntry) }, { status: 201 });
  } catch (err) {
    if (err instanceof GenerationError) return fail(400, err.code, err.message);
    logger.error({ err, userId: user.id }, "creating generations failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}

const MAX_QUERY = 200;

/**
 * GET ?ids=a,b,c → the current state of those records (used to poll pending ones).
 * GET ?tab=created|not-created&q=&from=&to=&cursor=&limit= → one page of history, newest first.
 */
export async function GET(req: Request) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const params = new URL(req.url).searchParams;
  await failInterrupted(auth.user.id);

  if (params.has("ids")) {
    const ids = (params.get("ids") ?? "")
      .split(",")
      .filter((id) => UUID.test(id))
      .slice(0, 100);
    const rows = await getOwnGenerations(auth.user.id, ids);
    return Response.json({ records: rows.map(toHistoryEntry) }, { headers: { "Cache-Control": "no-store" } });
  }

  const date = (name: string) => {
    const v = params.get(name);
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = date("from");
  const to = date("to");
  if (from === null || to === null) return fail(400, "bad_request", "from/to must be ISO dates.");
  const tab = params.get("tab") === "not-created" ? "not-created" : "created";
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || HISTORY_PAGE_SIZE));

  const page = await searchGenerations(auth.user.id, {
    tab,
    q: (params.get("q") ?? "").slice(0, MAX_QUERY),
    from,
    to,
    cursor: params.get("cursor"),
    limit,
  });
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
}

const MAX_DELETE = 200;

/** DELETE { ids: string[] } → deletes those records (skipping ones still generating); returns { deleted: ids }. */
export async function DELETE(req: Request) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }
  const raw = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(raw) || raw.length === 0) return fail(400, "bad_request", "Choose at least one resume to delete.");
  if (raw.length > MAX_DELETE) return fail(400, "bad_request", `At most ${MAX_DELETE} resumes can be deleted at once.`);
  const ids = [...new Set(raw.filter((id): id is string => typeof id === "string" && UUID.test(id)))];

  try {
    const deleted = await deleteGenerations(auth.user.id, ids);
    return Response.json({ deleted });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "bulk delete failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}
