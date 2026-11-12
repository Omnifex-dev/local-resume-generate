import { AdminNav } from "@/components/admin/admin-nav";
import { ColorModeToggle } from "@/components/theme/color-mode";
import { logoutAction } from "@/server/auth/actions";
import { requireAdmin } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-slate-900 text-white dark:border-white/10">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-semibold">
              Resume Generate <span className="ml-1 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-slate-900">ADMIN</span>
            </span>
            <AdminNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ColorModeToggle className="border-slate-600 bg-transparent text-slate-300 hover:text-white dark:border-white/10" />
            <span className="text-slate-300">{admin.username}</span>
            <form action={logoutAction}>
              <button type="submit" className="rounded-md border border-slate-600 px-3 py-1 hover:bg-slate-800">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
