"use client";

import { useSyncExternalStore } from "react";
import { applyColorMode, type ColorMode } from "@/lib/color-mode";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const read = (): ColorMode => (document.documentElement.classList.contains("dark") ? "dark" : "light");

/** The current mode; follows changes made anywhere on the page. Server render assumes dark. */
export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

const SUN = "M12 3v1.5M12 19.5V21M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M3 12h1.5M19.5 12H21M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z";
const MOON = "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z";

/** Sun/moon button that switches between light and dark mode. */
export function ColorModeToggle({ className = "" }: { className?: string }) {
  const mode = useColorMode();
  const next: ColorMode = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => applyColorMode(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid size-9 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none dark:hover:border-white/20 dark:hover:text-white dark:focus-visible:outline-cyan-300 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
        <path d={mode === "dark" ? SUN : MOON} />
      </svg>
    </button>
  );
}
