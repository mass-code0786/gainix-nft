"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";
import { adaptBackendTradeToItem } from "@/lib/api/nft-adapters";
import type { NFTItem, PortfolioHolding } from "@/types";
import type { WalletHistoryEntry } from "@/hooks/useWalletHistory";

interface WalletResponse {
  tradingWallet: number;
  withdrawalWallet: number;
  gxnTokenBalance: number;
  gxnTokenValueUsd: number;
  gxnTokenUsdValue: number;
  buyCount: number;
  sellCount: number;
  totalBuyCount: number;
  totalSellCount: number;
  dailyBuyCount: number;
  dailySellCount: number;
  lastTradeResetAt: string | null;
  tradeLimits: {
    dailyBuyCount: number;
    dailySellCount: number;
    dailyBuyLimit: number;
    dailySellLimit: number;
    bonusTrades: number;
    currentVipLevel: number;
  };
  isCapitalUnlocked: boolean;
  capitalUnlocked: boolean;
  capitalUnlockedAt: string | null;
  capitalTransferredAt: string | null;
}

interface WalletSummaryResponse {
  wallet: WalletResponse;
  recentLedger: WalletHistoryEntry[];
  botSubscriptions: Array<{
    planName: string;
    status: "active" | "completed";
  }>;
  trades: Array<{
    id: string;
    nftId: string;
    userId: string;
    buyPrice: number;
    sellPrice: number | null;
    profit: number | null;
    status: "bought" | "listed" | "auto_sold";
    listedAt: string | null;
    autoSellAt: string | null;
    soldAt: string | null;
    saleJobId: string | null;
    source: "manual" | "bot";
    botSubscriptionId: string | null;
    createdAt: string;
    nft?: {
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
    } | null;
  }>;
}

function buildHolding(item: NFTItem): PortfolioHolding {
  const totalInvested = item.listedPrice ?? item.currentPrice;
  const currentValue = item.listedPrice ?? item.currentPrice;

  return {
    id: item.id,
    nftSlug: item.slug,
    tokenId: item.tokenId,
    units: 1,
    totalInvested,
    currentValue,
    purchasedAt: totalInvested,
    profit: Number((currentValue - totalInvested).toFixed(2)),
    status: item.listedPrice !== null ? "Listed" : "Held",
    lastTrade: item.listedPrice !== null ? "Live listing" : "Owned",
    contractAddress: item.contractAddress,
  };
}

export function usePortfolio() {
  const { fullAddress, isConnected } = useWallet();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [ownedNfts, setOwnedNfts] = useState<NFTItem[]>([]);
  const [recentLedger, setRecentLedger] = useState<WalletHistoryEntry[]>([]);
  const [activePlanName, setActivePlanName] = useState("No bot plan");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!isConnected || !fullAddress) {
      setWallet(null);
      setOwnedNfts([]);
      setRecentLedger([]);
      setActivePlanName("No bot plan");
      setError(null);
      setHasLoaded(false);
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const summaryResponse = await fetchJson<WalletSummaryResponse>(
        `/api/wallet/summary?walletAddress=${fullAddress}`,
        { signal },
      );

      const sortedOpenTrades = summaryResponse.trades
        .filter((trade) => trade.status !== "auto_sold")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const currentBotTrade = sortedOpenTrades.find((trade) => trade.source === "bot") ?? null;
      const openTrades = new Map<string, NFTItem>();
      for (const trade of sortedOpenTrades) {
        if (trade.source === "bot" && trade.id !== currentBotTrade?.id) {
          continue;
        }

        const item = adaptBackendTradeToItem(trade, fullAddress);
        if (item) {
          openTrades.set(item.id, item);
        }
      }

      setWallet(summaryResponse.wallet);
      setRecentLedger(summaryResponse.recentLedger ?? []);
      setActivePlanName(
        summaryResponse.botSubscriptions.find((subscription) => subscription.status === "active")?.planName ??
          summaryResponse.botSubscriptions[0]?.planName ??
          "No bot plan",
      );
      setOwnedNfts(
        Array.from(openTrades.values()).sort((left, right) => right.tokenId - left.tokenId),
      );
      setHasLoaded(true);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load portfolio.");
      setWallet(null);
      setOwnedNfts([]);
      setRecentLedger([]);
    } finally {
      if (!signal?.aborted) {
        setIsRefreshing(false);
      }
    }
  }, [fullAddress, isConnected]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    void refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        console.info(`[perf.ui] page=portfolio loadMs=${Math.round(performance.now() - startedAt)}`);
      }
    });

    return () => controller.abort();
  }, [refresh]);

  const holdings = useMemo(() => ownedNfts.map(buildHolding), [ownedNfts]);
  const nftValue = holdings.reduce((total, item) => total + item.currentValue, 0);
  const pendingProceeds = holdings
    .filter((item) => item.status === "Listed")
    .reduce((total, item) => total + item.currentValue, 0);
  const floorExposure = ownedNfts.reduce((total, item) => total + item.floorPrice, 0);
  const liquidBalance = wallet ? wallet.tradingWallet + wallet.withdrawalWallet : 0;
  const gxnTokenUsdValue = wallet?.gxnTokenUsdValue ?? 0;
  const totalPortfolioBalance = liquidBalance + gxnTokenUsdValue + nftValue;

  return {
    source: "api" as const,
    error,
    isRefreshing,
    isLoading: isRefreshing && !hasLoaded,
    hasLoaded,
    holdings,
    ownedNfts,
    wallet,
    recentLedger,
    liveListings: [],
    activity: [],
    summary: {
      totalBalance: Number(totalPortfolioBalance.toFixed(2)),
      nftValue: Number(nftValue.toFixed(2)),
      liquidBnb: Number(liquidBalance.toFixed(2)),
      gxnTokenUsdValue: Number(gxnTokenUsdValue.toFixed(2)),
      pendingProceeds: Number(pendingProceeds.toFixed(2)),
      floorExposure: Number(floorExposure.toFixed(2)),
      availableToSpend: Number((wallet?.tradingWallet ?? 0).toFixed(2)),
    },
    dashboard: {
      totalPortfolioBalance: Number(totalPortfolioBalance.toFixed(2)),
      dailyPnl: 0,
      liveListings: holdings.filter((item) => item.status === "Listed").length,
      ownedNfts: ownedNfts.length,
      activePlan: activePlanName,
    },
    activePlan: {
      badge: activePlanName === "No bot plan" ? "None" : "Live",
    },
    refresh,
  };
}
