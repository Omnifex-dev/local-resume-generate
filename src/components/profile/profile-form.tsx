"use client";

import { useId, useState, useTransition } from "react";
import { Card, Field, SmallButton, TextArea } from "@/components/ui";
import {
  MAX_EDUCATIONS,
  MAX_EXPERIENCES,
  MAX_LANGUAGES_CHARS,
  MAX_SKILLS_CHARS,
  type EducationFormValues,
  type ExperienceFormValues,
  type ProfileFormValues,
} from "@/lib/profile-schema";
import { saveProfileAction } from "@/server/profile/actions";

// Row ids for stable React keys only (never used in the DOM: the counter differs
// between server and browser). A counter is used instead of
// crypto.randomUUID(), which is missing on plain-http LAN addresses.
let nextKey = 0;
type Keyed<T> = T & { key: number };
const withKey = <T,>(row: T): Keyed<T> => ({ ...row, key: nextKey++ });
const stripKey = <T,>(row: Keyed<T>): T => {
  const copy: Partial<Keyed<T>> = { ...row };
  delete copy.key;
  return copy as T;
};

const emptyExperience = (): ExperienceFormValues => ({ company: "", role: "", location: "", startDate: "", endDate: "" });
const emptyEducation = (): EducationFormValues => ({
  university: "",
  degree: "",
  field: "",
  location: "",
  startDate: "",
  endDate: "",
});

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

// type="month" shows a picker in Chrome/Edge; Firefox (Ubuntu's default browser)
// may fall back to a text box, so the placeholder shows the expected format.
const monthProps = { type: "month", placeholder: "YYYY-MM", maxLength: 7 } as const;

type Props = {
  initial: ProfileFormValues;
  username: string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** Shown in the status line until the user edits, e.g. after an import. */
  notice?: string;
};

