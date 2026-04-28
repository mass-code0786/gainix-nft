import type { Address } from "viem";
import { incomeOverview } from "@/data/income";
import {
  botPlans,
  botPerformanceTrend,
  botSubscriptionState,
  botTimeline,
  dashboardSummary,
  nfts,
  notifications,
  portfolioHoldings,
  recentTransactions,
  walletSummary,
} from "@/data/mock-data";
import { resolveNftImageUri } from "@/lib/web3/token-metadata";
import type { NFTItem } from "@/types";

const normalizedMockNfts = nfts.map((item) => ({
  ...item,
  imageUri: resolveNftImageUri({
    tokenUri: item.tokenUri,
    imageUri: item.imageUri,
    animalType: item.animalType,
    rarity: item.rarity,
  }),
}));
const normalizedMockNftsBySlug = new Map(normalizedMockNfts.map((item) => [item.slug, item]));

export function getMockNfts() {
  return normalizedMockNfts;
}

export function getMockNftBySlug(slug: string) {
  return normalizedMockNftsBySlug.get(slug);
}

export function getMockRelatedNfts(slugs: string[]) {
  return normalizedMockNfts.filter((item) => slugs.includes(item.slug));
}

export function getMockLiveListings() {
  return normalizedMockNfts.filter((item) => item.listedPrice !== null);
}

export function getMockPortfolioHoldings() {
  return portfolioHoldings;
}

export function getMockBotPlans() {
  return botPlans;
}

export function getMockBotTimeline() {
  return botTimeline;
}

export function getMockBotSubscriptionState() {
  return botSubscriptionState;
}

export function getMockBotPerformanceTrend() {
  return botPerformanceTrend;
}

export function getMockTransactions() {
  return recentTransactions;
}

export function getMockNotifications() {
  return notifications;
}

export function getMockWalletSummary() {
  return walletSummary;
}

export function getMockDashboardSummary() {
  return dashboardSummary;
}

export function getMockIncomeOverview() {
  return incomeOverview;
}

export function getWalletOwnedNfts(walletAddress?: Address | null): NFTItem[] {
  if (!walletAddress) {
    return [];
  }

  return normalizedMockNfts.filter((item) => item.owner.toLowerCase() === walletAddress.toLowerCase());
}
