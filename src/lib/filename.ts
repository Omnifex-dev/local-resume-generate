/** Safe, readable file name part: keeps letters/digits in any script, joins the rest with "_". */
export function safeFilePart(value: string, max = 60): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .replace(/_+/g, "_")
      .replace(/^[._]+|[._]+$/g, "")
      .slice(0, max) || "untitled"
  );
}

/**
 * 3, "Backend Engineer", "Acme" → "3-Backend_Engineer-Acme". `number` is the
 * resume's number among the user's resumes of its day; null (older records) → no prefix.
 */
export function resumeFileBase(number: number | null, role: string, company: string): string {
  const name = `${safeFilePart(role)}-${safeFilePart(company)}`;
  return number === null ? name : `${number}-${name}`;
}

/** The day number at the start of a file name ("3-Role-Company.pdf" → 3), or null. */
export function fileNumber(fileName: string | null | undefined): number | null {
  const m = fileName?.match(/^(\d{1,6})-/);
  return m ? Number(m[1]) : null;
}
