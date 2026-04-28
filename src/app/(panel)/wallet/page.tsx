"use client";

import { useCallback } from "react";
import { CircleDollarSign, Clock3, Gem, Layers3, WalletCards } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { StatCard } from "@/components/ui/stat-card";
import { WalletActionPanel } from "@/components/wallet/wallet-action-panel";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWalletHistory, type WalletHistoryEntry, type WalletHistoryType } from "@/hooks/useWalletHistory";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/utils/format";

const historyLabels: Record<WalletHistoryType, string> = {
  DEPOSIT_TO_TRADING: "Deposit",
  NFT_BUY_DEBIT: "NFT Buy Debit",
  NFT_SELL_PRINCIPAL_RETURN: "Principal Return",
  NFT_TRADING_PROFIT: "Trading Profit",
  BOT_PURCHASE_UPLINE_INCOME: "Bot Income",
  BOT_TRADING_PROFIT: "Bot Income",
  LEVEL_INCOME: "Level Income",
  ROYALTY_INCOME: "Royalty Income",
  CAPITAL_TRANSFER: "Capital Transfer",
  CAPITAL_TRANSFER_TO_WITHDRAWAL: "Capital Transfer",
  WITHDRAWAL_REQUEST: "Withdrawal Request",
  WITHDRAWAL_FEE: "Withdrawal Fee",
};

const debitTypes = new Set<WalletHistoryType>([
  "NFT_BUY_DEBIT",
  "WITHDRAWAL_REQUEST",
  "WITHDRAWAL_FEE",
]);

function WalletHistoryRow({ entry }: { entry: WalletHistoryEntry }) {
  const isDebit = debitTypes.has(entry.type);

  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,rgba(22,9,11,0.9),rgba(8,8,12,0.96))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">{historyLabels[entry.type]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {entry.walletAffected}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {entry.status}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(entry.createdAt).toLocaleString()}
          </p>
        </div>
        <div className={`shrink-0 text-right font-display text-lg font-semibold ${isDebit ? "text-rose-200" : "text-emerald-200"}`}>
          {isDebit ? "-" : "+"}
          {formatCurrency(entry.amount)}
        </div>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { summary, wallet, refresh } = usePortfolio();
  const { history, isLoading: isHistoryLoading, error: historyError, refresh: refreshHistory } = useWalletHistory();
  const { fullAddress, shortAddress, chainName, isConnected } = useWallet();

  const refreshWalletData = useCallback(async () => {
    await Promise.all([refresh(), refreshHistory()]);
  }, [refresh, refreshHistory]);

  return (
    <AnimatedPage>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total balance" value={formatCurrency(summary.totalBalance)} detail="Wallet + collection" icon={WalletCards} />
        <StatCard label="Cash Balance" value={formatCurrency(summary.liquidBnb)} detail="Available now" icon={CircleDollarSign} tone="positive" />
        <StatCard label="Collection value" value={formatCurrency(summary.nftValue)} detail="Held NFTs" icon={Gem} />
        <StatCard label="Pending proceeds" value={formatCurrency(summary.pendingProceeds)} detail="Listed for sale" icon={Layers3} />
      </div>

      <div className="section-shell space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-200">{shortAddress}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300">{chainName}</span>
          <span
            className={`rounded-full border px-3 py-1 text-sm ${
              isConnected
                ? "border-gainix-400/20 bg-gainix-500/10 text-gainix-100"
                : "border-white/10 bg-white/5 text-zinc-400"
            }`}
          >
            {isConnected ? "Connected session" : "Disconnected"}
          </span>
        </div>
      </div>

      <WalletActionPanel
        walletAddress={fullAddress}
        tradingWallet={wallet?.tradingWallet ?? 0}
        withdrawalWallet={wallet?.withdrawalWallet ?? 0}
        totalBuyCount={wallet?.totalBuyCount ?? wallet?.buyCount ?? 0}
        totalSellCount={wallet?.totalSellCount ?? wallet?.sellCount ?? 0}
        dailyBuyCount={wallet?.tradeLimits.dailyBuyCount ?? wallet?.dailyBuyCount ?? 0}
        dailySellCount={wallet?.tradeLimits.dailySellCount ?? wallet?.dailySellCount ?? 0}
        dailyBuyLimit={wallet?.tradeLimits.dailyBuyLimit ?? 6}
        dailySellLimit={wallet?.tradeLimits.dailySellLimit ?? 6}
        currentVipLevel={wallet?.tradeLimits.currentVipLevel ?? 0}
        bonusTrades={wallet?.tradeLimits.bonusTrades ?? 0}
        capitalUnlocked={wallet?.capitalUnlocked ?? wallet?.isCapitalUnlocked ?? false}
        capitalTransferredAt={wallet?.capitalTransferredAt ?? null}
        onRefresh={refreshWalletData}
      />

      <section className="section-shell space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="muted-label">Wallet Transaction History</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Recent ledger entries
            </h2>
          </div>
          <button type="button" onClick={() => void refreshHistory()} className="secondary-button w-full sm:w-auto">
            Refresh
          </button>
        </div>

        {historyError ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {historyError}
          </div>
        ) : null}

        {isHistoryLoading ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            Loading wallet history.
          </div>
        ) : null}

        {!isHistoryLoading && history.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5 text-sm text-zinc-300">
            No wallet ledger entries yet.
          </div>
        ) : null}

        <div className="grid gap-3">
          {history.slice(0, 25).map((entry) => (
            <WalletHistoryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </AnimatedPage>
  );
}
