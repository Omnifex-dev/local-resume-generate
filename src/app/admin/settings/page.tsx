import { AdminSettingsForms } from "@/components/admin/admin-settings";
import { DEFAULT_PROMPT } from "@/lib/settings-schema";
import { getAppSettings } from "@/server/admin/app-settings";
import { requireAdmin } from "@/server/auth/session";
import { env } from "@/server/env";

export const metadata = { title: "OpenAI & prompt · Admin · Resume Generate" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const s = await getAppSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">OpenAI &amp; prompt</h1>
        <p className="text-slate-600 dark:text-slate-400">One OpenAI key for everyone, and the defaults users start from.</p>
      </div>
      {!env.ENCRYPTION_KEY && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          The server has no ENCRYPTION_KEY yet, so the API key can&apos;t be saved. Add one to .env (openssl rand -base64 32) and restart.
        </p>
      )}
      <AdminSettingsForms
        hasApiKey={s.hasApiKey}
        apiKeyHint={s.apiKeyHint}
        defaultModel={s.defaultModel ?? ""}
        envModel={env.OPENAI_DEFAULT_MODEL}
        defaultPrompt={s.effectivePrompt}
        builtInPrompt={DEFAULT_PROMPT}
      />
    </div>
  );
}
