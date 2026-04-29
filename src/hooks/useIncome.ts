"use client";

import { useEffect, useMemo, useState } from "react";
import { incomeCategoryMeta, incomeCategoryOrder } from "@/data/income";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";
import type { IncomeHistoryRecord, IncomeOverview } from "@/types";

interface BackendIncomeEntry {
  id: string;
  type: string;
  amount: number;
  sourceTradeId: string;
  level: number | null;
  sourceUserId: string | null;
  vipLevel?: number | null;
  payoutDate?: string | null;
  createdAt: string;
}

interface BackendIncomeCategory {
  total: number;
  today: number;
  weekly: number;
  monthly: number;
}

interface BackendIncomeOverviewResponse {
  nftTradingIncome: BackendIncomeCategory;
  levelIncome: BackendIncomeCategory;
  botTradingIncome: BackendIncomeCategory;
  botPurchaseUplineIncome: BackendIncomeCategory;
  royaltyIncome: BackendIncomeCategory;
  history: BackendIncomeEntry[];
}

function toHistoryRecord(entry: BackendIncomeEntry): IncomeHistoryRecord {
  const label =
    entry.type === "NFT_TRADING_INCOME" || entry.type === "BOT_TRADING_INCOME"
      ? "NFT Trading Income"
      : entry.type === "LEVEL_INCOME"
        ? `Level Income${entry.level ? ` L${entry.level}` : ""}`
        : entry.type === "BOT_PURCHASE_UPLINE_INCOME"
          ? "Referral Income"
          : entry.type === "ROYALTY_INCOME"
            ? `VIP ${entry.vipLevel ?? ""} Royalty Income`.trim()
            : "Bot Trading Income";

  return {
    id: entry.id,
    title: label,
    description: `${label} credited to your Gainix account ledger.`,
    amount: entry.amount,
    status: "Credited",
    date: new Date(entry.createdAt).toLocaleString(),
    reference: entry.sourceTradeId,
  };
}

function lastCreditedDate(history: IncomeHistoryRecord[]) {
  return history[0]?.date ?? "No credits yet";
}

export function useIncome() {
  const { fullAddress, isConnected } = useWallet();
  const [overview, setOverview] = useState<IncomeOverview>({
    nftTradingIncome: { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0, lastCreditedDate: "No credits yet", history: [] },
    botTradingIncome: { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0, lastCreditedDate: "No credits yet", history: [] },
    referralIncome: { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0, lastCreditedDate: "No credits yet", history: [] },
    levelIncome: { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0, lastCreditedDate: "No credits yet", history: [] },
    royaltyIncome: { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0, lastCreditedDate: "No credits yet", history: [] },
  });
  const [source, setSource] = useState<"api" | "idle">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !fullAddress) {
      setSource("idle");
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchJson<BackendIncomeOverviewResponse>(
          `/api/income?walletAddress=${fullAddress}`,
        );
        const history = response.history
          .slice()
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        const nftHistory = history
          .filter((entry) => entry.type === "NFT_TRADING_INCOME" || entry.type === "BOT_TRADING_INCOME")
          .map(toHistoryRecord);
        const referralHistory = history
          .filter((entry) => entry.type === "BOT_PURCHASE_UPLINE_INCOME")
          .map(toHistoryRecord);
        const botTradingHistory: IncomeHistoryRecord[] = [];
        const levelHistory = history
          .filter((entry) => entry.type === "LEVEL_INCOME")
          .map(toHistoryRecord);
        const royaltyHistory = history
          .filter((entry) => entry.type === "ROYALTY_INCOME")
          .map(toHistoryRecord);

        if (!isCancelled) {
          setOverview({
            nftTradingIncome: {
              ...response.nftTradingIncome,
              pending: 0,
              lastCreditedDate: lastCreditedDate(nftHistory),
              history: nftHistory,
            },
            botTradingIncome: {
              ...response.botTradingIncome,
              pending: 0,
              lastCreditedDate: lastCreditedDate(botTradingHistory),
              history: botTradingHistory,
            },
            referralIncome: {
              total: response.botPurchaseUplineIncome.total,
              today: response.botPurchaseUplineIncome.today,
              weekly: response.botPurchaseUplineIncome.weekly,
              monthly: response.botPurchaseUplineIncome.monthly,
              pending: 0,
              lastCreditedDate: lastCreditedDate(referralHistory),
              history: referralHistory,
            },
            levelIncome: {
              ...response.levelIncome,
              pending: 0,
              lastCreditedDate: lastCreditedDate(levelHistory),
              history: levelHistory,
            },
            royaltyIncome: {
              total: response.royaltyIncome.total,
              today: response.royaltyIncome.today,
              weekly: response.royaltyIncome.weekly,
              monthly: response.royaltyIncome.monthly,
              pending: 0,
              lastCreditedDate: lastCreditedDate(royaltyHistory),
              history: royaltyHistory,
            },
          });
          setSource("api");
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load income.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [fullAddress, isConnected]);

  const categories = useMemo(() => incomeCategoryOrder.map((key) => ({
    key,
    label: incomeCategoryMeta[key].label,
    ...overview[key],
  })), [overview]);

  const summary = categories.reduce(
    (accumulator, category) => ({
      total: accumulator.total + category.total,
      today: accumulator.today + category.today,
      weekly: accumulator.weekly + category.weekly,
      monthly: accumulator.monthly + category.monthly,
      pending: accumulator.pending + category.pending,
    }),
    { total: 0, today: 0, weekly: 0, monthly: 0, pending: 0 },
  );

  return {
    source,
    overview,
    categories,
    summary,
    isLoading,
    error,
    refresh: async () => {
      if (!isConnected || !fullAddress) {
        return;
      }

      const response = await fetchJson<BackendIncomeOverviewResponse>(
        `/api/income?walletAddress=${fullAddress}`,
      );
      const history = response.history
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const nftHistory = history
        .filter((entry) => entry.type === "NFT_TRADING_INCOME" || entry.type === "BOT_TRADING_INCOME")
        .map(toHistoryRecord);
      const botTradingHistory: IncomeHistoryRecord[] = [];
      const referralHistory = history.filter((entry) => entry.type === "BOT_PURCHASE_UPLINE_INCOME").map(toHistoryRecord);
      const levelHistory = history.filter((entry) => entry.type === "LEVEL_INCOME").map(toHistoryRecord);
      const royaltyHistory = history.filter((entry) => entry.type === "ROYALTY_INCOME").map(toHistoryRecord);

      setOverview({
        nftTradingIncome: { ...response.nftTradingIncome, pending: 0, lastCreditedDate: lastCreditedDate(nftHistory), history: nftHistory },
        botTradingIncome: { ...response.botTradingIncome, pending: 0, lastCreditedDate: lastCreditedDate(botTradingHistory), history: botTradingHistory },
        referralIncome: { total: response.botPurchaseUplineIncome.total, today: response.botPurchaseUplineIncome.today, weekly: response.botPurchaseUplineIncome.weekly, monthly: response.botPurchaseUplineIncome.monthly, pending: 0, lastCreditedDate: lastCreditedDate(referralHistory), history: referralHistory },
        levelIncome: { ...response.levelIncome, pending: 0, lastCreditedDate: lastCreditedDate(levelHistory), history: levelHistory },
        royaltyIncome: { total: response.royaltyIncome.total, today: response.royaltyIncome.today, weekly: response.royaltyIncome.weekly, monthly: response.royaltyIncome.monthly, pending: 0, lastCreditedDate: lastCreditedDate(royaltyHistory), history: royaltyHistory },
      });
      setSource("api");
    },
  };
}
