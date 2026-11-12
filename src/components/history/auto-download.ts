"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Auto download" switch: when on, a resume's PDF downloads by itself as soon
 * as it is generated. Off by default; remembered per browser in localStorage and
 * kept in sync between components and tabs.
 */
const KEY = "auto-download-pdf";
const EVENT = "auto-download-change";
/** Used when localStorage is blocked, so the switch still works for this page. */
let memory = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

export function useAutoDownload(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((value: boolean) => {
    memory = value;
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      /* storage blocked: `memory` keeps the value for this page */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}
