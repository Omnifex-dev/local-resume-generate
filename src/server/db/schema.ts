import type { ResumeExtras } from "../../resume/model";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stored lower-cased; uniqueness is therefore case-insensitive. */
  username: varchar("username", { length: 32 }).notNull().unique(),
  /** Stored lower-cased and unique. Verified with an emailed code at sign-up; null for older accounts. */
  email: varchar("email", { length: 254 }).unique(),
  passwordHash: text("password_hash").notNull(),
  /** "admin" users get the admin site instead of the resume workspace. */
  role: varchar("role", { length: 10 }).$type<UserRole>().notNull().default("user"),
  /** Disabled users can't log in; their sessions are deleted when they are disabled. */
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export type UserRole = "user" | "admin";

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token. The raw token only ever lives in the user's cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;

/**
 * A sign-up waiting for its emailed code. The account is only created once the
 * code is entered. The browser holds the row id in an httpOnly cookie.
 */
export const pendingSignups = pgTable(
  "pending_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 32 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    /** SHA-256 of "id:code"; the code itself is never stored. */
    codeHash: text("code_hash").notNull(),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }).notNull(),
    /** Wrong codes entered for the current code. */
    attempts: integer("attempts").notNull().default(0),
    /** Emails sent for this sign-up (first one included). */
    sends: integer("sends").notNull().default(1),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pending_signups_email_idx").on(t.email), index("pending_signups_created_idx").on(t.createdAt)],
);

/** One row per user. Every contact field is optional; empty fields are left off the resume. */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** null → the username is used on the resume. */
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 40 }),
  linkedin: varchar("linkedin", { length: 300 }),
  github: varchar("github", { length: 300 }),
  /** Job title shown under the name, e.g. "AI Engineer". */
  headline: varchar("headline", { length: 120 }),
  location: varchar("location", { length: 200 }),
  /** Free text the AI groups and tailors into the resume's skills section. */
  skills: text("skills"),
  /** One language per line, e.g. "English — Fluent". */
  languages: text("languages"),
  ...timestamps,
});

/** Periods are "YYYY-MM"; a null end means "Present". */
export const experiences = pgTable(
  "experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: varchar("company", { length: 200 }).notNull(),
    role: varchar("role", { length: 200 }).notNull(),
    location: varchar("location", { length: 200 }),
    startDate: varchar("start_date", { length: 7 }).notNull(),
    endDate: varchar("end_date", { length: 7 }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("experiences_user_id_idx").on(t.userId, t.sortOrder)],
);

export const educations = pgTable(
  "educations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    university: varchar("university", { length: 200 }).notNull(),
    degree: varchar("degree", { length: 200 }),
    /** Field of study or a short note shown after the degree. */
    field: varchar("field", { length: 200 }),
    location: varchar("location", { length: 200 }),
    startDate: varchar("start_date", { length: 7 }).notNull(),
    endDate: varchar("end_date", { length: 7 }),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("educations_user_id_idx").on(t.userId, t.sortOrder)],
);

/** Per-user generation settings. The OpenAI key is stored encrypted (see server/crypto.ts). */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  openaiKeyEnc: text("openai_key_enc"),
  /** Last 4 characters, shown as "sk-…abcd" so the user can tell which key is saved. */
  openaiKeyHint: varchar("openai_key_hint", { length: 4 }),
  openaiModel: varchar("openai_model", { length: 100 }),
  /** null → DEFAULT_PROMPT */
  customPrompt: text("custom_prompt"),
  /** null → DEFAULT_THEME / DEFAULT_PAGE_SIZE */
  themeId: varchar("theme_id", { length: 32 }),
  pageSize: varchar("page_size", { length: 10 }),
  ...timestamps,
});

/**
 * Settings the admin manages for everyone. Single row (id = 1).
 * The shared OpenAI key is encrypted like user secrets (see server/crypto.ts).
 */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  openaiKeyEnc: text("openai_key_enc"),
  openaiKeyHint: varchar("openai_key_hint", { length: 4 }),
  /** null → OPENAI_DEFAULT_MODEL from .env */
  defaultModel: varchar("default_model", { length: 100 }),
  /** null → DEFAULT_PROMPT in code */
  defaultPrompt: text("default_prompt"),
  ...timestamps,
});

export type GenerationStatus = "pending" | "succeeded" | "failed";

/** Every generation attempt, with the inputs needed to re-render it later. */
export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** pending → the record exists and the AI is working on it (or it is queued). */
    status: varchar("status", { length: 20 }).$type<GenerationStatus>().notNull(),
    role: varchar("role", { length: 200 }),
    company: varchar("company", { length: 200 }),
    jobDescription: text("job_description").notNull(),
    prompt: text("prompt").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    /** { "Company": ["bullet", ...] } in profile order */
    content: jsonb("content").$type<Record<string, string[]>>(),
    /** Summary, skills and additional info (null for generations made before they existed). */
    extras: jsonb("extras").$type<ResumeExtras>(),
    profileSnapshot: jsonb("profile_snapshot"),
    error: text("error"),
    /** "{role}-{company}-{timestamp}.pdf" / ".json", set once the resume content exists. */
    pdfFileName: varchar("pdf_file_name", { length: 255 }),
    jsonFileName: varchar("json_file_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("generations_user_created_idx").on(t.userId, t.createdAt)],
);
