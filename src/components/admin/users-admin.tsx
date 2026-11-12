"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field, Modal, PrimaryButton, SmallButton } from "@/components/ui";
import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  setUserActiveAction,
  type AdminResult,
} from "@/server/admin/actions";
import type { AdminUserRow } from "@/server/admin/users";

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
const fmt = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "—");

function CreateUser({ onDone }: { onDone: () => void }) {
  const empty = { username: "", password: "", role: "user" as "user" | "admin" };
  const [values, setValues] = useState(empty);
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <Card title="Add user" description="Usernames: 3–32 letters, numbers, dot, dash or underscore. Passwords: at least 8 characters.">
      <form
        noValidate
        className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await createUserAction(values);
            setResult(r);
            if (r.ok) {
              setValues(empty);
              onDone();
            }
          });
        }}
      >
        <Field id="new-username" label="Username" value={values.username} onChange={(v) => setValues((s) => ({ ...s, username: v }))} error={errors.username} autoComplete="off" maxLength={32} />
        <Field id="new-password" label="Password" type="password" value={values.password} onChange={(v) => setValues((s) => ({ ...s, password: v }))} error={errors.password} autoComplete="new-password" />
        <div>
          <label htmlFor="new-role" className="mb-1 block text-sm font-medium">
            Role
          </label>
          <select
            id="new-role"
            value={values.role}
            onChange={(e) => setValues((s) => ({ ...s, role: e.target.value as "user" | "admin" }))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#0a0e1f]"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <PrimaryButton type="submit" disabled={pending} className="sm:mt-6">
          {pending ? "Adding…" : "Add user"}
        </PrimaryButton>
      </form>
      {result && (
        <p role="status" className={`mt-3 text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {result.ok ? "User created." : result.error}
        </p>
      )}
    </Card>
  );
}

function ResetPassword({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password · ${user.username}`}
      size="md"
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" form="reset-password-form" disabled={pending || password.length === 0}>
            {pending ? "Saving…" : "Set password"}
          </PrimaryButton>
          {result && (
            <p role="status" className={`text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {result.ok ? "Password changed." : result.error}
            </p>
          )}
        </div>
      }
    >
      <form
        id="reset-password-form"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await resetPasswordAction(user.id, password)));
        }}
      >
        <Field id="reset-password" label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters. The user is signed out everywhere." />
      </form>
    </Modal>
  );
}

export function UsersAdmin({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<AdminUserRow | null>(null);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const run = (id: string, action: () => Promise<AdminResult>) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const r = await action();
      setBusyId(null);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  const shown = users.filter((u) => !query.trim() || [u.username, u.email ?? ""].some((v) => v.includes(query.trim().toLowerCase())));

  return (
    <div className="space-y-6">
      <CreateUser onDone={() => router.refresh()} />

      <Card
        title={`All users (${users.length})`}
        actions={
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username or email"
            aria-label="Search users"
            className="w-48 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-white/15 dark:bg-[#0a0e1f]"
          />
        }
      >
        {error && (
          <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="scroll-panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
              <tr>
                <th className="py-2 pr-3 font-medium">Username</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Resumes</th>
                <th className="py-2 pr-3 font-medium">Last generated</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {shown.map((u) => {
                const self = u.id === currentAdminId;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                    <td className="py-2 pr-3 font-medium">
                      {u.username}
                      {self && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                      {u.email && <span className="block text-xs font-normal text-slate-500">{u.email}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{u.active ? "Active" : "Disabled"}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {u.resumes}
                      {u.failed > 0 && <span className="text-xs text-red-600 dark:text-red-400"> · {u.failed} failed</span>}
                    </td>
                    <td className="py-2 pr-3">{fmt(u.lastGeneratedAt)}</td>
                    <td className="py-2 pr-3">{fmt(u.createdAt)}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <SmallButton onClick={() => setResetFor(u)} disabled={busy}>
                          Password
                        </SmallButton>
                        <SmallButton onClick={() => run(u.id, () => setUserActiveAction(u.id, !u.active))} disabled={busy || self}>
                          {u.active ? "Disable" : "Enable"}
                        </SmallButton>
                        <SmallButton
                          disabled={busy || self}
                          onClick={() => {
                            if (!window.confirm(`Delete “${u.username}” with their profile and all ${u.resumes + u.failed} resume records? This can't be undone.`)) return;
                            run(u.id, () => deleteUserAction(u.id));
                          }}
                        >
                          <span className="text-red-600 dark:text-red-400">Delete</span>
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {resetFor && <ResetPassword user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  );
}
