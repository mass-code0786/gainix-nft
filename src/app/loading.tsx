import { SkeletonBlock } from "@/components/ui/skeleton-block";

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <div className="mx-auto flex max-w-md flex-col gap-4 sm:max-w-2xl">
        <SkeletonBlock className="h-16 rounded-3xl" />
        <SkeletonBlock className="h-64 rounded-[32px]" />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonBlock className="h-28 rounded-[28px]" />
          <SkeletonBlock className="h-28 rounded-[28px]" />
        </div>
        <SkeletonBlock className="h-52 rounded-[32px]" />
      </div>
    </main>
  );
}
