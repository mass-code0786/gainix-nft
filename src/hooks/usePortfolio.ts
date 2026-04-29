"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBotSubscription } from "@/hooks/useBotSubscription";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";
import { adaptBackendTradeToItem } from "@/lib/api/nft-adapters";
import type { NFTItem, PortfolioHolding } from "@/types";

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

interface TradesHistoryResponse {
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
  const { liveListings, source: marketSource, refresh: refreshMarket, isRefreshing: isRefreshingMarket } = useMarketplaceListings();
  const { activeSubscription } = useBotSubscription();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [ownedNfts, setOwnedNfts] = useState<NFTItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnected || !fullAddress) {
      setWallet(null);
      setOwnedNfts([]);
      setError(null);
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const [walletResponse, tradesResponse] = await Promise.all([
        fetchJson<WalletResponse>(`/api/wallet?walletAddress=${fullAddress}`),
        fetchJson<TradesHistoryResponse>(`/api/trades/history?walletAddress=${fullAddress}`),
        refreshMarket(),
      ]);

      const openTrades = new Map<string, NFTItem>();
      for (const trade of tradesResponse.trades) {
        if (trade.status === "auto_sold") {
          continue;
        }

        const item = adaptBackendTradeToItem(trade, fullAddress);
        if (item) {
          openTrades.set(item.id, item);
        }
      }

      setWallet(walletResponse);
      setOwnedNfts(
        Array.from(openTrades.values()).sort((left, right) => right.tokenId - left.tokenId),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load portfolio.");
      setWallet(null);
      setOwnedNfts([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fullAddress, isConnected, refreshMarket]);

  useEffect(() => {
    void refresh();
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
    source: marketSource,
    error,
    isRefreshing: isRefreshing || isRefreshingMarket,
    holdings,
    ownedNfts,
    wallet,
    liveListings,
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
      activePlan: activeSubscription?.planName ?? "No bot plan",
    },
    activePlan: {
      badge: activeSubscription ? "Live" : "None",
    },
    refresh,
  };
}
