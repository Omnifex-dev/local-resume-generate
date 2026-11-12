import { esc, link, rich, type ThemeRenderer } from "../escape";
import type { ContactKind } from "../model";
import { bulletList, section } from "../sections";

// Stroke icons (24×24 grid). Inline SVG has no text, so PDF text extraction is unaffected.
const ICON_PATHS: Record<ContactKind, string> = {
  location: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  phone:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  linkedin:
    '<rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 10v7M7 7v.01M11 17v-7M11 13a3 3 0 0 1 6 0v4"/>',
  github:
    '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5.1 5.1 0 0 0 19.9 1S18.7.7 16 2.5a13.4 13.4 0 0 0-7 0C6.3.7 5.1 1 5.1 1A5.1 5.1 0 0 0 5 4.8a5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 0 0-.9 2.6V22"/>',
};

const icon = (kind: ContactKind) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[kind]}</svg>`;

/** Dark gradient header, serif name, teal accents, period pills (see the reference design). */
export const executiveTheme: ThemeRenderer = (m) => {
  const contact = m.contact.length
    ? `<ul class="contact">${m.contact.map((c) => `<li>${icon(c.kind)}<span>${link(c.label, c.href)}</span></li>`).join("")}</ul>`
    : "";

  const experience = section(
    "Experience",
    m.experiences
      .map(
        (e) => `<div class="job">
  <div class="row"><div><h3>${esc(e.role)} <span class="at">· ${esc(e.company)}</span></h3>${
    e.location ? `<div class="sub">${esc(e.location)}</div>` : ""
  }</div><span class="pill">${esc(e.period)}</span></div>
  ${bulletList(e.bullets)}
</div>`,
      )
      .join(""),
  );

  const education = section(
    "Education",
    m.educations
      .map((e) => {
        const title = e.degree
          ? `${esc(e.degree)}${e.field ? ` <span class="at">— ${esc(e.field)}</span>` : ""}`
          : `${esc(e.university)}${e.field ? ` <span class="at">— ${esc(e.field)}</span>` : ""}`;
        const sub = [e.degree ? e.university : "", e.location ?? ""].filter(Boolean).map(esc).join(" · ");
        return `<div class="edu">
  <div class="row"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ""}</div><span class="pill">${esc(e.period)}</span></div>
</div>`;
      })
      .join(""),
  );

  const skills = section(
    "Technical Skills",
    m.skills.length
      ? `<div class="skills">${m.skills.map((g) => `<p><strong>${esc(g.category)}:</strong> ${esc(g.items.join(", "))}</p>`).join("")}</div>`
      : "",
  );

  const languages = section(
    "Languages",
    m.languages.length
      ? `<div class="langs">${m.languages
          .map((l) => `<p><strong>${esc(l.name)}</strong>${l.level ? ` <span class="at">— ${esc(l.level)}</span>` : ""}</p>`)
          .join("")}</div>`
      : "",
  );

  const header = `<header class="hero">
  <h1>${esc(m.name)}</h1>
  ${m.headline ? `<div class="headline">${esc(m.headline)}</div>` : ""}
  ${contact}
</header>`;

  return {
    margin: "9mm",
    css: `
body{font-family:Inter,"Noto Sans","Ubuntu Sans","Liberation Sans",Arial,sans-serif;font-size:9.6pt;line-height:1.55;color:#4b5563}
.hero{background:#0f172a linear-gradient(115deg,#0b1424 0%,#0f2236 45%,#124a46 100%);color:#fff;padding:8mm 8mm 5.5mm}
.hero h1{font-family:"Playfair Display","Noto Serif Display","Noto Serif","DejaVu Serif",Georgia,serif;font-size:30pt;font-weight:700;line-height:1.1;letter-spacing:-.005em}
.headline{color:#5eead4;font-size:13pt;margin-top:4pt}
.contact{list-style:none;padding:9pt 0 0;margin-top:11pt;border-top:1px solid rgba(255,255,255,.16);display:flex;flex-wrap:wrap;gap:4pt 18pt;font-size:9.2pt;color:#e5e7eb}
.contact li{display:flex;align-items:center;gap:6pt;margin:0;break-inside:auto}
.contact svg{width:10.5pt;height:10.5pt;color:#5eead4;flex:none}
main{padding:0 6mm}
section{margin-top:13pt}
h2{display:flex;align-items:center;gap:9pt;font-size:9pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0f766e;margin-bottom:7pt}
h2::after{content:"";flex:1;height:1px;background:#e5e7eb}
strong{color:#1f2937;font-weight:600}
.summary{text-align:justify}
.job{border-left:2px solid #d1f2e8;padding-left:10pt;margin-bottom:10pt}
.edu{margin-bottom:8pt}
.row{display:flex;justify-content:space-between;align-items:flex-start;gap:14pt}
h3{font-size:10.5pt;font-weight:600;color:#111827;line-height:1.4}
.at{font-weight:400;color:#6b7280}
.sub{font-size:8.8pt;color:#9ca3af;margin-top:1pt}
.pill{flex:none;background:#e6f6f0;color:#0f766e;font-size:8.6pt;font-weight:600;border-radius:999px;padding:2pt 9pt;white-space:nowrap}
ul{padding-left:1.15em;margin-top:4pt}
li{margin:.2em 0;padding-left:.15em}
li::marker{color:#0f766e}
.skills{display:grid;grid-template-columns:1fr 1fr;gap:6pt 20pt;font-size:9pt;line-height:1.5}
.skills p{break-inside:avoid}
.langs{display:flex;flex-wrap:wrap;gap:3pt 24pt}
`,
    body: `${header}<main>${section("Professional Summary", m.summary ? `<p class="summary">${rich(m.summary)}</p>` : "")}${experience}${education}${skills}${languages}${section(
      "Additional Information",
      bulletList(m.additional),
    )}</main>`,
  };
};
