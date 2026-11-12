import { esc, link, type ThemeRenderer } from "../escape";
import { bulletList, degreeText, section, summaryBlock } from "../sections";

const LABELS = { location: "Location", email: "Email", phone: "Phone", linkedin: "LinkedIn", github: "GitHub" } as const;

export const twoColumnTheme: ThemeRenderer = (m) => {
  const contact = section(
    "Contact",
    m.contact.length ? `<dl>${m.contact.map((c) => `<dt>${LABELS[c.kind]}</dt><dd>${link(c.label, c.href)}</dd>`).join("")}</dl>` : "",
  );

  const education = section(
    "Education",
    m.educations
      .map((e) => {
        const degree = degreeText(e);
        return `<div class="edu">
  <h3>${esc(e.university)}</h3>
  ${degree ? `<div>${degree}</div>` : ""}
  ${e.location ? `<div class="muted">${esc(e.location)}</div>` : ""}
  <div class="muted">${esc(e.period)}</div>
</div>`;
      })
      .join(""),
  );

  const skills = section(
    "Skills",
    m.skills.map((g) => `<div class="group"><h3>${esc(g.category)}</h3><div>${esc(g.items.join(", "))}</div></div>`).join(""),
  );

  const languages = section(
    "Languages",
    m.languages.map((l) => `<div>${esc(l.name)}${l.level ? ` <span class="muted">— ${esc(l.level)}</span>` : ""}</div>`).join(""),
  );

  const experience = section(
    "Experience",
    m.experiences
      .map(
        (e) => `<div class="job">
  <div class="row"><h3>${esc(e.company)}</h3>${e.location ? `<span class="muted">${esc(e.location)}</span>` : ""}</div>
  <div class="row"><span class="role">${esc(e.role)}</span><span class="muted">${esc(e.period)}</span></div>
  ${bulletList(e.bullets)}
</div>`,
      )
      .join(""),
  );

  const side = contact + education + skills + languages;
  const main = section("Summary", summaryBlock(m)) + experience + section("Additional Information", bulletList(m.additional));

  return {
    css: `
body{font-family:"Liberation Sans","Helvetica Neue",Arial,"DejaVu Sans",sans-serif;font-size:9.8pt}
h1{font-size:22pt;font-weight:700;color:#0f766e}
.headline{font-size:12pt;color:#374151;margin-top:1pt}
header{margin-bottom:10pt}
.cols{display:grid;grid-template-columns:${side && main ? "30% 1fr" : "1fr"};gap:16pt}
aside{border-right:1px solid #d1d5db;padding-right:12pt}
section{margin-bottom:10pt}
h2{font-size:9pt;text-transform:uppercase;letter-spacing:.04em;color:#0f766e;margin-bottom:5pt}
dt{font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-top:4pt}
dd{word-break:break-word}
.edu,.group{margin-bottom:7pt}
.group h3{font-size:9.5pt}
.job{margin-bottom:9pt}
h3{font-size:10.5pt;font-weight:700}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:10pt}
.role{font-style:italic}
.muted{color:#6b7280;font-size:9pt}
.row .muted{white-space:nowrap}
ul{margin-top:3pt}
.summary{margin-bottom:2pt}
`,
    body: `<header><h1>${esc(m.name)}</h1>${m.headline ? `<div class="headline">${esc(m.headline)}</div>` : ""}</header><div class="cols">${
      side ? `<aside>${side}</aside>` : ""
    }${main ? `<main>${main}</main>` : ""}</div>`,
  };
};
