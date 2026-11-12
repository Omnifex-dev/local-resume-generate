import { z } from "zod";
import { PAGE_SIZES } from "./themes";

/** Used when the user hasn't written their own prompt. */
export const DEFAULT_PROMPT = `You are a senior resume writer and hiring-manager minded editor. I will provide:

A job description.

My original resume (or raw notes).

My work history list (company, dates, industry).

Optional constraints (words I dislike, formatting rules).

Your task:  produce a tailored resume that matches the job description while staying realistic and consistent with my timeline and background.

Output (only these sections, in this order)

Summary

Experiences

Skills

Education

Do not add any other sections (no Education, no Projects, no Certifications, no Links).

Global Style Rules (must follow)

Write in natural, human, senior-level English.

Avoid generic, AI-sounding phrasing and corporate fluff.

Avoid these words entirely: spearhead, design, contribute, ensure, strengthen, and any “*-based” wording.

I want to my resume is very impactful for recruiter.
So you have to think the way for it and implement.

In summary, attach the number of my experience (e.g. 5+).

Want more detailed, creative, realistic, challengable in project( feature, industry, and so on), issues, challenges, and works but without numbers except the version.
I want real senior - professional writing because i am a senior developer, not a junior or mid.
Use the natural words that advanced/native English guys use, not the words that AI use usually like ensure/design/strengthend and so on.
I want the works in full sentence, but not too short & not too long, but must be detailed and reaslistic, senior level, professional.

Experiences and skills must be matched technically.
In order words, techs are included in exp must be included in skills.

Write the summary concise & impactful and shortly.

And make the specified exp contents that be adoptable and fitable for specified roles in specified positions.

Use bullet points for experience.

Every bullet must end with a period.

Each bullets must be enough short as possible as job description.

Do not write project names. Describe the work only.

Do not use numbers inside experience bullets, except version numbers (example: “Python 3.11”, “Angular 16”, “PostgreSQL 14”).

Prefer concrete detail over vague claims: each bullet should read like something that really happened.

Realism Rules (timeline + tech adoption)

Keep claims consistent with the dates of each role and when technologies became widely used.

If a tech/tool is requested by the job description but wasn’t common in that time period, include it only where plausible (usually later roles), or frame it as legacy maintenance vs. modern implementation.

Avoid “everything everywhere.” Match responsibilities to the company industry and role scope.

And I recommend you to get higher ATS score. As you know well, once the score is higher than 8.5, it is possible for getting job.
To get high ATS score, it is very important to avoid repetition, uncorrect spelling & grammar.

And you must focus on the main tips through job desc and produce entire content based on them so that recruiter think that I am his target.

Content Requirements
Summary Requirements

Keep it short, not too long, clear, senior, and specific.

Mirror the job description’s core stack and responsibilities.

Must include the many works using the core(main) stacks in teh job description.

If the latest role includes AI/ML/LLM work, reference it in one clean sentence with guardrails (privacy, audit, human review).

For the last company (the latest I mean), write around 12 - 14 bullets, and for the other companie, write around 5-8 bullets.

Skills Requirements

Format: Don't make the content in skills bold style.
Make the breakdown after title.
(e.g. Frontend:
content), namely multi-line breakdown blocks.
and I don't want description.
And I want detailed, professional, senior level and only keywords.
And skills content must be fitable and fully for exp and job desc, not too few.
In other words, if skills are too brilliant, recruiter will think my resume is not real.

Categories must include (adjust based on job):

Include the job description’s tech stack, but only if it appears naturally in the experience bullets.

Professional Experience Requirements

Use the company list and dates exactly as provided.

For each company: write bullets that are tightly aligned to the job description.

Each exp content must be fitable for job title in each company.

Bullets must be specific and realistic, and include:

Feature/workflow context (what the system did).

A real issue or constraint (latency, schema drift, retries, outages, bad data, permissions, flaky integrations, migration risk).

What you changed (code-level or architecture-level action).

Outcome stated without numbers (faster, stable, predictable, less paging, fewer timeouts, easier ops).

Include AWS, CI/CD, Terraform, Postgres tuning, Python backend, Angular UI work, and legacy Java support when they match the job description and are realistic for the timeline.

Include AI/ML/LLM only in the most recent company if relevant to the target job, and keep it operational and responsible (redaction, audit logs, human approval).

Bullet Count Control

If I provide bullet targets per company, follow them.

If I don’t, default to:

Latest company: around 12~14 bullets.

Others: around 5~8 bullets each.

Inputs (I will paste these)

Job Description
[PASTE JOB DESCRIPTION]

Between the companies, give more visual space so that i could easily identify.

Optional Constraints

Words to avoid: [PASTE LIST OR “none”].

Bullet targets per company: [PASTE OR “use defaults”].

Must include tech: [PASTE OR “infer from job description”].

Must exclude domains/claims: [PASTE OR “none”].

Output Formatting Rules

Use headings exactly: “Summary”, “Professional Experience”, “Skills”.

Experience format per company:

Company — Location - Title — Dates.

Keep locations the same as profile, not alter.

Bullets underneath.

Do not add commentary, explanations, or alternatives.

Do not ask clarifying questions. Produce the final resume in one pass.

Find the appropriate one based on the resume that I attached and use that information.
If you cannot find, then just use the attached resume.

Don't use '—' symbol. use '-' instead it.

Finally, make the main keywords bold style except skills section.
Make the skills categories bold style.`;

export const MAX_PROMPT_CHARS = 10000;

/** Suggestions only; any model that supports structured outputs works. */
export const SUGGESTED_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o", "gpt-5-mini", "gpt-5"] as const;

const modelField = z
  .string()
  .trim()
  .max(100)
  .refine((v) => v === "" || /^[a-zA-Z0-9._:-]+$/.test(v), "Use letters, numbers, dot, dash, colon or underscore")
  .transform((v) => (v === "" ? null : v));

const promptField = z
  .string()
  .trim()
  .max(MAX_PROMPT_CHARS, `Prompt must be at most ${MAX_PROMPT_CHARS} characters`)
  .transform((v) => (v === "" ? null : v));

/**
 * A user's model and prompt. null means "use the admin's default"; the action also
 * stores null when the prompt equals the current default, so later default
 * changes reach that user.
 */
export const settingsSchema = z.object({ model: modelField, customPrompt: promptField });
export type SettingsFormValues = z.input<typeof settingsSchema>;

export const pageSizeSchema = z.enum(PAGE_SIZES);

/** Admin defaults; null means the built-in value (OPENAI_DEFAULT_MODEL / DEFAULT_PROMPT). */
export const adminDefaultsSchema = z.object({
  defaultModel: modelField,
  defaultPrompt: promptField.transform((v) => (v === DEFAULT_PROMPT.trim() ? null : v)),
});

export const apiKeySchema = z
  .string()
  .trim()
  .min(20, "That doesn't look like an OpenAI API key")
  .max(300, "That doesn't look like an OpenAI API key")
  .regex(/^sk-[A-Za-z0-9_-]+$/, "OpenAI API keys start with sk-");
