import { BrainBackground } from "@/components/auth/brain-background";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/settings/settings-form";
import { ColorModeToggle } from "@/components/theme/color-mode";
import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      {/* The sign-in pages' backdrop: gradient, the living brain (centred), then a vignette. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#e0e7ff_0%,#f1f5ff_45%,#f8fafc_85%)] dark:bg-[radial-gradient(ellipse_at_50%_45%,#111a3d_0%,#070a1c_45%,#03040c_85%)]" />
        <BrainBackground placement="center" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(226,232,240,0.7)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(3,4,12,0.8)_100%)]" />
      </div>

      {/* Fixed h-16: the workspace sizes its columns to the space below it. */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/60 px-4 backdrop-blur-md dark:border-white/10 dark:bg-[#03040c]/60">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </span>
          <span className="hidden truncate text-base font-semibold tracking-tight sm:inline">Resume Generate</span>
          <AppNav />
        </div>
        <div className="flex items-center gap-2">
          <ColorModeToggle />
          <UserMenu username={user.username} />
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
