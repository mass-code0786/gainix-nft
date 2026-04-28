"use client";

import { useWallet } from "@/hooks/useWallet";
import { getMockNotifications, getMockTransactions } from "@/lib/data-sources/mock-source";
import { gainixUseMockFallback } from "@/lib/web3/network-config";
import { isSameAddress } from "@/lib/web3/wallet-utils";

export function useTransactions() {
  const source = gainixUseMockFallback ? "mock" : "chain";
  const { address, isConnected } = useWallet();
  const transactionsData = getMockTransactions();
  const notificationData = getMockNotifications();
  const transactions = isConnected
    ? transactionsData.filter(
        (item) => isSameAddress(item.from, address) || isSameAddress(item.to, address),
      )
    : [];
  const relevantNotifications = isConnected ? notificationData : [];

  return {
    source,
    transactions,
    notifications: relevantNotifications,
    unreadCount: relevantNotifications.filter((item) => !item.read).length,
    refresh: async () => Promise.resolve(),
  };
}
