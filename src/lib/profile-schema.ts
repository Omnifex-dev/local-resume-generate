import { z } from "zod";
import { MONTH_PATTERN } from "./period";

export const MAX_EXPERIENCES = 20;
export const MAX_EDUCATIONS = 10;
export const MAX_SKILLS_CHARS = 3000;
export const MAX_LANGUAGES_CHARS = 500;

/** Trimmed text where "" becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform((v) => (v === "" ? null : v));

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be at most ${max} characters`);

const month = z.string().trim().regex(MONTH_PATTERN, "Use the format YYYY-MM");
const optionalMonth = z
  .string()
  .trim()
  .refine((v) => v === "" || MONTH_PATTERN.test(v), "Use the format YYYY-MM, or leave empty for Present")
  .transform((v) => (v === "" ? null : v));

/**
 * Accepts "linkedin.com/in/jane" or a full URL. Adds https:// when the scheme is missing
 * and only allows http(s), so no javascript:/data: links can reach a generated PDF.
 */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return withScheme;
}

const optionalUrl = z
  .string()
  .trim()
  .max(300, "Must be at most 300 characters")
  .transform((v, ctx) => {
    if (v === "") return null;
    const url = normalizeUrl(v);
    if (!url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid web address" });
      return z.NEVER;
    }
    return url;
  });

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
  .transform((v) => (v === "" ? null : v.toLowerCase()));

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[+()\d\s.-]{5,40}$/.test(v), "Use digits, spaces and + ( ) - . only")
  .transform((v) => (v === "" ? null : v));

const endAfterStart = (p: { startDate: string; endDate: string | null }) => !p.endDate || p.endDate >= p.startDate;

export const experienceSchema = z
  .object({
    company: requiredText("Company name", 200),
    role: requiredText("Role", 200),
    location: optionalText(200).default(""),
    startDate: month,
    endDate: optionalMonth,
  })
  .refine(endAfterStart, { message: "End must not be before start", path: ["endDate"] });

export const educationSchema = z
  .object({
    university: requiredText("University", 200),
    degree: optionalText(200),
    field: optionalText(200).default(""),
    location: optionalText(200),
    startDate: month,
    endDate: optionalMonth,
  })
  .refine(endAfterStart, { message: "End must not be before start", path: ["endDate"] });

export const profileSchema = z.object({
  name: optionalText(100),
  email: optionalEmail,
  phone: optionalPhone,
  linkedin: optionalUrl,
  github: optionalUrl,
  headline: optionalText(120).default(""),
  location: optionalText(200).default(""),
  skills: optionalText(MAX_SKILLS_CHARS).default(""),
  languages: optionalText(MAX_LANGUAGES_CHARS).default(""),
  experiences: z.array(experienceSchema).max(MAX_EXPERIENCES, `At most ${MAX_EXPERIENCES} companies`),
  educations: z.array(educationSchema).max(MAX_EDUCATIONS, `At most ${MAX_EDUCATIONS} education entries`),
});

/** What the form sends (all strings). */
export type ProfileFormValues = z.input<typeof profileSchema>;
export type ExperienceFormValues = ProfileFormValues["experiences"][number];
export type EducationFormValues = ProfileFormValues["educations"][number];
/** Validated, normalised data (empty strings → null). */
export type ProfileData = z.output<typeof profileSchema>;

/** Flattens zod issues to { "experiences.0.company": "Company name is required" }. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Saved profile → form values (null → ""). The name defaults to the username until changed. */
export function toProfileFormValues(profile: ProfileData & { exists?: boolean }, username: string): ProfileFormValues {
  const s = (v: string | null | undefined) => v ?? "";
  return {
    name: profile.exists === false ? username : s(profile.name),
    email: s(profile.email),
    phone: s(profile.phone),
    linkedin: s(profile.linkedin),
    github: s(profile.github),
    headline: s(profile.headline),
    location: s(profile.location),
    skills: s(profile.skills),
    languages: s(profile.languages),
    experiences: profile.experiences.map((e) => ({ ...e, location: s(e.location), endDate: s(e.endDate) })),
    educations: profile.educations.map((e) => ({ ...e, degree: s(e.degree), field: s(e.field), location: s(e.location), endDate: s(e.endDate) })),
  };
}
