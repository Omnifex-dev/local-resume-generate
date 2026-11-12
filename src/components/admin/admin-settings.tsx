"use client";

import { useState, useTransition } from "react";
import { Card, Field, PrimaryButton, SmallButton, TextArea } from "@/components/ui";
import { MAX_PROMPT_CHARS, SUGGESTED_MODELS } from "@/lib/settings-schema";
import { removeSharedKeyAction, saveDefaultsAction, saveSharedKeyAction, type AdminResult } from "@/server/admin/actions";

function Status({ result }: { result: AdminResult | null }) {
  if (!result) return null;
  const text = result.ok ? (result.warning ?? "Saved.") : result.error;
  const tone = result.ok ? (result.warning ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400") : "text-red-600 dark:text-red-400";
  return (
    <p role="status" className={`text-sm ${tone}`}>
      {text}
    </p>
  );
}

type Props = {
  hasApiKey: boolean;
  apiKeyHint: string | null;
  defaultModel: string;
  envModel: string;
  defaultPrompt: string;
  builtInPrompt: string;
};

export function AdminSettingsForms({ hasApiKey, apiKeyHint, defaultModel, envModel, defaultPrompt, builtInPrompt }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [keyResult, setKeyResult] = useState<AdminResult | null>(null);
  const [keyPending, startKey] = useTransition();

  const [defaults, setDefaults] = useState({ defaultModel, defaultPrompt });
  const [defaultsResult, setDefaultsResult] = useState<AdminResult | null>(null);
  const [defaultsPending, startDefaults] = useTransition();
  const errors = defaultsResult && !defaultsResult.ok ? (defaultsResult.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-6">
      <Card
        title="OpenAI API key"
        description="Used for every user's resumes and profile imports. It is checked with OpenAI, encrypted before it is stored and never shown again. Usage is billed to this key's account."
        footer={
          <>
            <PrimaryButton type="submit" form="admin-key-form" disabled={keyPending || apiKey.trim() === ""}>
              {keyPending ? "Checking…" : "Save key"}
            </PrimaryButton>
            {hasApiKey && (
              <SmallButton
                disabled={keyPending}
                onClick={() => {
                  if (!window.confirm("Remove the OpenAI key? Nobody will be able to generate resumes until a new one is saved.")) return;
                  startKey(async () => setKeyResult(await removeSharedKeyAction()));
                }}
              >
                Remove key
              </SmallButton>
            )}
            <Status result={keyResult} />
          </>
        }
      >
        <form
          id="admin-key-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setKeyResult(null);
            startKey(async () => {
              const r = await saveSharedKeyAction(apiKey);
              setKeyResult(r);
              if (r.ok) setApiKey("");
            });
          }}
        >
          <p className="text-sm">
            {hasApiKey ? (
              <>
                Saved key: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-white/[0.06]">sk-…{apiKeyHint}</code>
              </>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-400">No key yet: users can&apos;t generate resumes.</span>
            )}
          </p>
          <Field
            id="api-key"
            label={hasApiKey ? "Replace key" : "API key"}
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
            hint="Create one at platform.openai.com/api-keys"
          />
        </form>
      </Card>

      <Card
        title="Defaults"
        description="Users who haven't chosen their own model or written their own prompt use these. Changes reach them right away."
        footer={
          <>
            <PrimaryButton type="submit" form="admin-defaults-form" disabled={defaultsPending}>
              {defaultsPending ? "Saving…" : "Save defaults"}
            </PrimaryButton>
            <SmallButton onClick={() => setDefaults((s) => ({ ...s, defaultPrompt: builtInPrompt }))}>Restore built-in prompt</SmallButton>
            <Status result={defaultsResult} />
          </>
        }
      >
        <form
          id="admin-defaults-form"
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setDefaultsResult(null);
            startDefaults(async () => setDefaultsResult(await saveDefaultsAction(defaults)));
          }}
        >
          <Field
            id="default-model"
            label="Default model"
            value={defaults.defaultModel}
            onChange={(v) => setDefaults((s) => ({ ...s, defaultModel: v }))}
            error={errors.defaultModel}
            placeholder={envModel}
            list="admin-model-suggestions"
            maxLength={100}
            spellCheck={false}
            hint={`Leave empty for ${envModel} (OPENAI_DEFAULT_MODEL). The model must support structured outputs.`}
          />
          <datalist id="admin-model-suggestions">
            {SUGGESTED_MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <TextArea
            id="default-prompt"
            label="Default prompt"
            value={defaults.defaultPrompt}
            onChange={(v) => setDefaults((s) => ({ ...s, defaultPrompt: v }))}
            error={errors.defaultPrompt}
            showCount={MAX_PROMPT_CHARS}
            rows={18}
          />
        </form>
      </Card>
    </div>
  );
}
