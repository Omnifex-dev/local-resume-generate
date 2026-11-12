"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "OpenAI & prompt" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${active ? "bg-white/15 font-medium" : "text-slate-300 hover:text-white"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
