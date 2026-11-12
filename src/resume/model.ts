import { formatPeriod } from "@/lib/period";

export type ContactKind = "location" | "email" | "phone" | "linkedin" | "github";
export type SkillGroup = { category: string; items: string[] };

/** AI-written sections besides the experience bullets. Text may contain **bold** markers. */
export type ResumeExtras = {
  summary: string;
  skills: SkillGroup[];
  additional: string[];
};

/** Everything a theme needs. Optional values are absent (never "" or null) so themes can just check truthiness. */
export type ResumeModel = {
  name: string;
  headline?: string;
  contact: { kind: ContactKind; label: string; href?: string }[];
  summary?: string;
  experiences: { company: string; role: string; location?: string; period: string; bullets: string[] }[];
  educations: { university: string; degree?: string; field?: string; location?: string; period: string }[];
  skills: SkillGroup[];
  languages: { name: string; level?: string }[];
  additional: string[];
};

/**
 * The profile as stored with each generation. Fields added after the first
 * release are optional because older snapshots don't have them.
 */
export type ProfileSnapshot = {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  headline?: string | null;
  location?: string | null;
  skills?: string | null;
  languages?: string | null;
  experiences: { company: string; role: string; location?: string | null; startDate: string; endDate: string | null }[];
  educations: {
    university: string;
    degree: string | null;
    field?: string | null;
    location: string | null;
    startDate: string;
    endDate: string | null;
  }[];
};

/** "https://www.linkedin.com/in/jane/" → "linkedin.com/in/jane" */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** "English — Fluent", "German: B2", "French (basic)" or just "Spanish"; one per line. */
export function parseLanguages(text: string | null | undefined): ResumeModel["languages"] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const m = /^(.+?)\s*(?:\s[—–-]\s|:|\()\s*(.+?)\)?$/.exec(line);
      return m ? { name: m[1]!.trim(), level: m[2]!.trim() } : { name: line };
    });
}

const opt = <K extends string>(key: K, value: string | null | undefined) =>
  (value?.trim() ? { [key]: value.trim() } : {}) as Partial<Record<K, string>>;

/**
 * Builds the theme model. `bulletsByIndex[i]` belongs to snapshot.experiences[i]
 * (content keys are generated in profile order; see contentKeys()).
 */
export function buildResumeModel(
  snapshot: ProfileSnapshot,
  bulletsByIndex: string[][],
  fallbackName: string,
  extras?: ResumeExtras | null,
): ResumeModel {
  const contact: ResumeModel["contact"] = [];
  if (snapshot.location?.trim()) contact.push({ kind: "location", label: snapshot.location.trim() });
  if (snapshot.email) contact.push({ kind: "email", label: snapshot.email, href: `mailto:${snapshot.email}` });
  if (snapshot.phone) contact.push({ kind: "phone", label: snapshot.phone, href: `tel:${snapshot.phone.replace(/[^\d+]/g, "")}` });
  if (snapshot.linkedin) contact.push({ kind: "linkedin", label: displayUrl(snapshot.linkedin), href: snapshot.linkedin });
  if (snapshot.github) contact.push({ kind: "github", label: displayUrl(snapshot.github), href: snapshot.github });

  return {
    name: snapshot.name?.trim() || fallbackName,
    ...opt("headline", snapshot.headline),
    contact,
    ...opt("summary", extras?.summary),
    experiences: snapshot.experiences.map((e, i) => ({
      company: e.company,
      role: e.role,
      ...opt("location", e.location),
      period: formatPeriod(e.startDate, e.endDate),
      bullets: bulletsByIndex[i] ?? [],
    })),
    educations: snapshot.educations.map((e) => ({
      university: e.university,
      ...opt("degree", e.degree),
      ...opt("field", e.field),
      ...opt("location", e.location),
      period: formatPeriod(e.startDate, e.endDate),
    })),
    skills: (extras?.skills ?? []).filter((g) => g.category && g.items.length > 0),
    languages: parseLanguages(snapshot.languages),
    additional: extras?.additional ?? [],
  };
}
