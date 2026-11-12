"use server";

import { eq } from "drizzle-orm";
import { toFieldErrors } from "@/lib/profile-schema";
import { pageSizeSchema, settingsSchema } from "@/lib/settings-schema";
import { isThemeId } from "@/lib/themes";
import { hashPassword, verifyPassword } from "../auth/password";
import { deleteOtherSessions, requireUser } from "../auth/session";
import { changePasswordSchema } from "../auth/validation";
import { getAppSettings } from "../admin/app-settings";
import { db } from "../db/client";
import { users } from "../db/schema";
import { logger } from "../logger";
import { savePageSize, saveModelAndPrompt, saveTheme } from "./repository";

export type ActionResult = { ok: true; warning?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  try {
    // Storing null for "same as the default" lets later default changes reach this user.
    const app = await getAppSettings();
    await saveModelAndPrompt(user.id, {
      model: parsed.data.model === app.effectiveModel ? null : parsed.data.model,
      customPrompt: parsed.data.customPrompt === app.effectivePrompt.trim() ? null : parsed.data.customPrompt,
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, "saving settings failed");
    return { ok: false, error: "Could not save settings. Please try again." };
  }
  return { ok: true };
}

export async function savePageSizeAction(pageSize: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = pageSizeSchema.safeParse(pageSize);
  if (!parsed.success) return { ok: false, error: "Unknown paper size." };
  try {
    await savePageSize(user.id, parsed.data);
  } catch (err) {
    logger.error({ err, userId: user.id }, "saving page size failed");
    return { ok: false, error: "Could not save. Please try again." };
  }
  return { ok: true };
}

export async function saveThemeAction(themeId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!isThemeId(themeId)) return { ok: false, error: "Unknown theme." };
  try {
    await saveTheme(user.id, themeId);
  } catch (err) {
    logger.error({ err, userId: user.id }, "saving theme failed");
    return { ok: false, error: "Could not save the theme." };
  }
  return { ok: true };
}

/** Changes the password and signs out the user's other sessions. */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { currentPassword: "Current password is wrong" } };
  }
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword) }).where(eq(users.id, user.id));
  await deleteOtherSessions(user.id);
  logger.info({ userId: user.id }, "password changed");
  return { ok: true };
}
