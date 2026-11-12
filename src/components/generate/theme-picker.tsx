"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Modal, Panel, PrimaryButton, SmallButton } from "@/components/ui";
import { PAGE_SIZES, THEMES, type PageSize, type ThemeId } from "@/lib/themes";
import { savePageSizeAction, saveThemeAction } from "@/server/settings/actions";

// A4 at 96 dpi; previews are scaled down from real page size so they match the PDF.
const PAGE_W = 794;
const PAGE_H = 1123;

type Props = {
  previews: Record<ThemeId, string>;
  value: ThemeId;
  onChange: (id: ThemeId) => void;
  pageSize: PageSize;
};

const PAGE_SIZE_LABEL: Record<PageSize, string> = { A4: "A4", Letter: "US Letter" };

/** Paper size of the PDFs (and the previews), saved as soon as it changes. */
function PaperSize({ initial }: { initial: PageSize }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function select(next: PageSize) {
    if (next === value || pending) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const r = await savePageSizeAction(next);
      if (r.ok) router.refresh(); // the previews are rendered for this paper size
      else {
        setValue(previous);
        setError(r.error);
      }
    });
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-3">
        <span id="page-size-label" className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Page size
        </span>
        <div role="radiogroup" aria-labelledby="page-size-label" className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-white/10 dark:bg-white/[0.03]">
          {PAGE_SIZES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={value === p}
              disabled={pending}
              onClick={() => select(p)}
              title={p === "A4" ? "A4 (most countries)" : "US Letter (US, Canada)"}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition disabled:cursor-wait ${
                value === p
                  ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 text-white shadow shadow-indigo-500/25"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {PAGE_SIZE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}

/** A full-size page iframe scaled to fit the width of its box. */
function PagePreview({ html, title }: { html: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.18);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / PAGE_W || 0.18);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded border border-slate-200 bg-white dark:border-white/15"
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
    >
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
      />
    </div>
  );
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Full-page view of one theme with zoom controls. */
function ThemeZoom({ html, name, selected, onClose, onUse }: { html: string; name: string; selected: boolean; onClose: () => void; onUse: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(0.8);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setFitScale(Math.max(0.2, (box.clientWidth - 16) / PAGE_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const scale = zoom === "fit" ? fitScale : zoom;
  const step = (dir: 1 | -1) => {
    const next = dir === 1 ? ZOOM_STEPS.find((z) => z > scale + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < scale - 0.001);
    if (next) setZoom(next);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${name} theme`}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="Zoom">
            <SmallButton onClick={() => step(-1)} disabled={scale <= ZOOM_STEPS[0]! + 0.001} aria-label="Zoom out">
              −
            </SmallButton>
            <span className="w-12 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
            <SmallButton onClick={() => step(1)} disabled={scale >= ZOOM_STEPS[ZOOM_STEPS.length - 1]! - 0.001} aria-label="Zoom in">
              +
            </SmallButton>
            <SmallButton onClick={() => setZoom("fit")} disabled={zoom === "fit"}>
              Fit width
            </SmallButton>
            <SmallButton onClick={() => setZoom(1)} disabled={zoom === 1}>
              100%
            </SmallButton>
          </div>
          <PrimaryButton type="button" onClick={onUse} disabled={selected}>
            {selected ? "Selected" : "Use this theme"}
          </PrimaryButton>
        </div>
      }
    >
      <div ref={boxRef} className="overflow-auto rounded-lg bg-slate-200 p-2 dark:bg-white/[0.06]">
        {/* The wrapper takes the scaled size so the scroll area matches the page. */}
        <div className="mx-auto shadow-lg" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
          <iframe
            title={`${name} full preview`}
            srcDoc={html}
            sandbox=""
            className="origin-top-left border-0 bg-white"
            style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </Modal>
  );
}

export function ThemePicker({ previews, value, onChange, pageSize }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<ThemeId | null>(null);
  const [, startTransition] = useTransition();
  const current = THEMES.find((t) => t.id === value) ?? THEMES[0];

  function select(id: ThemeId) {
    if (id === value) return;
    const previous = value;
    onChange(id);
    setError(null);
    startTransition(async () => {
      const r = await saveThemeAction(id);
      if (!r.ok) {
        onChange(previous);
        setError(r.error);
      }
    });
  }

  return (
    <div>
      {/* <PaperSize initial={pageSize} /> */}
      <div role="radiogroup" aria-label="Resume theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {THEMES.map((t) => {
          const selected = t.id === value;
          return (
            <div key={t.id} className="group relative">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${t.name}: ${t.description}`}
              title={t.description}
              onClick={() => select(t.id)}
              className={`w-full rounded-lg border-2 p-1.5 text-left transition ${selected ? "border-cyan-400/80 ring-4 ring-cyan-400/15" : "border-slate-200 hover:border-slate-400 dark:border-white/15"}`}
            >
              <PagePreview html={previews[t.id]} title={`${t.name} preview`} />
              <span className={`mt-1 block truncate text-xs ${selected ? "font-semibold text-indigo-700 dark:text-cyan-300" : "font-medium"}`}>
                {t.name}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setZoomed(t.id)}
              aria-label={`Zoom ${t.name} preview`}
              title="Zoom"
              className="absolute right-3 top-3 rounded-md bg-slate-900/70 p-1.5 text-white opacity-80 shadow hover:bg-slate-900 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4">
                <path d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.63 3.64a.75.75 0 1 0 1.06-1.06l-3.63-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-2.25a.75.75 0 0 1 .75.75v.75h.75a.75.75 0 0 1 0 1.5h-.75v.75a.75.75 0 0 1-1.5 0v-.75H7.5a.75.75 0 0 1 0-1.5h.75V7.5A.75.75 0 0 1 9 6.75Z" />
              </svg>
            </button>
            </div>
          );
        })}
      </div>
      {zoomed && (
        <ThemeZoom
          html={previews[zoomed]}
          name={THEMES.find((t) => t.id === zoomed)?.name ?? ""}
          selected={zoomed === value}
          onClose={() => setZoomed(null)}
          onUse={() => select(zoomed)}
        />
      )}
      <p className="mt-2 text-xs text-slate-500">Previews use your profile with example AI text. Use the magnifier to zoom.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
