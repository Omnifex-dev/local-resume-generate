import type { PageSize, ThemeId } from "@/lib/themes";
import { esc, type ThemeRenderer } from "./escape";
import type { ResumeModel } from "./model";
import { classicTheme } from "./themes/classic";
import { executiveTheme } from "./themes/executive";
import { modernTheme } from "./themes/modern";
import { twoColumnTheme } from "./themes/two-column";

export { esc, link, rich, safeHref } from "./escape";

const RENDERERS: Record<ThemeId, ThemeRenderer> = {
  executive: executiveTheme,
  classic: classicTheme,
  modern: modernTheme,
  "two-column": twoColumnTheme,
};

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{color:#111827;font-size:10.5pt;line-height:1.4}
a{color:inherit;text-decoration:none}
ul{padding-left:1.1em}
li{margin:.15em 0;break-inside:avoid}
h1,h2,h3{break-after:avoid}
.job,.edu{break-inside:avoid-page}
`;

export function renderResumeHtml(model: ResumeModel, theme: ThemeId, pageSize: PageSize = "A4"): string {
  const { css, body, margin = "14mm 15mm" } = RENDERERS[theme](model);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${esc(model.name)} – Resume</title>
<style>@page{size:${pageSize};margin:${margin}}${BASE_CSS}@media screen{html{background:#fff}body{padding:${margin}}}${css}</style>
</head><body>${body}</body></html>`;
}
