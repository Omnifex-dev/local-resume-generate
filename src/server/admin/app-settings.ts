import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_PROMPT } from "@/lib/settings-schema";
import { decryptSecret, encryptSecret } from "../crypto";
import { db } from "../db/client";
import { appSettings } from "../db/schema";
import { env } from "../env";

const ROW_ID = 1;
/** Bound into the ciphertext so the key can't be moved to another column or row. */
const KEY_CONTEXT = "app-settings:openai-key";

export type PublicAppSettings = {
  hasApiKey: boolean;
  apiKeyHint: string | null;
  /** null → OPENAI_DEFAULT_MODEL */
  defaultModel: string | null;
  effectiveModel: string;
  /** null → DEFAULT_PROMPT */
  defaultPrompt: string | null;
  effectivePrompt: string;
};

async function row() {
  const [r] = await db.select().from(appSettings).where(eq(appSettings.id, ROW_ID)).limit(1);
  return r;
}

async function upsert(values: Partial<typeof appSettings.$inferInsert>) {
  await db
    .insert(appSettings)
    .values({ id: ROW_ID, ...values })
    .onConflictDoUpdate({ target: appSettings.id, set: { ...values, updatedAt: new Date() } });
}

/** Safe to send to the browser: never includes the key itself. */
export async function getAppSettings(): Promise<PublicAppSettings> {
  const r = await row();
  return {
    hasApiKey: Boolean(r?.openaiKeyEnc),
    apiKeyHint: r?.openaiKeyHint ?? null,
    defaultModel: r?.defaultModel ?? null,
    effectiveModel: r?.defaultModel ?? env.OPENAI_DEFAULT_MODEL,
    defaultPrompt: r?.defaultPrompt ?? null,
    effectivePrompt: r?.defaultPrompt ?? DEFAULT_PROMPT,
  };
}

/** The shared key can't be decrypted (ENCRYPTION_KEY changed or is missing). */
export class SharedKeyUnreadableError extends Error {
  constructor() {
    super("The shared OpenAI key can't be read (the server's encryption key changed). Ask the admin to enter it again.");
  }
}

/** Server-only: the decrypted shared key, or null when none is saved. */
export async function getSharedApiKey(): Promise<string | null> {
  const r = await row();
  if (!r?.openaiKeyEnc) return null;
  try {
    return decryptSecret(r.openaiKeyEnc, KEY_CONTEXT);
  } catch {
    throw new SharedKeyUnreadableError();
  }
}

export async function saveSharedApiKey(apiKey: string): Promise<void> {
  await upsert({ openaiKeyEnc: encryptSecret(apiKey, KEY_CONTEXT), openaiKeyHint: apiKey.slice(-4) });
}

export async function removeSharedApiKey(): Promise<void> {
  await upsert({ openaiKeyEnc: null, openaiKeyHint: null });
}

export async function saveDefaults(values: { defaultModel: string | null; defaultPrompt: string | null }): Promise<void> {
  await upsert(values);
}
