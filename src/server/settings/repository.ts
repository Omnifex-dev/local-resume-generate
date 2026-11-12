import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_PAGE_SIZE, DEFAULT_THEME, isPageSize, isThemeId, type PageSize, type ThemeId } from "@/lib/themes";
import { getAppSettings } from "../admin/app-settings";
import { db } from "../db/client";
import { userSettings } from "../db/schema";

export type PublicSettings = {
  /** The admin has saved the shared OpenAI key. */
  hasApiKey: boolean;
  /** null → the admin's default model */
  model: string | null;
  defaultModel: string;
  effectiveModel: string;
  /** null → the admin's default prompt */
  customPrompt: string | null;
  defaultPrompt: string;
  effectivePrompt: string;
  themeId: ThemeId;
  pageSize: PageSize;
};

/** Safe to send to the browser. The OpenAI key is shared and managed by the admin. */
export async function getSettings(userId: string): Promise<PublicSettings> {
  const [[r], app] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
    getAppSettings(),
  ]);
  return {
    hasApiKey: app.hasApiKey,
    model: r?.openaiModel ?? null,
    defaultModel: app.effectiveModel,
    effectiveModel: r?.openaiModel ?? app.effectiveModel,
    customPrompt: r?.customPrompt ?? null,
    defaultPrompt: app.effectivePrompt,
    effectivePrompt: r?.customPrompt ?? app.effectivePrompt,
    themeId: isThemeId(r?.themeId) ? r.themeId : DEFAULT_THEME,
    pageSize: isPageSize(r?.pageSize) ? r.pageSize : DEFAULT_PAGE_SIZE,
  };
}

async function upsert(userId: string, values: Partial<typeof userSettings.$inferInsert>) {
  await db
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...values, updatedAt: new Date() } });
}

export const saveModelAndPrompt = (userId: string, s: { model: string | null; customPrompt: string | null }) =>
  upsert(userId, { openaiModel: s.model, customPrompt: s.customPrompt });

export const savePageSize = (userId: string, pageSize: PageSize) => upsert(userId, { pageSize });

export const saveTheme = (userId: string, themeId: ThemeId) => upsert(userId, { themeId });
