import { esc, rich } from "./escape";
import type { ResumeModel } from "./model";

/** Shared HTML fragments; each returns "" when there is nothing to show. */

export function section(title: string, inner: string, cls = ""): string {
  return inner ? `<section${cls ? ` class="${cls}"` : ""}><h2>${esc(title)}</h2>${inner}</section>` : "";
}

export function bulletList(items: string[]): string {
  return items.length ? `<ul>${items.map((b) => `<li>${rich(b)}</li>`).join("")}</ul>` : "";
}

export function summaryBlock(m: ResumeModel): string {
  return m.summary ? `<p class="summary">${rich(m.summary)}</p>` : "";
}

export function skillsBlock(m: ResumeModel): string {
  return m.skills.length
    ? `<div class="skills">${m.skills
        .map((g) => `<p><strong>${esc(g.category)}:</strong> ${esc(g.items.join(", "))}</p>`)
        .join("")}</div>`
    : "";
}

export function languagesBlock(m: ResumeModel, separator = '<span class="sep">·</span>'): string {
  return m.languages.length
    ? `<p class="langs">${m.languages
        .map((l) => `<span><strong>${esc(l.name)}</strong>${l.level ? ` — ${esc(l.level)}` : ""}</span>`)
        .join(separator)}</p>`
    : "";
}

/** "B.Sc. Computer Science, Machine Learning" */
export function degreeText(e: ResumeModel["educations"][number]): string {
  return [e.degree, e.field].filter(Boolean).map((v) => esc(v!)).join(", ");
}

/** Summary, skills, languages and additional info for single-column themes. */
export function extraSections(m: ResumeModel) {
  return {
    summary: section("Summary", summaryBlock(m)),
    skills: section("Skills", skillsBlock(m)),
    languages: section("Languages", languagesBlock(m)),
    additional: section("Additional Information", bulletList(m.additional)),
  };
}
