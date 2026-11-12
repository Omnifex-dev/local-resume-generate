import { z } from "zod";

const lower = (s: string) => s.toLowerCase();

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Use only letters, numbers, dot, dash or underscore")
  .transform(lower);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email must be at most 254 characters")
  .email("Enter a valid email address")
  .transform(lower);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** Login is deliberately lenient on format: we only need to look the user up. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email").max(254).transform(lower),
  password: z.string().min(1, "Password is required").max(128),
});

/** The 6-digit code from the sign-up email; spaces and dashes are ignored. */
export const codeSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email"));

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
