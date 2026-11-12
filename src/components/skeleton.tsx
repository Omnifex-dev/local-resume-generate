/** Placeholder panel (same frame as Panel) with pulsing lines, for route loading states. */
export function PanelSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-lg shadow-indigo-900/5 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col dark:border-white/10 dark:shadow-2xl dark:shadow-black/60">
      <div className="flex shrink-0 items-center px-4 py-2.5 border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.045]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-cyan-200/80">{title}</h2>
      </div>
      <div className="space-y-3 bg-white p-4 lg:flex-1 dark:bg-[#0a0e1f]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.05]" style={{ width: `${100 - ((i * 17) % 35)}%` }} />
        ))}
      </div>
    </section>
  );
}
