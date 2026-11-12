"use client";

import { useEffect, useState } from "react";
import { inputClass, Modal, PrimaryButton, SmallButton, Spinner } from "@/components/ui";
import { normalizeEdit, resumeEditSchema, type ResumeEdit } from "@/lib/edit-schema";
import type { HistoryEntry } from "@/lib/history";
import { downloadBlob } from "@/lib/save-files";
import { THEMES, type ThemeId } from "@/lib/themes";

const recordTitle = (r: HistoryEntry) => [r.role, r.company].filter(Boolean).join(" · ") || "Resume";

/**
 * Which record the Preview / Edit dialogs show. Kept as ids and looked up in
 * `records`, so a saved edit (a new record object) refreshes an open preview.
 */
export function useRecordDialogs(records: HistoryEntry[]) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const find = (id: string | null) => (id ? (records.find((r) => r.id === id && r.status === "succeeded") ?? null) : null);
  return {
    preview: find(previewId),
    edit: find(editId),
    openPreview: (r: HistoryEntry) => setPreviewId(r.id),
    openEdit: (r: HistoryEntry) => setEditId(r.id),
    closePreview: () => setPreviewId(null),
    closeEdit: () => setEditId(null),
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/** Shows the record's PDF in the browser's PDF viewer, in a theme the user can switch. */
export function PdfPreviewModal({ record, theme, fetchPdf, onEdit, onClose }: {
  record: HistoryEntry | null;
  /** Initial theme (the one selected in the workspace / settings). */
  theme: ThemeId;
  fetchPdf: (r: HistoryEntry, theme: ThemeId, signal?: AbortSignal) => Promise<Blob>;
  onEdit?: (r: HistoryEntry) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={record !== null} onClose={onClose} title={record ? `Preview · ${recordTitle(record)}` : "Preview"} size="xl">
      {/* Remounted per record, so it starts from the given theme. A saved edit gives a new record object, which re-renders the PDF. */}
      {record && <PdfPreview key={record.id} record={record} theme={theme} fetchPdf={fetchPdf} onEdit={onEdit} />}
    </Modal>
  );
}

function PdfPreview({ record, theme: initialTheme, fetchPdf, onEdit }: {
  record: HistoryEntry;
  theme: ThemeId;
  fetchPdf: (r: HistoryEntry, theme: ThemeId, signal?: AbortSignal) => Promise<Blob>;
  onEdit?: (r: HistoryEntry) => void;
}) {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let url: string | null = null;
    setPdf(null);
    setError(null);
    fetchPdf(record, theme, ctrl.signal)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setPdf({ blob, url });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [record, theme, fetchPdf]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)} className={`${inputClass} w-auto py-1.5`}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          {onEdit && <SmallButton onClick={() => onEdit(record)}>Edit text</SmallButton>}
          <PrimaryButton type="button" disabled={!pdf} onClick={() => pdf && downloadBlob(record.pdfFileName ?? "resume.pdf", pdf.blob)}>
            Download PDF
          </PrimaryButton>
        </div>
      </div>

      <div className="grid h-[70dvh] place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black/30">
        {error ? (
          <p role="alert" className="px-4 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : pdf ? (
          <iframe src={`${pdf.url}#view=FitH`} title={`PDF preview of ${recordTitle(record)}`} className="h-full w-full" />
        ) : (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Rendering PDF…
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

type SkillRow = { category: string; items: string };
type Draft = { role: string; company: string; summary: string; bullets: Record<string, string>; skills: SkillRow[]; additional: string };

function toDraft(r: HistoryEntry): Draft {
  return {
    role: r.role ?? "",
    company: r.company ?? "",
    summary: r.extras?.summary ?? "",
    bullets: Object.fromEntries(Object.entries(r.content ?? {}).map(([k, v]) => [k, v.join("\n")])),
    skills: (r.extras?.skills ?? []).map((g) => ({ category: g.category, items: g.items.join(", ") })),
    additional: (r.extras?.additional ?? []).join("\n"),
  };
}

const splitLines = (s: string) => s.split("\n");

function fromDraft(d: Draft): ResumeEdit {
  return normalizeEdit({
    role: d.role,
    company: d.company,
    content: Object.fromEntries(Object.entries(d.bullets).map(([k, v]) => [k, splitLines(v)])),
    extras: {
      summary: d.summary,
      skills: d.skills.map((g) => ({ category: g.category, items: g.items.split(",") })),
      additional: splitLines(d.additional),
    },
  });
}

/** Edits the AI-written text of a finished record (role, company, summary, bullets, skills, additional info). */
export function EditResumeModal({ record, onSave, onClose }: {
  record: HistoryEntry | null;
  /** Returns an error message, or null when saved. */
  onSave: (r: HistoryEntry, edit: ResumeEdit) => Promise<string | null>;
  onClose: () => void;
}) {
  return (
    <Modal open={record !== null} onClose={onClose} title={record ? `Edit · ${recordTitle(record)}` : "Edit resume"} size="lg">
      {record && <EditForm key={record.id} record={record} onSave={onSave} onDone={onClose} />}
    </Modal>
  );
}

const labelClass = "mb-1 block text-sm font-medium";
const textareaClass = `${inputClass} leading-relaxed`;

function EditForm({ record, onSave, onDone }: { record: HistoryEntry; onSave: (r: HistoryEntry, edit: ResumeEdit) => Promise<string | null>; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(record));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSkill = (i: number, patch: Partial<SkillRow>) => set("skills", draft.skills.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const edit = fromDraft(draft);
    const parsed = resumeEditSchema.safeParse(edit);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the fields.");
    setSaving(true);
    setError(null);
    const err = await onSave(record, parsed.data);
    setSaving(false);
    if (err) setError(err);
    else onDone();
  };

  const id = (name: string) => `edit-${record.id}-${name}`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-xs text-slate-500">
        Wrap keywords in <code className="rounded bg-slate-100 px-1 dark:bg-white/10">**double asterisks**</code> to make them bold. Your profile (name, contacts, dates, education) is edited in the Profile panel.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id("role")} className={labelClass}>Role</label>
          <input id={id("role")} value={draft.role} onChange={(e) => set("role", e.target.value)} maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor={id("company")} className={labelClass}>Company</label>
          <input id={id("company")} value={draft.company} onChange={(e) => set("company", e.target.value)} maxLength={200} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor={id("summary")} className={labelClass}>Professional summary</label>
        <textarea id={id("summary")} rows={5} value={draft.summary} onChange={(e) => set("summary", e.target.value)} maxLength={1500} className={textareaClass} />
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">Experience bullets <span className="font-normal text-slate-500">(one per line)</span></legend>
        {Object.keys(draft.bullets).map((company, i) => (
          <div key={company}>
            <label htmlFor={id(`bullets-${i}`)} className={labelClass}>{company}</label>
            <textarea
              id={id(`bullets-${i}`)}
              rows={Math.min(10, Math.max(3, draft.bullets[company]!.split("\n").length + 1))}
              value={draft.bullets[company]}
              onChange={(e) => set("bullets", { ...draft.bullets, [company]: e.target.value })}
              className={textareaClass}
            />
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Technical skills <span className="font-normal text-slate-500">(comma-separated)</span></legend>
        <div className="space-y-2">
          {draft.skills.map((g, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                aria-label={`Skill category ${i + 1}`}
                placeholder="Category"
                value={g.category}
                onChange={(e) => setSkill(i, { category: e.target.value })}
                maxLength={60}
                className={`${inputClass} w-40 shrink-0 sm:w-48`}
              />
              <input
                aria-label={`Skills in category ${i + 1}`}
                placeholder="React, TypeScript, …"
                value={g.items}
                onChange={(e) => setSkill(i, { items: e.target.value })}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => set("skills", draft.skills.filter((_, j) => j !== i))}
                aria-label={`Remove skill category ${i + 1}`}
                className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {draft.skills.length < 8 && (
          <div className="mt-2">
            <SmallButton onClick={() => set("skills", [...draft.skills, { category: "", items: "" }])}>+ Add category</SmallButton>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor={id("additional")} className={labelClass}>
          Additional information <span className="font-normal text-slate-500">(one per line)</span>
        </label>
        <textarea id={id("additional")} rows={4} value={draft.additional} onChange={(e) => set("additional", e.target.value)} className={textareaClass} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
        {error && (
          <p role="alert" className="mr-auto text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <SmallButton onClick={onDone} disabled={saving}>
          Cancel
        </SmallButton>
        <PrimaryButton type="submit" disabled={saving} className="flex items-center gap-2">
          {saving && <Spinner />}
          Save changes
        </PrimaryButton>
      </div>
    </form>
  );
}
