"use client";

import { ActivityFeed } from "@/components/marketplace/activity-feed";
import { NFTCard } from "@/components/sections/nft-card";
import { AnimatedPage } from "@/components/ui/animated-page";
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { StatCard } from "@/components/ui/stat-card";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { formatCurrency } from "@/utils/format";

export default function MarketplacePage() {
  const { liveListings, activity, stats, isRefreshing, error } = useMarketplaceListings();

  return (
    <AnimatedPage>
      {error ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-3">
          {isRefreshing ? (
            <>
              <SkeletonBlock className="h-80" />
              <SkeletonBlock className="h-80" />
              <SkeletonBlock className="h-80" />
              <SkeletonBlock className="h-80" />
            </>
          ) : liveListings.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5 text-sm text-zinc-300">
              No NFTs available yet.
            </div>
          ) : (
            liveListings.map((nft) => <NFTCard key={nft.id} nft={nft} />)
          )}
        </div>
        {activity.length > 0 ? (
          <ActivityFeed items={activity} limit={6} />
        ) : null}
      </div>

      {liveListings.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard className="h-full" label="Listings" value={String(stats.totalListings)} detail="Now live" />
          <StatCard className="h-full" label="Floor" value={formatCurrency(stats.floorPrice)} detail="Best available" />
          <StatCard className="h-full" label="Average" value={formatCurrency(stats.avgPrice)} detail="Market average" />
        </div>
      ) : null}
    </AnimatedPage>
  );
}
