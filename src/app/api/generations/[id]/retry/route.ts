import { workspaceUser } from "@/server/auth/api";
import { toHistoryEntry } from "@/server/generation/repository";
import { GenerationError, retryGeneration } from "@/server/generation/service";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    return Response.json({ record: toHistoryEntry(await retryGeneration(auth.user.id, id)) });
  } catch (err) {
    if (err instanceof GenerationError) return fail(err.code === "not_found" ? 404 : 400, err.code, err.message);
    logger.error({ err, userId: auth.user.id }, "retry failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}
