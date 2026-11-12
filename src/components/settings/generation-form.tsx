"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SmallButton, TextArea } from "@/components/ui";
import { MAX_PROMPT_CHARS, SUGGESTED_MODELS } from "@/lib/settings-schema";
import { saveSettingsAction, type ActionResult } from "@/server/settings/actions";

export function StatusLine({ result }: { result: ActionResult | null }) {
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
  /** null → the admin's default model */
  model: string | null;
  defaultModel: string;
  /** The prompt in use (the user's own, or the admin default). */
  prompt: string;
  defaultPrompt: string;
};

/** Model select and prompt editor for the workspace's right column. */
export function GenerationForm({ model, defaultModel, prompt, defaultPrompt }: Props) {
  const [values, setValues] = useState({ model: model ?? "", customPrompt: prompt });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const options = [...new Set<string>([...SUGGESTED_MODELS, ...(model ? [model] : [])])].filter((m) => m !== defaultModel);
  const usingDefault = values.customPrompt.trim() === defaultPrompt.trim();

  const set = (patch: Partial<typeof values>) => {
    setValues((s) => ({ ...s, ...patch }));
    setResult(null);
  };

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        startTransition(async () => setResult(await saveSettingsAction(values)));
      }}
    >
      <div>
        <label htmlFor="ws-model" className="mb-1 block text-sm font-medium">
          Model
        </label>
        <select
          id="ws-model"
          value={values.model}
          onChange={(e) => set({ model: e.target.value })}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#0a0e1f]"
        >
          <option value="">{defaultModel} (default)</option>
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {fieldErrors.model && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.model}</p>}
      </div>

      <TextArea
        id="ws-prompt"
        label={usingDefault ? "Prompt (default)" : "Prompt (custom)"}
        value={values.customPrompt}
        onChange={(v) => set({ customPrompt: v })}
        error={fieldErrors.customPrompt}
        showCount={MAX_PROMPT_CHARS}
        rows={23}
      />
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </PrimaryButton>
        <SmallButton onClick={() => set({ customPrompt: defaultPrompt })} disabled={usingDefault}>
          Reset to default
        </SmallButton>
        <StatusLine result={result} />
      </div>
    </form>
  );
}
