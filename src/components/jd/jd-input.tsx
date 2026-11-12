"use client";

import { useRef, useState } from "react";
import { Card, Field, PrimaryButton, SmallButton, Spinner, TextArea } from "@/components/ui";
import { toFieldErrors } from "@/lib/profile-schema";
import {
  ACCEPTED_EXTENSIONS,
  JD_LIMITS,
  JD_SEPARATOR,
  jdBatchSchema,
  singleJdSchema,
  type JobDescription,
  type ParseJdResponse,
} from "@/lib/jd";

type Mode = "single" | "multi";
type Block = { key: number; source: string; index: number; role: string; company: string; description: string; truncated: boolean };

let nextKey = 0;

type Props = {
  /** Called with validated jobs. Resolves to an error message, or null on success. */
  onSubmit: (jobs: JobDescription[]) => Promise<string | null>;
  /** Disables the generate buttons (e.g. no API key yet). */
  disabled?: boolean;
};

export function JdInput({ onSubmit, disabled = false }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (jobs: JobDescription[]) => {
    setSubmitting(true);
    setStatus(null);
    const error = await onSubmit(jobs).catch(() => "Network error. Check your connection and retry.");
    setSubmitting(false);
    if (error) setStatus({ kind: "error", message: error });
  };
  const busy = disabled || submitting;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Job description input mode" className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#0a0e1f]">
        {(
          [
            ["single", "Single job"],
            ["multi", "Multiple (upload files)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setStatus(null);
            }}
            className={`rounded-md px-4 py-1.5 text-sm ${mode === value ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Both stay mounted so switching tabs doesn't lose what was typed. */}
      <div hidden={mode !== "single"}>
        <SingleJdForm onSubmit={submit} onChange={() => setStatus(null)} disabled={busy} submitting={submitting} />
      </div>
      <div hidden={mode !== "multi"}>
        <MultiJdUpload onSubmit={submit} onChange={() => setStatus(null)} disabled={busy} submitting={submitting} />
      </div>

      {status && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${status.kind === "ok" ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}

type ChildProps = { onSubmit: (jobs: JobDescription[]) => void; onChange: () => void; disabled: boolean; submitting: boolean };

function SingleJdForm({ onSubmit, onChange, disabled, submitting }: ChildProps) {
  const [values, setValues] = useState({ role: "", company: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof typeof values) => (v: string) => {
    setValues((s) => ({ ...s, [field]: v }));
    onChange();
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = singleJdSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    onSubmit([parsed.data]);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card
        title="Job description"
        description="Paste one job posting."
        footer={
          <PrimaryButton type="submit" disabled={disabled} className="ml-auto flex items-center gap-2">
            {submitting && <Spinner />}
            {submitting ? "Creating…" : "Generate resume"}
          </PrimaryButton>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="jd-role" label="Role" value={values.role} onChange={set("role")} error={errors.role} placeholder="Senior Backend Engineer" maxLength={200} />
            <Field id="jd-company" label="Company" value={values.company} onChange={set("company")} error={errors.company} placeholder="Acme Inc." maxLength={200} />
          </div>
          <TextArea id="jd-description" label="Job description" value={values.description} onChange={set("description")} error={errors.description} showCount={JD_LIMITS.maxDescriptionChars} rows={14} />
        </div>
      </Card>
    </form>
  );
}

function MultiJdUpload({ onSubmit, onChange, disabled, submitting }: ChildProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fileErrors, setFileErrors] = useState<ParseJdResponse["errors"]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || uploading) return;
    onChange();
    setFileErrors([]);

    const exts = ACCEPTED_EXTENSIONS as readonly string[];
    const accepted = files.filter((f) => exts.includes(/\.[a-z0-9]+$/i.exec(f.name)?.[0]?.toLowerCase() ?? ""));
    const rejected = files.filter((f) => !accepted.includes(f)).map((f) => ({ file: f.name, message: "Only .txt, .doc and .docx files are supported." }));
    if (accepted.length > JD_LIMITS.maxFiles) {
      setFileErrors([...rejected, { file: "(selection)", message: `Upload at most ${JD_LIMITS.maxFiles} files at a time.` }]);
      return;
    }
    if (accepted.length === 0) {
      setFileErrors(rejected);
      return;
    }

    const body = new FormData();
    accepted.forEach((f) => body.append("files", f));
    setUploading(true);
    try {
      const res = await fetch("/api/jd/parse", { method: "POST", body });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json()) as ParseJdResponse & { error?: string };
      if (!res.ok) {
        setFileErrors([...rejected, { file: "(upload)", message: data.error ?? `Upload failed (${res.status}).` }]);
        return;
      }
      // Uploads are sequential (the picker is disabled while uploading), so `blocks` is current.
      const room = Math.max(0, JD_LIMITS.maxBlocks - blocks.length);
      const added = data.blocks.slice(0, room).map((b) => ({ ...b, key: nextKey++ }));
      const overflow =
        data.blocks.length > room
          ? [{ file: "(all files)", message: `Limit is ${JD_LIMITS.maxBlocks} job descriptions; ${data.blocks.length - room} extra block(s) were not added.` }]
          : [];
      setBlocks((current) => [...current, ...added]);
      setFileErrors([...rejected, ...data.errors, ...overflow]);
      setErrors({});
    } catch {
      setFileErrors([...rejected, { file: "(upload)", message: "Network error while uploading. Please try again." }]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const update = (i: number, field: "role" | "company" | "description", value: string) => {
    setBlocks((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
    onChange();
  };

  const remove = (i: number) => {
    setBlocks((rows) => rows.filter((_, j) => j !== i));
    setErrors({}); // index-based keys are stale now
    onChange();
  };

  function handleSubmit() {
    const parsed = jdBatchSchema.safeParse(blocks.map(({ role, company, description }) => ({ role, company, description })));
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <div className="space-y-6">
      <Card
        title="Upload job descriptions"
        description={`Upload .txt, .doc or .docx files (max ${JD_LIMITS.maxFileBytes / 1024 / 1024} MB each, ${JD_LIMITS.maxFiles} files at a time). Put ${JD_SEPARATOR} on its own line between job descriptions.`}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center text-sm ${dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-300 dark:border-white/15"}`}
        >
          <p className="text-slate-600 dark:text-slate-400">{uploading ? "Reading files…" : "Drag files here, or"}</p>
          <input
            ref={inputRef}
            id="jd-files"
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="sr-only"
            onChange={(e) => e.target.files && void upload(e.target.files)}
            disabled={uploading}
          />
          <label htmlFor="jd-files" className={`cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10 ${uploading ? "pointer-events-none opacity-50" : ""}`}>
            Choose files
          </label>
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-400">Example file layout</summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-white/[0.06]">{`role: Senior Backend Engineer
company: Acme
JD: We are looking for...
${JD_SEPARATOR}
role: Frontend Developer
company: Globex
JD: You will build...`}</pre>
        </details>

        {fileErrors.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {fileErrors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.file}:</span> {e.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {errors._form && <p className="text-sm text-red-600">{errors._form}</p>}

      {blocks.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              {blocks.length} job description{blocks.length === 1 ? "" : "s"}
            </h2>
            <SmallButton
              onClick={() => {
                setBlocks([]);
                setErrors({});
                onChange();
              }}
            >
              Clear all
            </SmallButton>
          </div>

          <ol className="space-y-4">
            {blocks.map((b, i) => {
              const err = (f: string) => errors[`${i}.${f}`];
              return (
                <li key={b.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0a0e1f]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium font-semibold">
                      {i + 1}
                    </span>
                    <SmallButton onClick={() => remove(i)} aria-label={`Remove job description ${i + 1}`}>
                      Remove
                    </SmallButton>
                  </div>
                  {b.truncated && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">This block was shortened to {JD_LIMITS.maxDescriptionChars.toLocaleString()} characters.</p>}
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id={`jd-${b.key}-role`} label="Role (optional)" value={b.role} onChange={(v) => update(i, "role", v)} error={err("role")} placeholder="Detected automatically if empty" maxLength={200} />
                      <Field id={`jd-${b.key}-company`} label="Company (optional)" value={b.company} onChange={(v) => update(i, "company", v)} error={err("company")} placeholder="Detected automatically if empty" maxLength={200} />
                    </div>
                    <TextArea id={`jd-${b.key}-description`} label="Job description" value={b.description} onChange={(v) => update(i, "description", v)} error={err("description")} showCount={JD_LIMITS.maxDescriptionChars} rows={8} />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex justify-end">
            <PrimaryButton type="button" onClick={handleSubmit} disabled={disabled} className="flex items-center gap-2">
              {submitting && <Spinner />}
              {submitting ? "Creating…" : `Generate ${blocks.length} resume${blocks.length === 1 ? "" : "s"}`}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
