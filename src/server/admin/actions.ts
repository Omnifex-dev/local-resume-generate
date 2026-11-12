"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toFieldErrors } from "@/lib/profile-schema";
import { adminDefaultsSchema, apiKeySchema } from "@/lib/settings-schema";
import { verifyApiKey } from "../ai/openai";
import { hashPassword } from "../auth/password";
import { deleteAllSessions, requireAdmin } from "../auth/session";
import { passwordSchema, usernameSchema } from "../auth/validation";
import { EncryptionNotConfiguredError } from "../crypto";
import { db, isUniqueViolation } from "../db/client";
import { users } from "../db/schema";
import { env } from "../env";
import { logger } from "../logger";
import { removeSharedApiKey, saveDefaults, saveSharedApiKey } from "./app-settings";
import { otherActiveAdmins } from "./users";

export type AdminResult = { ok: true; warning?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fixFields = (error: z.ZodError): AdminResult => ({
  ok: false,
  error: "Please fix the highlighted fields.",
  fieldErrors: toFieldErrors(error),
});

// --- OpenAI key and defaults -------------------------------------------------

export async function saveSharedKeyAction(rawKey: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = apiKeySchema.safeParse(rawKey);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid key" };

  const check = await verifyApiKey(parsed.data, { baseUrl: env.OPENAI_BASE_URL });
  if (check === "invalid") return { ok: false, error: "OpenAI rejected this key. Copy it again from platform.openai.com/api-keys." };

  try {
    await saveSharedApiKey(parsed.data);
  } catch (err) {
    if (err instanceof EncryptionNotConfiguredError) return { ok: false, error: err.message };
    logger.error({ err }, "saving shared api key failed");
    return { ok: false, error: "Could not save the key. Please try again." };
  }
  logger.info({ adminId: admin.id, verified: check === "valid" }, "shared api key saved");
  revalidatePath("/admin", "layout");
  return check === "valid" ? { ok: true } : { ok: true, warning: "Saved, but OpenAI couldn't be reached to verify the key right now." };
}

export async function removeSharedKeyAction(): Promise<AdminResult> {
  const admin = await requireAdmin();
  await removeSharedApiKey();
  logger.info({ adminId: admin.id }, "shared api key removed");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function saveDefaultsAction(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = adminDefaultsSchema.safeParse(input);
  if (!parsed.success) return fixFields(parsed.error);
  try {
    await saveDefaults(parsed.data);
  } catch (err) {
    logger.error({ err }, "saving defaults failed");
    return { ok: false, error: "Could not save. Please try again." };
  }
  logger.info({ adminId: admin.id }, "default model/prompt saved");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// --- Users -----------------------------------------------------------------

const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["user", "admin"]),
});

export async function createUserAction(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return fixFields(parsed.error);
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await db.insert(users).values({ username: parsed.data.username, passwordHash, role: parsed.data.role });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { username: "That username is already taken" } };
    logger.error({ err }, "creating user failed");
    return { ok: false, error: "Could not create the user." };
  }
  logger.info({ adminId: admin.id, username: parsed.data.username, role: parsed.data.role }, "user created by admin");
  revalidatePath("/admin/users");
  return { ok: true };
}

const idSchema = z.string().uuid();

export async function setUserActiveAction(userId: unknown, active: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success || typeof active !== "boolean") return { ok: false, error: "Invalid request." };
  if (id.data === admin.id) return { ok: false, error: "You can't disable your own account." };

  await db.update(users).set({ active }).where(eq(users.id, id.data));
  if (!active) await deleteAllSessions(id.data);
  logger.info({ adminId: admin.id, userId: id.data, active }, "user active state changed");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetPasswordAction(userId: unknown, password: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message ?? "Invalid password." };

  await db.update(users).set({ passwordHash: await hashPassword(pw.data) }).where(eq(users.id, id.data));
  if (id.data !== admin.id) await deleteAllSessions(id.data);
  logger.info({ adminId: admin.id, userId: id.data }, "password reset by admin");
  return { ok: true };
}

export async function deleteUserAction(userId: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  if (id.data === admin.id) return { ok: false, error: "You can't delete your own account." };

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id.data)).limit(1);
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "admin" && (await otherActiveAdmins(id.data)) === 0) {
    return { ok: false, error: "At least one active admin must remain." };
  }
  // Profile, settings, sessions and generations are removed by ON DELETE CASCADE.
  await db.delete(users).where(eq(users.id, id.data));
  logger.info({ adminId: admin.id, userId: id.data }, "user deleted by admin");
  revalidatePath("/admin/users");
  return { ok: true };
}
