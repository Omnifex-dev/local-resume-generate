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

/** "Backend Engineer", "Acme", 1731312000000 → "Backend_Engineer-Acme-1731312000000" */
export function resumeFileBase(role: string, company: string, timestamp: number): string {
  return `${safeFilePart(role)}-${safeFilePart(company)}-${timestamp}`;
}
