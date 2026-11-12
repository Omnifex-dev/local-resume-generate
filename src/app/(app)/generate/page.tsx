import { ProfileEditButton } from "@/components/profile/profile-modal";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { GenerateWorkspace } from "@/components/generate/generate-workspace";
import { GenerationForm } from "@/components/settings/generation-form";
import { toProfileFormValues } from "@/lib/profile-schema";
import { THEMES, type ThemeId } from "@/lib/themes";
import { renderResumeHtml } from "@/resume/html";
import { buildResumeModel } from "@/resume/model";
import { previewData } from "@/resume/sample";
import { requireUser } from "@/server/auth/session";
import { listGenerationsSince } from "@/server/generation/repository";
import { failInterrupted } from "@/server/generation/service";
import { getProfile } from "@/server/profile/repository";
import { getSettings } from "@/server/settings/repository";

// Local midnight anywhere on Earth is less than 24 hours ago.
const DAY_MS = 24 * 60 * 60 * 1000;

export const metadata = { title: "Workspace · Resume Generate" };

export default async function GeneratePage() {
  const user = await requireUser();
  await failInterrupted(user.id);
  const [profile, settings, history] = await Promise.all([getProfile(user.id), getSettings(user.id), listGenerationsSince(user.id, new Date(Date.now() - DAY_MS))]);

  const blocker = !settings.hasApiKey
    ? { message: "The administrator hasn't set an OpenAI API key yet, so resumes can't be generated." }
    : profile.experiences.length === 0
      ? { message: "Add at least one company to your profile (Edit in the Profile panel); the AI writes bullets for each one." }
      : null;

  const { snapshot, bullets, extras } = previewData(profile);
  const model = buildResumeModel(snapshot, bullets, user.username, extras);
  const previews = Object.fromEntries(
    THEMES.map((t) => [t.id, renderResumeHtml(model, t.id, settings.pageSize)]),
  ) as Record<ThemeId, string>;

  // Elements passed from a server to a client component need a key, or React warns inside Panel.
  return (
    <>
      <h1 className="sr-only">Resume workspace</h1>
      <GenerateWorkspace
        blocker={blocker}
        initialTheme={settings.themeId}
        pageSize={settings.pageSize}
        previews={previews}
        history={history}
        profile={
          <ProfileSummary
            key="profile"
            profile={profile}
            fallbackName={user.username}
            editButton={<ProfileEditButton initial={toProfileFormValues(profile, user.username)} username={user.username} />}
          />
        }
        generationSettings={
          <GenerationForm
            key="generation-settings"
            model={settings.model}
            defaultModel={settings.defaultModel}
            prompt={settings.effectivePrompt}
            defaultPrompt={settings.defaultPrompt}
          />
        }
      />
    </>
  );
}
