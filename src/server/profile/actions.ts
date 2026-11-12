"use server";

import { revalidatePath } from "next/cache";
import { profileSchema, toFieldErrors } from "@/lib/profile-schema";
import { requireUser } from "../auth/session";
import { logger } from "../logger";
import { saveProfile } from "./repository";

export type SaveProfileResult = { ok: true } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    await saveProfile(user.id, parsed.data);
  } catch (err) {
    logger.error({ err, userId: user.id }, "profile save failed");
    return { ok: false, error: "Could not save your profile. Please try again." };
  }

  logger.info({ userId: user.id }, "profile saved");
  revalidatePath("/profile");
  return { ok: true };
}
