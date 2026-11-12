import { z } from "zod";

/**
 * What the Edit dialog of a history record may change: the job title/company
 * and the AI-written text. Bullets are keyed like the record's `content`
 * (company keys can't be added or removed, only their bullets changed).
 */
export const resumeEditSchema = z.object({
  role: z.string().trim().min(1, "Role is required.").max(200),
  company: z.string().trim().min(1, "Company is required.").max(200),
  content: z.record(z.string().max(300), z.array(z.string().max(400, "A bullet can be at most 400 characters.")).max(16, "At most 16 bullets per company.")),
  extras: z.object({
    summary: z.string().max(1500, "The summary can be at most 1,500 characters."),
    skills: z
      .array(
        z.object({
          category: z.string().max(60, "A skill category can be at most 60 characters."),
          items: z.array(z.string().max(60, "A skill can be at most 60 characters.")).max(15, "At most 15 skills per category."),
        }),
      )
      .max(8, "At most 8 skill categories."),
    additional: z.array(z.string().max(400)).max(10, "At most 10 additional-information lines."),
  }),
});

export type ResumeEdit = z.infer<typeof resumeEditSchema>;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const lines = (list: string[]) => list.map(tidy).filter(Boolean);

/** Trims whitespace and drops empty bullets, skills and categories. */
export function normalizeEdit(e: ResumeEdit): ResumeEdit {
  return {
    role: tidy(e.role),
    company: tidy(e.company),
    content: Object.fromEntries(Object.entries(e.content).map(([k, v]) => [k, lines(v)])),
    extras: {
      summary: tidy(e.extras.summary),
      skills: e.extras.skills
        .map((g) => ({ category: tidy(g.category), items: lines(g.items) }))
        .filter((g) => g.category && g.items.length > 0),
      additional: lines(e.extras.additional),
    },
  };
}
