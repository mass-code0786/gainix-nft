"use client";

import { usePortfolio } from "@/hooks/usePortfolio";

export function useWalletSummary() {
  return usePortfolio();
}
