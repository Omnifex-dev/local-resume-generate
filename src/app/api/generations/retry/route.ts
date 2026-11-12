import { workspaceUser } from "@/server/auth/api";
import { toHistoryEntry, UUID } from "@/server/generation/repository";
import { GenerationError, retryGenerations } from "@/server/generation/service";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

const MAX_RETRY = 100;
const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** POST { ids: string[] } → re-queues those failed records; returns { records } (the ones re-queued). */
export async function POST(req: Request) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }
  const raw = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(raw) || raw.length === 0) return fail(400, "bad_request", "Choose at least one resume to retry.");
  if (raw.length > MAX_RETRY) return fail(400, "bad_request", `At most ${MAX_RETRY} resumes can be retried at once.`);
  const ids = [...new Set(raw.filter((id): id is string => typeof id === "string" && UUID.test(id)))];

  try {
    const rows = await retryGenerations(auth.user.id, ids);
    return Response.json({ records: rows.map(toHistoryEntry) });
  } catch (err) {
    if (err instanceof GenerationError) return fail(400, err.code, err.message);
    logger.error({ err, userId: auth.user.id }, "bulk retry failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}
