import { JD_LIMITS, parseJdBlock, splitJobDescriptions, type ParseJdResponse, type ParsedJdBlock } from "@/lib/jd";
import { RateLimiter } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { detectKind, extractText, UnsupportedFileError } from "@/server/jd/parse-file";
import { logger } from "@/server/logger";

export const runtime = "nodejs";

const perUser = new RateLimiter(30, 60 * 1000);
// Multipart overhead allowance on top of the file bytes.
const MAX_BODY_BYTES = JD_LIMITS.maxFiles * JD_LIMITS.maxFileBytes + 256 * 1024;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return error(401, "Please sign in again.");

  const limit = perUser.check(user.id);
  if (!limit.ok) return error(429, `Too many uploads. Try again in ${limit.retryAfterSec}s.`);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return error(413, "Upload is too large.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "Expected a multipart/form-data upload.");
  }

  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length === 0) return error(400, "No files were uploaded.");
  if (files.length > JD_LIMITS.maxFiles) return error(400, `Upload at most ${JD_LIMITS.maxFiles} files at a time.`);

  const result: ParseJdResponse = { blocks: [], errors: [] };
  const mb = JD_LIMITS.maxFileBytes / 1024 / 1024;

  for (const file of files) {
    const name = file.name.slice(0, 200) || "unnamed";
    if (file.size > JD_LIMITS.maxFileBytes) {
      result.errors.push({ file: name, message: `File is larger than ${mb} MB.` });
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectKind(name, bytes);
    if (!kind) {
      result.errors.push({ file: name, message: "Only .txt, .doc and .docx files are supported." });
      continue;
    }

    let text: string;
    try {
      text = await extractText(kind, bytes);
    } catch (err) {
      if (err instanceof UnsupportedFileError) {
        result.errors.push({ file: name, message: err.message });
      } else {
        logger.warn({ err, userId: user.id, kind }, "jd file parse failed");
        result.errors.push({ file: name, message: "Could not read this file. Is it a valid document?" });
      }
      continue;
    }

    const parts = splitJobDescriptions(text);
    if (parts.length === 0) {
      result.errors.push({ file: name, message: "No job description text found in this file." });
      continue;
    }

    parts.forEach((part, i) => {
      const { role, company, description } = parseJdBlock(part);
      const block: ParsedJdBlock = {
        source: name,
        index: i + 1,
        role,
        company,
        description: description.slice(0, JD_LIMITS.maxDescriptionChars),
        truncated: description.length > JD_LIMITS.maxDescriptionChars,
      };
      result.blocks.push(block);
    });
  }

  if (result.blocks.length > JD_LIMITS.maxBlocks) {
    result.errors.push({
      file: "(all files)",
      message: `Only the first ${JD_LIMITS.maxBlocks} of ${result.blocks.length} job descriptions were kept.`,
    });
    result.blocks = result.blocks.slice(0, JD_LIMITS.maxBlocks);
  }

  logger.info({ userId: user.id, files: files.length, blocks: result.blocks.length, errors: result.errors.length }, "jd files parsed");
  return Response.json(result);
}
