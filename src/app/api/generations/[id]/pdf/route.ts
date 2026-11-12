import { resumeFileBase } from "@/lib/filename";
import { isPageSize, isThemeId } from "@/lib/themes";
import { RateLimiter } from "@/server/auth/rate-limit";
import { workspaceUser } from "@/server/auth/api";
import { getOwnGeneration } from "@/server/generation/repository";
import { logger } from "@/server/logger";
import { PdfRenderError } from "@/server/pdf/chrome";
import { resumePdfFor } from "@/server/resume/render";
import type { ProfileSnapshot } from "@/resume/model";
import { getSettings } from "@/server/settings/repository";

export const runtime = "nodejs";
// Cold starts unpack Chromium (~a few seconds) before rendering.
export const maxDuration = 60;

const perUser = new RateLimiter(60, 60 * 1000);
const fail = (status: number, message: string) => Response.json({ error: { message } }, { status });

/** RFC 6266: ASCII fallback plus UTF-8 name for non-Latin characters. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_") || "resume.pdf";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** GET /api/generations/:id/pdf?theme=classic&pageSize=A4 (both optional; default to the user's settings) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await workspaceUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = perUser.check(user.id);
  if (!limit.ok) return fail(429, `Too many requests. Try again in ${limit.retryAfterSec}s.`);

  const { id } = await params;
  const gen = await getOwnGeneration(user.id, id);
  if (!gen || gen.status !== "succeeded" || !gen.content || !gen.profileSnapshot) return fail(404, "Resume not found.");

  const url = new URL(req.url);
  const settings = await getSettings(user.id);
  const theme = isThemeId(url.searchParams.get("theme")) ? (url.searchParams.get("theme") as typeof settings.themeId) : settings.themeId;
  const pageSize = isPageSize(url.searchParams.get("pageSize")) ? (url.searchParams.get("pageSize") as typeof settings.pageSize) : settings.pageSize;

  const snapshot = gen.profileSnapshot as ProfileSnapshot;
  try {
    const started = Date.now();
    const pdf = await resumePdfFor(snapshot, gen.content, gen.extras ?? null, { fallbackName: user.username, theme, pageSize });
    logger.info({ userId: user.id, generationId: id, theme, ms: Date.now() - started, bytes: pdf.length }, "pdf rendered");

    // Older records (made before file names were stored) get a name in the same format.
    const name = gen.pdfFileName ?? `${resumeFileBase(gen.role ?? "Role", gen.company ?? "Company", gen.createdAt.getTime())}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof PdfRenderError) {
      logger.error({ err: err.message, userId: user.id }, "pdf render failed");
      return fail(500, err.message);
    }
    logger.error({ err, userId: user.id }, "pdf render failed");
    return fail(500, "Could not create the PDF. Please retry.");
  }
}
