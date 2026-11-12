import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres:// URL"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** base64 of 32 random bytes; encrypts users' OpenAI keys. Optional until a key is saved. */
  ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine((v) => !v || Buffer.from(v, "base64").length === 32, {
      message: "must be 32 bytes, base64-encoded (generate with: openssl rand -base64 32)",
    }),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_DEFAULT_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  /** Optional; otherwise common Chrome/Chromium paths are tried. */
  CHROME_PATH: z.string().optional(),
  /** Needed when Chrome runs as root (e.g. Docker). */
  CHROME_NO_SANDBOX: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  /** Outgoing mail for sign-up codes. SMTP_HOST unset → codes are only logged (development). */
  SMTP_HOST: z.string().trim().optional().transform((v) => v || undefined),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** "true": TLS from the start (port 465). Otherwise STARTTLS is required before logging in. */
  SMTP_SECURE: z.enum(["true", "false", ""]).optional().transform((v) => (v ? v === "true" : undefined)),
  SMTP_USER: z.string().optional().transform((v) => v || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  /** e.g. "Resume Generate <no-reply@example.com>". Defaults to SMTP_USER. */
  SMTP_FROM: z.string().trim().optional().transform((v) => v || undefined),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of obscure runtime errors later.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