export function ProfileForm({ initial, username, onSaved, notice }: Props) {
  const [contact, setContact] = useState({
    name: initial.name,
    email: initial.email,
    phone: initial.phone,
    linkedin: initial.linkedin,
    github: initial.github,
    headline: initial.headline ?? "",
    location: initial.location ?? "",
    skills: initial.skills ?? "",
    languages: initial.languages ?? "",
  });
  const uid = useId(); // DOM ids must match between server render and hydration
  const [experiences, setExperiences] = useState(() => initial.experiences.map(withKey));
  const [educations, setEducations] = useState(() => initial.educations.map(withKey));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; message: string } | null>(
    notice ? { kind: "info", message: notice } : null,
  );
  const [pending, startTransition] = useTransition();

  const setContactField = (field: keyof typeof contact) => (value: string) =>
    setContact((c) => ({ ...c, [field]: value }));

  // Error keys are index-based, so they go stale when rows are added, removed or moved.
  const changeList = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, next: (rows: T[]) => T[]) => {
    setter(next);
    setErrors({});
    setStatus(null);
  };

  const updateExperience = (i: number, field: keyof ExperienceFormValues, value: string) =>
    setExperiences((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const updateEducation = (i: number, field: keyof EducationFormValues, value: string) =>
    setEducations((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const payload: ProfileFormValues = {
      ...contact,
      experiences: experiences.map((r) => stripKey<ExperienceFormValues>(r)),
      educations: educations.map((r) => stripKey<EducationFormValues>(r)),
    };
    startTransition(async () => {
      const result = await saveProfileAction(payload);
      if (result.ok) {
        setErrors({});
        setStatus({ kind: "ok", message: "Profile saved." });
        onSaved?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        setStatus({ kind: "error", message: result.error ?? "Could not save." });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card title="Contact details" description="Empty fields are left off your resume.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Full name"
            value={contact.name}
            onChange={setContactField("name")}
            error={errors.name}
            placeholder={username}
            hint={`If empty, "${username}" is used.`}
            maxLength={100}
            autoComplete="name"
          />
          <Field
            id="headline"
            label="Headline"
            value={contact.headline}
            onChange={setContactField("headline")}
            error={errors.headline}
            placeholder="AI Engineer"
            hint="Job title shown under your name."
            maxLength={120}
          />
          <Field
            id="location"
            label="Location"
            value={contact.location}
            onChange={setContactField("location")}
            error={errors.location}
            placeholder="City, Region, Country"
            maxLength={200}
            autoComplete="address-level2"
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={contact.email}
            onChange={setContactField("email")}
            error={errors.email}
            maxLength={254}
            autoComplete="email"
          />
          <Field
            id="phone"
            label="Phone number"
            type="tel"
            value={contact.phone}
            onChange={setContactField("phone")}
            error={errors.phone}
            maxLength={40}
            autoComplete="tel"
          />
          <Field
            id="linkedin"
            label="LinkedIn"
            value={contact.linkedin}
            onChange={setContactField("linkedin")}
            error={errors.linkedin}
            placeholder="linkedin.com/in/your-name"
            maxLength={300}
          />
          <Field
            id="github"
            label="GitHub"
            value={contact.github}
            onChange={setContactField("github")}
            error={errors.github}
            placeholder="github.com/your-name"
            maxLength={300}
          />
        </div>
      </Card>

      <Card
        title="Skills and languages"
        description="The AI picks the skills that fit each job, groups them and may add ones that are clearly plausible for your roles."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            id="skills"
            label="Skills"
            value={contact.skills}
            onChange={setContactField("skills")}
            error={errors.skills}
            placeholder="Python, FastAPI, React, TypeScript, PostgreSQL, AWS, Docker, Terraform…"
            showCount={MAX_SKILLS_CHARS}
            rows={6}
          />
          <TextArea
            id="languages"
            label="Languages (one per line)"
            value={contact.languages}
            onChange={setContactField("languages")}
            error={errors.languages}
            placeholder={"English — Fluent\nSpanish — Conversational"}
            showCount={MAX_LANGUAGES_CHARS}
            rows={6}
          />
        </div>
      </Card>

      <Card
        title="Work experience"
        description="The AI writes resume bullet points for each company listed here."
        actions={
          <SmallButton
            onClick={() => changeList(setExperiences, (rows) => [...rows, withKey(emptyExperience())])}
            disabled={experiences.length >= MAX_EXPERIENCES}
          >
            + Add company
          </SmallButton>
        }
      >
        {errors.experiences && <p className="mb-3 text-sm text-red-600">{errors.experiences}</p>}
        {experiences.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
        <ol className="space-y-4">
          {experiences.map((row, i) => {
            const err = (f: string) => errors[`experiences.${i}.${f}`];
            return (
              <li key={row.key} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <RowToolbar
                  label={`Company ${i + 1}`}
                  onUp={() => changeList(setExperiences, (rows) => move(rows, i, i - 1))}
                  onDown={() => changeList(setExperiences, (rows) => move(rows, i, i + 1))}
                  onRemove={() => changeList(setExperiences, (rows) => rows.filter((_, j) => j !== i))}
                  isFirst={i === 0}
                  isLast={i === experiences.length - 1}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${uid}-exp-${i}-company`} label="Company name" value={row.company} onChange={(v) => updateExperience(i, "company", v)} error={err("company")} maxLength={200} />
                  <Field id={`${uid}-exp-${i}-role`} label="Role" value={row.role} onChange={(v) => updateExperience(i, "role", v)} error={err("role")} maxLength={200} />
                  <Field id={`${uid}-exp-${i}-location`} label="Location" value={row.location ?? ""} onChange={(v) => updateExperience(i, "location", v)} error={err("location")} placeholder="City, Country or Remote" maxLength={200} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field id={`${uid}-exp-${i}-start`} label="Start" value={row.startDate} onChange={(v) => updateExperience(i, "startDate", v)} error={err("startDate")} {...monthProps} />
                    <Field id={`${uid}-exp-${i}-end`} label="End" value={row.endDate} onChange={(v) => updateExperience(i, "endDate", v)} error={err("endDate")} hint="Empty = Present" {...monthProps} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card
        title="Education"
        actions={
          <SmallButton
            onClick={() => changeList(setEducations, (rows) => [...rows, withKey(emptyEducation())])}
            disabled={educations.length >= MAX_EDUCATIONS}
          >
            + Add education
          </SmallButton>
        }
      >
        {errors.educations && <p className="mb-3 text-sm text-red-600">{errors.educations}</p>}
        {educations.length === 0 && <p className="text-sm text-slate-500">No education entries yet.</p>}
        <ol className="space-y-4">
          {educations.map((row, i) => {
            const err = (f: string) => errors[`educations.${i}.${f}`];
            return (
              <li key={row.key} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <RowToolbar
                  label={`Education ${i + 1}`}
                  onUp={() => changeList(setEducations, (rows) => move(rows, i, i - 1))}
                  onDown={() => changeList(setEducations, (rows) => move(rows, i, i + 1))}
                  onRemove={() => changeList(setEducations, (rows) => rows.filter((_, j) => j !== i))}
                  isFirst={i === 0}
                  isLast={i === educations.length - 1}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${uid}-edu-${i}-university`} label="University" value={row.university} onChange={(v) => updateEducation(i, "university", v)} error={err("university")} maxLength={200} />
                  <Field id={`${uid}-edu-${i}-degree`} label="Degree" value={row.degree} onChange={(v) => updateEducation(i, "degree", v)} error={err("degree")} placeholder="B.Sc. Computer Science" maxLength={200} />
                  <Field id={`${uid}-edu-${i}-field`} label="Field of study / note" value={row.field ?? ""} onChange={(v) => updateEducation(i, "field", v)} error={err("field")} placeholder="Machine Learning" maxLength={200} />
                  <Field id={`${uid}-edu-${i}-location`} label="Location" value={row.location} onChange={(v) => updateEducation(i, "location", v)} error={err("location")} placeholder="City, Country" maxLength={200} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field id={`${uid}-edu-${i}-start`} label="Start" value={row.startDate} onChange={(v) => updateEducation(i, "startDate", v)} error={err("startDate")} {...monthProps} />
                    <Field id={`${uid}-edu-${i}-end`} label="End" value={row.endDate} onChange={(v) => updateEducation(i, "endDate", v)} error={err("endDate")} hint="Empty = ongoing" {...monthProps} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-slate-200 bg-white/90 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0a0e1f]/90">
        {status && (
          <p
            role="status"
            className={`text-sm ${status.kind === "ok" ? "text-green-700 dark:text-green-400" : status.kind === "info" ? "text-indigo-700 dark:text-cyan-300" : "text-red-600 dark:text-red-400"}`}
          >
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/25 px-4 py-2 text-sm font-medium text-white hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function RowToolbar({ label, onUp, onDown, onRemove, isFirst, isLast }: {
  label: string;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <div className="flex gap-1">
        <SmallButton onClick={onUp} disabled={isFirst} aria-label={`Move ${label} up`}>↑</SmallButton>
        <SmallButton onClick={onDown} disabled={isLast} aria-label={`Move ${label} down`}>↓</SmallButton>
        <SmallButton onClick={onRemove} aria-label={`Remove ${label}`}>Remove</SmallButton>
      </div>
    </div>
  );
}
