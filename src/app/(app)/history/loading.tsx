import { PanelSkeleton } from "@/components/skeleton";

/** Shown at once while the history page renders on the server, so nav clicks respond immediately. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading history" className="mx-auto w-full max-w-4xl">
      <PanelSkeleton title="All history" rows={8} />
    </div>
  );
}
