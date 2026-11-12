import type { ResumeModel } from "./model";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/**
 * Escapes text, then turns **keyword** into <strong>keyword</strong>.
 * Escaping first means only our own <strong> tags can reach the HTML.
 */
export function rich(value: string): string {
  return esc(value)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/\*\*/g, "");
}

/** Only web, mail and phone links; anything else renders as plain text. */
export function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? esc(href) : null;
}

export function link(label: string, href?: string): string {
  const h = href ? safeHref(href) : null;
  return h ? `<a href="${h}">${esc(label)}</a>` : esc(label);
}

/** `margin` is the page margin (CSS length) used for both print and on-screen previews. */
export type ThemeRenderer = (m: ResumeModel) => { css: string; body: string; margin?: string };
