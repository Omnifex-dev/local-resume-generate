import "server-only";
import { spawn } from "node:child_process";

export type FileKind = "txt" | "doc" | "docx" | "pdf";

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // .docx
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);
const hasUtf16Bom = (b: Uint8Array) => (b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff);

export class UnsupportedFileError extends Error {}

/**
 * Decides the real file type from the extension AND the file's first bytes, so a
 * renamed binary can't be passed off as text (or the other way round).
 */
export function detectKind(fileName: string, bytes: Uint8Array, opts: { pdf?: boolean } = {}): FileKind | null {
  const ext = /\.[a-z0-9]+$/i.exec(fileName)?.[0]?.toLowerCase();
  const isOle = startsWith(bytes, OLE_MAGIC);
  const isZip = startsWith(bytes, ZIP_MAGIC);

  switch (ext) {
    case ".doc":
      // Some tools save .docx content with a .doc name; both are readable.
      return isOle ? "doc" : isZip ? "docx" : null;
    case ".docx":
      return isZip ? "docx" : null;
    case ".pdf":
      return opts.pdf && startsWith(bytes, PDF_MAGIC) ? "pdf" : null;
    case ".txt":
      if (isOle || isZip) return null;
      if (!hasUtf16Bom(bytes) && bytes.includes(0)) return null; // binary data
      return "txt";
    default:
      return null;
  }
}

/** Decodes text files: honours BOMs, tries strict UTF-8, falls back to Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

type WordExtractorCtor = new () => { extract(source: Buffer): Promise<{ getBody(): string }> };
let extractorCtor: Promise<WordExtractorCtor> | undefined;

async function loadWordExtractor(): Promise<WordExtractorCtor> {
  const name = "word-extractor";
  // webpackIgnore: loaded by Node at runtime, so a missing package gives a clear
  // error instead of breaking the whole build.
  extractorCtor ??= import(/* webpackIgnore: true */ name).then(
    (m: { default: WordExtractorCtor }) => m.default,
    () => {
      extractorCtor = undefined;
      throw new UnsupportedFileError("Word support isn't installed on the server. Run `npm install` and restart the app.");
    },
  );
  return extractorCtor;
}

/** PDF text via poppler's pdftotext (apt: poppler-utils), reading the PDF from stdin. */
function pdfToText(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftotext", ["-enc", "UTF-8", "-layout", "-", "-"], { stdio: ["pipe", "pipe", "ignore"] });
    const out: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        err.code === "ENOENT"
          ? new UnsupportedFileError("Reading PDFs needs pdftotext on the server (sudo apt install poppler-utils).")
          : err,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out).toString("utf8"));
      else reject(new Error(`pdftotext exited with ${code}`));
    });
    child.stdin.on("error", () => {}); // reported through "close"
    child.stdin.end(Buffer.from(bytes));
  });
}

export async function extractText(kind: FileKind, bytes: Uint8Array): Promise<string> {
  if (kind === "txt") return decodeText(bytes);
  if (kind === "pdf") return pdfToText(bytes);
  const WordExtractor = await loadWordExtractor();
  const doc = await new WordExtractor().extract(Buffer.from(bytes));
  return doc.getBody();
}
