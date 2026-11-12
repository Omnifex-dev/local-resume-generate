import "server-only";
import type { PageSize, ThemeId } from "@/lib/themes";
import { renderResumeHtml } from "@/resume/html";
import { buildResumeModel, type ProfileSnapshot, type ResumeExtras } from "@/resume/model";
import { contentKeys } from "../ai/resume-content";
import { env } from "../env";
import { renderPdf } from "../pdf/chrome";

export function resumeHtmlFor(
  snapshot: ProfileSnapshot,
  content: Record<string, string[]>,
  extras: ResumeExtras | null,
  opts: { fallbackName: string; theme: ThemeId; pageSize: PageSize },
): string {
  const bullets = contentKeys(snapshot.experiences).map((k) => content[k] ?? []);
  return renderResumeHtml(buildResumeModel(snapshot, bullets, opts.fallbackName, extras), opts.theme, opts.pageSize);
}

export function resumePdfFor(...args: Parameters<typeof resumeHtmlFor>): Promise<Buffer> {
  return renderPdf(resumeHtmlFor(...args), { chromePath: env.CHROME_PATH, noSandbox: env.CHROME_NO_SANDBOX });
}
