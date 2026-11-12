export const THEMES = [
  { id: "executive", name: "Executive", description: "Dark header, serif name, teal accents and date pills." },
  { id: "classic", name: "Classic", description: "Serif, centered header, traditional layout." },
  { id: "modern", name: "Modern", description: "Clean sans-serif with a blue accent." },
  { id: "two-column", name: "Two-column", description: "Contact and education in a side column." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "executive";
export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

export const PAGE_SIZES = ["A4", "Letter"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = "A4";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}
export function isPageSize(v: unknown): v is PageSize {
  return typeof v === "string" && (PAGE_SIZES as readonly string[]).includes(v);
}
