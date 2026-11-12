"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui";

const LINKS = [
  { href: "/generate", label: "Workspace" },
  { href: "/history", label: "History" },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Spinner while this link's navigation is still loading (must render inside the <Link>). */
function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="h-3 w-3" /> : null;
}

export function AppNav() {
  const path = usePathname();
  // The clicked link is highlighted at once instead of when the new page arrives.
  // It resets when the path changes (the click's navigation finished).
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const target = clicked && clicked.from === path ? clicked.href : null;

  return (
    <nav aria-label="Main" className="ml-2 flex items-center gap-1">
      {LINKS.map((l) => {
        const current = isActive(path, l.href);
        const active = target ? target === l.href : current;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => !current && setClicked({ href: l.href, from: path })}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-slate-900/[0.06] text-slate-900 dark:bg-white/[0.08] dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {l.label}
            <PendingMark />
          </Link>
        );
      })}
    </nav>
  );
}
