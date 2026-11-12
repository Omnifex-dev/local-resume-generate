"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal, Spinner } from "@/components/ui";
import type { ProfileFormValues } from "@/lib/profile-schema";
import { ProfileForm } from "./profile-form";

const ACCEPT = ".pdf,.docx,.doc,.txt";

/** Edit button for the profile panel: the full profile form, plus import from an existing resume. */
export function ProfileEditButton({ initial, username }: { initial: ProfileFormValues; username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Importing replaces the form's values: a new key remounts it with them.
  const [form, setForm] = useState({ key: 0, values: initial, notice: undefined as string | undefined });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function importResume(file: File) {
    setImporting(true);
    setImportError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/profile/import", { method: "POST", body });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json().catch(() => null)) as { profile?: ProfileFormValues; error?: { message?: string } } | null;
      if (!res.ok || !data?.profile) {
        setImportError(data?.error?.message ?? `Import failed (HTTP ${res.status}).`);
        return;
      }
      setForm((f) => ({
        key: f.key + 1,
        values: data.profile!,
        notice: `Filled in from “${file.name}”. Check every field, then save.`,
      }));
    } catch {
      setImportError("Network error while uploading. Please try again.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10"
      >
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Profile" size="xl">
        <div className="space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="min-w-0 text-sm">
              <p className="font-medium">Import from a resume</p>
              <p className="text-slate-600 dark:text-slate-400">
                Upload your existing resume (.pdf, .docx, .doc or .txt). The AI reads it and fills in the form below; nothing is saved until you click Save.
              </p>
            </div>
            <input
              ref={inputRef}
              id="profile-import"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={importing}
              onChange={(e) => e.target.files?.[0] && void importResume(e.target.files[0])}
            />
            <label
              htmlFor="profile-import"
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25 px-3 py-1.5 text-sm font-medium text-white hover:shadow-indigo-500/40 hover:brightness-110 ${importing ? "pointer-events-none opacity-60" : ""}`}
            >
              {importing && <Spinner />}
              {importing ? "Reading resume…" : "Choose resume"}
            </label>
            {importError && (
              <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
                {importError}
              </p>
            )}
          </section>

          <ProfileForm
            key={form.key}
            initial={form.values}
            username={username}
            notice={form.notice}
            onSaved={() => router.refresh()}
          />
        </div>
      </Modal>
    </>
  );
}
