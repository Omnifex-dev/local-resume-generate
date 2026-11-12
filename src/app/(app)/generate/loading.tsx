import { PanelSkeleton } from "@/components/skeleton";

/** Shown at once while the workspace renders on the server, so nav clicks respond immediately. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      className="grid gap-4 lg:h-[calc(100dvh-4rem-2rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]"
    >
      <PanelSkeleton title="Profile" rows={8} />
      <div className="flex min-w-0 flex-col gap-4 lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,11fr)_minmax(0,9fr)]">
        <PanelSkeleton title="Today's history" rows={5} />
        <PanelSkeleton title="Theme" rows={3} />
      </div>
      <PanelSkeleton title="Model & prompt" rows={8} />
    </div>
  );
}
