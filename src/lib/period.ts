const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2021-03" → "Mar 2021". Returns the input unchanged if it is not YYYY-MM. */
export function formatMonth(ym: string): string {
  if (!MONTH_PATTERN.test(ym)) return ym;
  const [year, month] = ym.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** ("2021-03", null) → "Mar 2021 – Present" */
export function formatPeriod(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "Present"}`;
}
