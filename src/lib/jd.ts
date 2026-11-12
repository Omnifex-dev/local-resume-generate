import { z } from "zod";

/** Separator between job descriptions in a multi-JD file. 8 or more slashes count. */
export const JD_SEPARATOR = "////////";
const SEPARATOR_RE = /\/{8,}/;

export const JD_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 2 * 1024 * 1024,
  maxBlocks: 50,
  minDescriptionChars: 30,
  maxDescriptionChars: 20_000,
} as const;

export const ACCEPTED_EXTENSIONS = [".txt", ".doc", ".docx"] as const;

function normalizeBlock(block: string): string {
  return block
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text on "////////", normalises whitespace and drops empty blocks. */
export function splitJobDescriptions(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(SEPARATOR_RE)
    .map(normalizeBlock)
    .filter((b) => b.length > 0);
}

const ROLE_KEYS = new Set(["role", "position", "title", "job title", "job role", "job position"]);
const COMPANY_KEYS = new Set(["company", "compamy", "company name", "employer", "organization", "organisation", "client"]);
const JD_KEYS = new Set(["jd", "job description", "description", "job details", "details"]);
// `key: value`, also inside a JSON-like wrapper: `"role": "Dev",`
const KEY_LINE_RE = /^["'\s]*([a-z][a-z ]{0,20}?)["'\s]*[:=]\s*(.*)$/i;

/** Strips JSON-like quoting and trailing commas from a header value. */
const cleanValue = (v: string) =>
  v
    .trim()
    .replace(/,$/, "")
    .replace(/^["'](.*)["']$/, "$1")
    .trim()
    .slice(0, 200);

/**
 * Reads an optional header at the top of a block:
 *   role: Full stack developer
 *   company: Gamba
 *   JD: ...the posting...
 * Optional `{` / `}` wrappers are ignored. Without a header the whole block is
 * the description and role/company are "".
 */
export function parseJdBlock(block: string): { role: string; company: string; description: string } {
  const lines = block.split("\n");
  let role = "";
  let company = "";
  let i = 0;
  // Leading blank lines and a lone "{"
  while (i < lines.length && /^\s*\{?\s*$/.test(lines[i] ?? "")) i++;

  for (; i < lines.length; i++) {
    const m = KEY_LINE_RE.exec(lines[i] ?? "");
    if (!m) break;
    const key = (m[1] ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const value = m[2] ?? "";
    if (ROLE_KEYS.has(key) && !role) role = cleanValue(value);
    else if (COMPANY_KEYS.has(key) && !company) company = cleanValue(value);
    else if (JD_KEYS.has(key)) {
      const rest = [value, ...lines.slice(i + 1)].join("\n");
      return { role, company, description: stripWrapper(rest) };
    } else break;
  }
  if (!role && !company) return { role, company, description: block };
  return { role, company, description: stripWrapper(lines.slice(i).join("\n")) };
}

/** Removes a closing `}` (and an opening quote pair) left over from a JSON-like wrapper. */
function stripWrapper(text: string): string {
  let t = text.trim().replace(/\}\s*$/, "").trim();
  if (/^["'][\s\S]*["'],?$/.test(t)) t = t.replace(/,$/, "").slice(1, -1);
  return normalizeBlock(t);
}

const description = z
  .string()
  .trim()
  .min(JD_LIMITS.minDescriptionChars, `Job description must be at least ${JD_LIMITS.minDescriptionChars} characters`)
  .max(JD_LIMITS.maxDescriptionChars, `Job description must be at most ${JD_LIMITS.maxDescriptionChars} characters`);

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`).max(200, "Must be at most 200 characters");
const optionalText = z
  .string()
  .trim()
  .max(200, "Must be at most 200 characters")
  .transform((v) => (v === "" ? null : v));

/** Single mode: Role, Company and JD are all required. */
export const singleJdSchema = z.object({
  role: requiredText("Role"),
  company: requiredText("Company"),
  description,
});

/** Multi mode: role/company are optional; the AI will extract them (M5). */
export const jdBlockSchema = z.object({
  role: optionalText,
  company: optionalText,
  description,
});

export const jdBatchSchema = z
  .array(jdBlockSchema)
  .min(1, "Add at least one job description")
  .max(JD_LIMITS.maxBlocks, `At most ${JD_LIMITS.maxBlocks} job descriptions at a time`);

export type JobDescription = z.output<typeof jdBlockSchema>;

/** Response of POST /api/jd/parse */
export type ParsedJdBlock = { source: string; index: number; role: string; company: string; description: string; truncated: boolean };
export type ParseJdResponse = { blocks: ParsedJdBlock[]; errors: { file: string; message: string }[] };
