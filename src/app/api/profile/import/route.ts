import { workspaceUser } from "@/server/auth/api";
import { RateLimiter } from "@/server/auth/rate-limit";
import { OpenAIError } from "@/server/ai/openai";
import { detectKind, extractText, UnsupportedFileError } from "@/server/jd/parse-file";
import { logger } from "@/server/logger";
import { profileFromResumeText } from "@/server/profile/import";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const perUser = new RateLimiter(10, 10 * 60 * 1000);
const fail = (status: number, message: string) => Response.json({ error: { message } }, { status });

/** POST multipart "file" (.pdf, .docx, .doc, .txt) → profile form values read from the resume. */
export async function POST(req: Request) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = perUser.check(user.id);
  if (!limit.ok) return fail(429, `Too many imports. Try again in ${limit.retryAfterSec}s.`);
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BYTES + 64 * 1024) return fail(413, "The file is larger than 5 MB.");

  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    if (f && typeof f === "object" && "arrayBuffer" in f) file = f;
  } catch {
    return fail(400, "Expected a file upload.");
  }
  if (!file) return fail(400, "No file was uploaded.");
  if (file.size > MAX_BYTES) return fail(413, "The file is larger than 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(file.name, bytes, { pdf: true });
  if (!kind) return fail(400, "Upload a .pdf, .docx, .doc or .txt resume.");

  let text: string;
  try {
    text = (await extractText(kind, bytes)).trim();
  } catch (err) {
    if (err instanceof UnsupportedFileError) return fail(400, err.message);
    logger.warn({ err, userId: user.id, kind }, "resume import: could not read file");
    return fail(400, "Could not read this file. Is it a valid document?");
  }
  if (text.length < 50) {
    return fail(400, "No text found in this file. Scanned (image-only) PDFs can't be read; try a .docx or text PDF.");
  }

  try {
    const profile = await profileFromResumeText(text);
    logger.info({ userId: user.id, kind, experiences: profile.experiences.length }, "profile imported from resume");
    return Response.json({ profile });
  } catch (err) {
    if (err instanceof OpenAIError) return fail(502, err.message);
    logger.error({ err, userId: user.id }, "resume import failed");
    return fail(500, err instanceof Error && err.message.includes("administrator") ? err.message : "Could not read the resume. Please retry.");
  }
}
