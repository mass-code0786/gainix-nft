import { SkeletonBlock } from "@/components/ui/skeleton-block";

export default function PanelLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SkeletonBlock className="h-20 rounded-[30px]" />
      <SkeletonBlock className="h-56 rounded-[32px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-40 rounded-[28px]" />
        <SkeletonBlock className="h-40 rounded-[28px]" />
      </div>
      <SkeletonBlock className="h-80 rounded-[32px]" />
    </div>
  );
}
