import type { ProfileSnapshot, ResumeExtras } from "./model";

/** Used for theme previews when the user's profile is still empty. */
export const SAMPLE_PROFILE: ProfileSnapshot = {
  name: "Alex Morgan",
  email: "alex.morgan@example.com",
  phone: "+1 555 010 2030",
  linkedin: "https://linkedin.com/in/alexmorgan",
  github: "https://github.com/alexmorgan",
  headline: "Senior Software Engineer",
  location: "Springfield, USA",
  skills: null,
  languages: "English — Native\nSpanish — Conversational",
  experiences: [
    { company: "Northwind Labs", role: "Senior Software Engineer", location: "Remote", startDate: "2021-04", endDate: null },
    { company: "Contoso Ltd", role: "Software Engineer", location: "Springfield, USA", startDate: "2018-06", endDate: "2021-03" },
  ],
  educations: [
    {
      university: "State University",
      degree: "B.Sc. Computer Science",
      field: "Distributed Systems",
      location: "Springfield",
      startDate: "2014-09",
      endDate: "2018-05",
    },
  ],
};

const SAMPLE_BULLETS = [
  "Led the redesign of a high-traffic **API platform**, cutting p95 latency by 40% while handling 3x more requests.",
  "Introduced **automated testing** and **CI/CD** checks that reduced production incidents by a third.",
  "Mentored four engineers and ran weekly design reviews across two product teams.",
];

/** Example AI sections for previews (the real ones are written per job description). */
export const SAMPLE_EXTRAS: ResumeExtras = {
  summary:
    "Software engineer with 7+ years of experience building **backend services**, **cloud infrastructure** and data pipelines. Known for improving reliability and performance of high-traffic systems, and for mentoring engineers through design reviews and pairing.",
  skills: [
    { category: "Languages & Frameworks", items: ["TypeScript", "Python", "Node.js", "React"] },
    { category: "Cloud & DevOps", items: ["AWS", "Docker", "Terraform", "GitHub Actions"] },
    { category: "Data & Storage", items: ["PostgreSQL", "Redis", "Kafka"] },
    { category: "Practices", items: ["System design", "Code review", "Observability"] },
  ],
  additional: ["Open to hybrid or fully remote roles; available to start within four weeks."],
};

/** Preview data: the user's real profile (or the sample) with placeholder AI content. */
export function previewData(profile: ProfileSnapshot): { snapshot: ProfileSnapshot; bullets: string[][]; extras: ResumeExtras } {
  const snapshot =
    profile.experiences.length > 0
      ? profile
      : { ...SAMPLE_PROFILE, ...(profile.name ? { name: profile.name } : {}) };
  return {
    snapshot,
    bullets: snapshot.experiences.map((_, i) => SAMPLE_BULLETS.slice(0, i === 0 ? 3 : 2)),
    extras: SAMPLE_EXTRAS,
  };
}
