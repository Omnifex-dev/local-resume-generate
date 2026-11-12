import { redirect } from "next/navigation";
import { BrainBackground } from "@/components/auth/brain-background";
import { ColorModeToggle } from "@/components/theme/color-mode";
import { getCurrentUser, homeFor } from "@/server/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#03040c] dark:text-slate-100">
      {/* Deep-space backdrop, the living brain, then a vignette that keeps text readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_28%_42%,#e0e7ff_0%,#f1f5ff_45%,#f8fafc_85%)] dark:bg-[radial-gradient(ellipse_at_28%_42%,#111a3d_0%,#070a1c_45%,#03040c_85%)]"
      />
      <BrainBackground className="pointer-events-none fixed inset-0 h-full w-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(226,232,240,0.7)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(3,4,12,0.8)_100%)]"
      />

      {/* Full width with fluid side margins, so the content uses the whole screen. */}
      <div className="relative z-10 flex min-h-dvh flex-col px-4 py-6 sm:px-[clamp(1.5rem,5vw,6rem)] lg:py-8">
        <header className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">Resume Generate</span>
          <ColorModeToggle className="ml-auto" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 lg:flex-row lg:items-end lg:justify-between lg:gap-[clamp(3rem,8vw,10rem)] lg:py-0 lg:pb-6">
          <section className="auth-rise relative hidden max-w-xl lg:block">
            {/* Soft shade so the headline stays readable where the brain reaches behind it. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-24 -inset-y-16 -z-10 bg-[radial-gradient(ellipse_at_30%_60%,rgba(248,250,252,0.9)_0%,rgba(248,250,252,0.6)_45%,transparent_72%)] dark:bg-[radial-gradient(ellipse_at_30%_60%,rgba(3,4,12,0.88)_0%,rgba(3,4,12,0.6)_45%,transparent_72%)]"
            />
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-600/20 bg-white/70 px-3 py-1 text-xs font-medium text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-cyan-200">
              <span className="size-1.5 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-300" />
              AI-tailored resumes
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-6xl">
              Every application,
              <br />
              <span className="bg-gradient-to-r from-cyan-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-cyan-300 dark:via-indigo-300 dark:to-fuchsia-300">thought through.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 xl:text-lg dark:text-slate-300/80">
              Paste a job description. Your experience is rewritten for the role and printed as a clean, ATS-friendly PDF in seconds.
            </p>
          </section>

          <div className="auth-rise w-full max-w-[460px] lg:self-center [animation-delay:120ms]">{children}</div>
        </div>
      </div>
    </div>
  );
}
