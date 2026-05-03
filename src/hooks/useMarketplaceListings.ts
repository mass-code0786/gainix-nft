"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";
import { adaptBackendNftToItem } from "@/lib/api/nft-adapters";
import { isSameAddress } from "@/lib/web3/wallet-utils";
import { formatWallet } from "@/utils/format";
import type { NFTItem } from "@/types";

interface BackendMarketplaceResponse {
  marketplace: Array<{
    id: string;
    tokenId: string;
    name: string;
    description?: string;
    category?: string;
    imageUrl: string;
    basePrice: number;
    currentPrice: number;
    lastBuyPrice: number | null;
    totalTrades: number;
    status: "marketplace" | "owned" | "listed" | "sold" | "draft";
    ownerUserId: string | null;
    lastPriceIncreasePercent: number | null;
    createdAt: string;
    updatedAt: string;
    owner?: {
      id: string;
      walletAddress: `0x${string}`;
    } | null;
  }>; 
}

export function useMarketplaceListings() {
  const { fullAddress } = useWallet();
  const [liveListings, setLiveListings] = useState<NFTItem[]>([]);
  const [source] = useState<"chain">("chain");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetchJson<BackendMarketplaceResponse>("/api/nft/marketplace", { signal });
      const nextListings = response.marketplace
        .map((item) => adaptBackendNftToItem(item))
        .sort((left, right) => right.tokenId - left.tokenId);

      setLiveListings(nextListings);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load marketplace.");
      setLiveListings([]);
    } finally {
      if (!signal?.aborted) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    void refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        console.info(`[perf.ui] page=marketplace loadMs=${Math.round(performance.now() - startedAt)}`);
      }
    });

    return () => controller.abort();
  }, [refresh]);

  const topMovers = [...liveListings].sort((left, right) => right.changePercent - left.changePercent).slice(0, 3);
  const activity = liveListings
    .flatMap((item) =>
      item.activity.map((entry) => ({
        ...entry,
        nftName: item.name,
        nftSlug: item.slug,
        nftTokenId: item.tokenId,
        ownerLabel: formatWallet(item.owner),
      })),
    )
    .sort((left, right) => right.blockNumber - left.blockNumber);

  const floor = liveListings.length ? Math.min(...liveListings.map((item) => item.floorPrice)) : 0;
  const avgPrice = liveListings.length
    ? liveListings.reduce((total, item) => total + (item.listedPrice ?? item.currentPrice), 0) / liveListings.length
    : 0;

  const getBySlug = (slug: string) => liveListings.find((item) => item.slug === slug);
  const getByTokenId = (tokenId: number) => liveListings.find((item) => item.tokenId === tokenId);
  const getLastSalePrice = (slug: string) => getBySlug(slug)?.currentPrice;
  const getLastSalePriceByTokenId = (tokenId: number) => getByTokenId(tokenId)?.currentPrice;
  const getActivityBySlug = (slug: string) => activity.filter((entry) => entry.nftSlug === slug);
  const getActivityByTokenId = (tokenId: number) => activity.filter((entry) => entry.nftTokenId === tokenId);

  const buildState = (target: NFTItem | undefined, viewerAddress?: Address | null) => {
    if (!target) {
      return {
        exists: false,
        isOwnedByViewer: false,
        isListed: false,
        hasSales: false,
        listingStatus: "not_found" as const,
        soldCount: 0,
        mintedCount: 0,
      };
    }

    const soldCount = target.activity.filter((entry) => entry.type === "sell" || entry.type === "buy").length;
    const mintedCount = target.activity.filter((entry) => entry.type === "mint").length;
    const isListed = target.listedPrice !== null;
    const isOwnedByViewer =
      isSameAddress(target.owner, viewerAddress) || (isListed && isSameAddress(target.seller, viewerAddress));

    return {
      exists: true,
      isOwnedByViewer,
      isListed,
      hasSales: soldCount > 0,
      listingStatus: isListed ? ("active_listing" as const) : soldCount > 0 ? ("sold_history" as const) : ("not_listed" as const),
      soldCount,
      mintedCount,
    };
  };

  return {
    source,
    error,
    isRefreshing,
    liveListings,
    topMovers,
    activity,
    getByTokenId,
    getBySlug,
    getActivityBySlug,
    getActivityByTokenId,
    getLastSalePrice,
    getLastSalePriceByTokenId,
    getMarketState: (slug: string, viewerAddress?: Address | null) => buildState(getBySlug(slug), viewerAddress ?? fullAddress),
    getMarketStateByTokenId: (tokenId: number, viewerAddress?: Address | null) => buildState(getByTokenId(tokenId), viewerAddress ?? fullAddress),
    stats: {
      totalListings: liveListings.length,
      floorPrice: floor,
      avgPrice,
    },
    refresh,
    previewTemplates: [],
  };
}
