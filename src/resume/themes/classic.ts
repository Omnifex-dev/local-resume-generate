import { esc, link, type ThemeRenderer } from "../escape";
import { bulletList, degreeText, extraSections, section } from "../sections";

export const classicTheme: ThemeRenderer = (m) => {
  const contact = m.contact.map((c) => `<span>${link(c.label, c.href)}</span>`).join('<span class="sep">·</span>');
  const x = extraSections(m);

  const experience = section(
    "Experience",
    m.experiences
      .map(
        (e) => `<div class="job">
  <div class="row"><h3>${esc(e.company)}</h3><span class="period">${esc(e.period)}</span></div>
  <div class="row"><span class="role">${esc(e.role)}</span>${e.location ? `<span class="period">${esc(e.location)}</span>` : ""}</div>
  ${bulletList(e.bullets)}
</div>`,
      )
      .join(""),
  );

  const education = section(
    "Education",
    m.educations
      .map((e) => {
        const detail = [degreeText(e), e.location ? esc(e.location) : ""].filter(Boolean).join(", ");
        return `<div class="edu">
  <div class="row"><h3>${esc(e.university)}</h3><span class="period">${esc(e.period)}</span></div>
  ${detail ? `<div class="role">${detail}</div>` : ""}
</div>`;
      })
      .join(""),
  );

  return {
    css: `
body{font-family:"Liberation Serif","Times New Roman",Georgia,serif}
header{text-align:center;margin-bottom:10pt}
h1{font-size:22pt;letter-spacing:.04em;text-transform:uppercase;font-weight:700}
.headline{font-size:12pt;font-style:italic;margin-top:2pt}
.contact{margin-top:4pt;font-size:10pt;color:#374151}
.sep{margin:0 .5em;color:#9ca3af}
section{margin-top:10pt}
h2{font-size:11pt;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #111827;padding-bottom:2pt;margin-bottom:6pt}
.job,.edu{margin-bottom:8pt}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:12pt}
h3{font-size:11pt}
.period{font-size:10pt;white-space:nowrap}
.role{font-style:italic;margin-bottom:2pt}
.summary{text-align:justify}
.skills p{margin:2pt 0}
`,
    body: `<header><h1>${esc(m.name)}</h1>${m.headline ? `<div class="headline">${esc(m.headline)}</div>` : ""}${
      contact ? `<div class="contact">${contact}</div>` : ""
    }</header>${x.summary}${experience}${education}${x.skills}${x.languages}${x.additional}`,
  };
};
