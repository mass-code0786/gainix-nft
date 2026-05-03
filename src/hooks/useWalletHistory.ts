"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/client";
import { useWallet } from "@/hooks/useWallet";

export type WalletHistoryType =
  | "DEPOSIT_TO_TRADING"
  | "NFT_BUY_DEBIT"
  | "NFT_SELL_PRINCIPAL_RETURN"
  | "BOT_PURCHASE"
  | "NFT_TRADING_PROFIT"
  | "BOT_PURCHASE_UPLINE_INCOME"
  | "BOT_TRADING_PROFIT"
  | "LEVEL_INCOME"
  | "ROYALTY_INCOME"
  | "CAPITAL_TRANSFER"
  | "CAPITAL_TRANSFER_TO_WITHDRAWAL"
  | "WITHDRAWAL_REQUEST"
  | "WITHDRAWAL_FEE"
  | "GXN_TOKEN_REWARD"
  | "GXN_TOKEN_DEDUCTION";

export type WalletHistoryCategory =
  | "NFT_TRADING"
  | "BOT"
  | "REFERRAL"
  | "ROYALTY"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BONUS";

export interface WalletHistoryEntry {
  id: string;
  type: WalletHistoryType;
  title: string | null;
  description: string | null;
  category: WalletHistoryCategory;
  amount: number;
  createdAt: string;
  status: "Completed" | "Requested" | "Approved" | "Approved Pending TX" | "Active";
  walletAffected: "Trading Wallet" | "Withdrawal Wallet" | "Income Wallet" | "GXN Token";
  referenceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

interface WalletHistoryResponse {
  total: number;
  history: WalletHistoryEntry[];
}

export function useWalletHistory() {
  const { fullAddress, isConnected } = useWallet();
  const [history, setHistory] = useState<WalletHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!isConnected || !fullAddress) {
      setHistory([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchJson<WalletHistoryResponse>(
        `/api/wallet/history?walletAddress=${fullAddress}`,
        { signal },
      );
      setHistory(response.history);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Unable to load wallet history.");
      setHistory([]);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [fullAddress, isConnected]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    void refresh(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        console.info(`[perf.ui] page=wallet-history loadMs=${Math.round(performance.now() - startedAt)}`);
      }
    });

    return () => controller.abort();
  }, [refresh]);

  return {
    history,
    isLoading,
    error,
    refresh,
  };
}
