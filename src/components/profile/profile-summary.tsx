import { Panel } from "@/components/ui";
import { formatPeriod } from "@/lib/period";
import type { ProfileData } from "@/lib/profile-schema";

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h3>;
}

/** Read-only overview of the profile for the workspace's left column. */
export function ProfileSummary({ profile, fallbackName, editButton }: { profile: ProfileData; fallbackName: string; editButton: React.ReactNode }) {
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean) as string[];
  const links = [profile.linkedin, profile.github].filter(Boolean) as string[];
  const skills = (profile.skills ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const languages = (profile.languages ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <Panel title="Profile" actions={editButton} fill>
      <div className="space-y-5 text-sm">
        <div className="min-w-0">
          <p className="text-base font-semibold">{profile.name || fallbackName}</p>
          {profile.headline && <p className="text-indigo-700 dark:text-cyan-300">{profile.headline}</p>}
          {contact.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-slate-600 dark:text-slate-400">
              {contact.map((c) => (
                <li key={c} className="truncate" title={c}>
                  {c}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {links.map((l) => (
                <li key={l} className="truncate text-slate-600 dark:text-slate-400" title={l}>
                  {l.replace(/^https?:\/\/(www\.)?/, "")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SubHeading>Experience</SubHeading>
          {profile.experiences.length === 0 ? (
            <p className="text-amber-700 dark:text-amber-400">
              No companies yet. Click Edit to add them, or import them from your resume.
            </p>
          ) : (
            <ol className="space-y-3 border-l border-slate-200 pl-3 dark:border-white/15">
              {profile.experiences.map((e, i) => (
                <li key={`${e.company}-${i}`} className="min-w-0">
                  <p className="truncate font-medium" title={e.company}>
                    {e.company}
                  </p>
                  <p className="truncate text-slate-600 dark:text-slate-400" title={e.role}>
                    {e.role}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatPeriod(e.startDate, e.endDate)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {profile.educations.length > 0 && (
          <div>
            <SubHeading>Education</SubHeading>
            <ul className="space-y-2">
              {profile.educations.map((e, i) => (
                <li key={`${e.university}-${i}`} className="min-w-0">
                  <p className="font-medium">{e.university}</p>
                  {(e.degree || e.field) && (
                    <p className="text-slate-600 dark:text-slate-400">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-xs text-slate-500">{formatPeriod(e.startDate, e.endDate)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {skills.length > 0 && (
          <div>
            <SubHeading>Skills</SubHeading>
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <li key={`${s}-${i}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {languages.length > 0 && (
          <div>
            <SubHeading>Languages</SubHeading>
            <ul className="space-y-0.5 text-slate-600 dark:text-slate-400">
              {languages.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
