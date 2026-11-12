import { resumeEditSchema } from "@/lib/edit-schema";
import { workspaceUser } from "@/server/auth/api";
import { toHistoryEntry } from "@/server/generation/repository";
import { deleteGeneration, GenerationError, updateGenerationContent } from "@/server/generation/service";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** PATCH { role, company, content, extras } → saves edits of a finished record; returns { record }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }
  const parsed = resumeEditSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_edit", parsed.error.issues[0]?.message ?? "Invalid resume.");

  try {
    return Response.json({ record: toHistoryEntry(await updateGenerationContent(auth.user.id, id, parsed.data)) });
  } catch (err) {
    if (err instanceof GenerationError) return fail(err.code === "not_found" ? 404 : 409, err.code, err.message);
    logger.error({ err, userId: auth.user.id }, "edit failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}

/** DELETE → removes the record (404 if it isn't the user's, 409 while it is generating). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await deleteGeneration(auth.user.id, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof GenerationError) return fail(err.code === "not_found" ? 404 : err.code === "busy" ? 409 : 400, err.code, err.message);
    logger.error({ err, userId: auth.user.id }, "delete failed");
    return fail(500, "internal", "Something went wrong. Please retry.");
  }
}
