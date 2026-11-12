import { esc, link, type ThemeRenderer } from "../escape";
import { bulletList, degreeText, extraSections, section } from "../sections";

export const modernTheme: ThemeRenderer = (m) => {
  const contact = m.contact.map((c) => `<li>${link(c.label, c.href)}</li>`).join("");
  const x = extraSections(m);

  const experience = section(
    "Experience",
    m.experiences
      .map(
        (e) => `<div class="job">
  <div class="row"><h3>${esc(e.role)} <span class="at">· ${esc(e.company)}</span></h3><span class="period">${esc(e.period)}</span></div>
  ${e.location ? `<div class="muted">${esc(e.location)}</div>` : ""}
  ${bulletList(e.bullets)}
</div>`,
      )
      .join(""),
  );

  const education = section(
    "Education",
    m.educations
      .map((e) => {
        const degree = degreeText(e);
        return `<div class="edu">
  <div class="row"><h3>${degree ? `${degree} <span class="at">· ${esc(e.university)}</span>` : esc(e.university)}</h3><span class="period">${esc(e.period)}</span></div>
  ${e.location ? `<div class="muted">${esc(e.location)}</div>` : ""}
</div>`;
      })
      .join(""),
  );

  return {
    css: `
body{font-family:"Liberation Sans","Helvetica Neue",Arial,"DejaVu Sans",sans-serif;font-size:10pt}
header{border-bottom:3pt solid #1d4ed8;padding-bottom:8pt;margin-bottom:6pt}
h1{font-size:24pt;font-weight:700;color:#1e3a8a;letter-spacing:-.01em}
.headline{font-size:12pt;color:#1d4ed8;margin-top:1pt}
.contact{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:2pt 14pt;margin-top:4pt;color:#374151;font-size:9.5pt}
.contact li{margin:0}
section{margin-top:10pt}
h2{font-size:10pt;text-transform:uppercase;letter-spacing:.04em;color:#1d4ed8;margin-bottom:6pt}
.job,.edu{margin-bottom:9pt}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:12pt}
h3{font-size:10.5pt;font-weight:700}
.at{font-weight:400;color:#374151}
.period,.muted{color:#6b7280;font-size:9pt;white-space:nowrap}
ul{margin-top:3pt}
li::marker{color:#1d4ed8}
.skills p{margin:2pt 0}
.sep{margin:0 .5em;color:#9ca3af}
`,
    body: `<header><h1>${esc(m.name)}</h1>${m.headline ? `<div class="headline">${esc(m.headline)}</div>` : ""}${
      contact ? `<ul class="contact">${contact}</ul>` : ""
    }</header>${x.summary}${experience}${education}${x.skills}${x.languages}${x.additional}`,
  };
};
