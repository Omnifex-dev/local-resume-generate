import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Common install locations on Ubuntu (apt, Google's .deb, snap). */
const CANDIDATES = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/usr/bin/microsoft-edge",
];

export class PdfRenderError extends Error {}

export function findChrome(explicit?: string): string | null {
  if (explicit) return existsSync(explicit) ? explicit : null;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** Tiny semaphore: each Chrome uses ~100–200 MB, so cap parallel renders. */
function limiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => waiting.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

const limit = limiter(2);

export type RenderOptions = {
  chromePath?: string;
  noSandbox?: boolean;
  timeoutMs?: number;
};

/**
 * Prints self-contained HTML to PDF with headless Chrome.
 * Network access is blocked at DNS level, and the HTML carries a CSP that forbids
 * scripts and remote loads (see renderResumeHtml). Note: Chrome's
 * --blink-settings=scriptEnabled=false flag silently breaks --print-to-pdf.
 */
export function renderPdf(html: string, opts: RenderOptions = {}): Promise<Buffer> {
  return limit(async () => {
    const chrome = findChrome(opts.chromePath);
    if (!chrome) {
      throw new PdfRenderError(
        opts.chromePath
          ? `Chrome not found at CHROME_PATH=${opts.chromePath}.`
          : "Google Chrome or Chromium is required to create PDFs. Install it (e.g. 'sudo apt install chromium') or set CHROME_PATH.",
      );
    }

    const dir = await mkdtemp(path.join(tmpdir(), "resume-pdf-"));
    const htmlPath = path.join(dir, "resume.html");
    const pdfPath = path.join(dir, "resume.pdf");
    try {
      await writeFile(htmlPath, html, "utf8");
      const args = [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check",
        "--host-resolver-rules=MAP * ~NOTFOUND",
        "--no-pdf-header-footer",
        `--user-data-dir=${path.join(dir, "profile")}`,
        `--print-to-pdf=${pdfPath}`,
        ...(opts.noSandbox ? ["--no-sandbox"] : []),
        pathToFileURL(htmlPath).href,
      ];
      await runChrome(chrome, args, opts.timeoutMs ?? 30_000);
      const pdf = await readFile(pdfPath).catch(() => null);
      if (!pdf || pdf.subarray(0, 5).toString() !== "%PDF-") throw new PdfRenderError("Chrome did not produce a PDF.");
      return pdf;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

function runChrome(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < 10000) stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new PdfRenderError(`PDF rendering timed out after ${timeoutMs / 1000}s.`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new PdfRenderError(`Could not start Chrome: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        const hint = /sandbox/i.test(stderr) ? " (Chrome's sandbox failed; set CHROME_NO_SANDBOX=true when running as root or in Docker)" : "";
        reject(new PdfRenderError(`Chrome exited with code ${code}${hint}.`));
      }
    });
  });
}
