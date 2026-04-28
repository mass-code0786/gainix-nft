"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bot,
  CircleDollarSign,
  Crown,
  Gem,
  Layers3,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { WalletActionPanel } from "@/components/wallet/wallet-action-panel";
import { incomeCategoryMeta, incomeCategoryOrder } from "@/data/income";
import { useBotSubscription } from "@/hooks/useBotSubscription";
import { useIncome } from "@/hooks/useIncome";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useRegistration } from "@/hooks/useRegistration";
import { useTeam } from "@/hooks/useTeam";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/utils/format";

const incomeIcons = {
  nftTradingIncome: Gem,
  botTradingIncome: Bot,
  referralIncome: Users,
  levelIncome: Layers3,
  royaltyIncome: Crown,
} as const;

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 truncate font-display text-2xl font-semibold text-white">
            {value}
          </p>
          {detail ? <p className="mt-1 truncate text-sm text-zinc-400">{detail}</p> : null}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-100">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,7,9,0.94),rgba(8,8,12,0.98))] p-4 sm:p-5">
      <p className="muted-label">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function latestActionLabel(action: string | undefined) {
  if (action === "AUTO_BUY") {
    return "Auto Buy";
  }

  if (action === "AUTO_LIST") {
    return "Auto List";
  }

  if (action === "AUTO_SELL") {
    return "Auto Sell";
  }

  return "Waiting";
}

export default function DashboardPage() {
  const {
    fullAddress: walletAddress,
    shortAddress,
    isConnected,
    isWalletHydrating,
    hasResolvedWalletSession,
  } = useWallet();
  const { isRegistered, isCheckingRegistration } = useRegistration(walletAddress, isConnected);
  const {
    wallet,
    refresh: refreshPortfolio,
    error: portfolioError,
  } = usePortfolio();
  const { categories: incomeCategories, error: incomeError } = useIncome();
  const {
    activeSubscription,
    latestActivity,
    todayBotProfit,
    status: botStatus,
  } = useBotSubscription();
  const { data: teamData, error: teamError } = useTeam();

  if (!hasResolvedWalletSession || isWalletHydrating || isCheckingRegistration) {
    return (
      <AnimatedPage>
        <div className="section-shell lux-card">
          <p className="muted-label">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Checking wallet</h1>
        </div>
      </AnimatedPage>
    );
  }

  if (!isConnected) {
    return (
      <AnimatedPage>
        <div className="section-shell lux-card space-y-4">
          <p className="muted-label">Dashboard</p>
          <h1 className="font-display text-3xl font-semibold text-white">Connect wallet</h1>
          <Link href="/connect" className="premium-button w-full sm:w-fit">
            Open connect page
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  if (!isRegistered) {
    return (
      <AnimatedPage>
        <div className="section-shell lux-card space-y-4">
          <p className="muted-label">Dashboard</p>
          <h1 className="font-display text-3xl font-semibold text-white">Register wallet</h1>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {shortAddress}
          </div>
          <Link href="/" className="premium-button w-full sm:w-fit">
            Register
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  const totalTeam =
    teamData?.levelBreakdown.reduce((total, item) => total + item.downlineCount, 0) ?? 0;
  const vipLevel = teamData?.royalty.currentVipLevel ?? teamData?.vipStatus.currentVipLevel ?? 0;
  const nextVipLevel = teamData?.royalty.nextVipLevel ?? teamData?.vipStatus.nextVipLevel ?? null;
  const completedCycles = activeSubscription
    ? `${activeSubscription.completedCycles} / ${activeSubscription.totalCycles}`
    : "0 / 0";

  return (
    <AnimatedPage>
      <WalletActionPanel
        walletAddress={walletAddress}
        tradingWallet={wallet?.tradingWallet ?? 0}
        withdrawalWallet={wallet?.withdrawalWallet ?? 0}
        totalBuyCount={wallet?.totalBuyCount ?? wallet?.buyCount ?? 0}
        totalSellCount={wallet?.totalSellCount ?? wallet?.sellCount ?? 0}
        dailyBuyCount={wallet?.tradeLimits.dailyBuyCount ?? wallet?.dailyBuyCount ?? 0}
        dailySellCount={wallet?.tradeLimits.dailySellCount ?? wallet?.dailySellCount ?? 0}
        dailyBuyLimit={wallet?.tradeLimits.dailyBuyLimit ?? 6}
        dailySellLimit={wallet?.tradeLimits.dailySellLimit ?? 6}
        currentVipLevel={wallet?.tradeLimits.currentVipLevel ?? vipLevel}
        bonusTrades={wallet?.tradeLimits.bonusTrades ?? 0}
        capitalUnlocked={wallet?.capitalUnlocked ?? wallet?.isCapitalUnlocked ?? false}
        capitalTransferredAt={wallet?.capitalTransferredAt ?? null}
        onRefresh={refreshPortfolio}
      />

      {(portfolioError || incomeError || teamError) ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {portfolioError ?? incomeError ?? teamError}
        </div>
      ) : null}

      <SectionShell title="Income Overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {incomeCategoryOrder.map((key) => {
            const category = incomeCategories.find((item) => item.key === key);
            const Icon = incomeIcons[key];

            return (
              <SummaryCard
                key={key}
                label={incomeCategoryMeta[key].label}
                value={formatCurrency(category?.total ?? 0)}
                detail={`${formatCurrency(category?.today ?? 0)} today`}
                icon={Icon}
              />
            );
          })}
        </div>
      </SectionShell>

      <SectionShell title="Bot Status">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Active Plan"
            value={activeSubscription?.planName ?? "None"}
            detail={botStatus === "active" ? "Running" : "Inactive"}
            icon={Bot}
          />
          <SummaryCard
            label="Completed Cycles"
            value={completedCycles}
            icon={Layers3}
          />
          <SummaryCard
            label="Today Bot Profit"
            value={formatCurrency(todayBotProfit)}
            icon={CircleDollarSign}
          />
          <SummaryCard
            label="Latest Action"
            value={latestActionLabel(latestActivity?.action)}
            detail={latestActivity ? formatCurrency(latestActivity.amount) : undefined}
            icon={Network}
          />
        </div>
        <Link href="/bot-subscription" className="secondary-button mt-4 w-full sm:w-fit">
          Auto Trading Bot
        </Link>
      </SectionShell>

      <SectionShell title="Team Summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Total Team"
            value={`${totalTeam}`}
            icon={Users}
          />
          <SummaryCard
            label="Referral Team"
            value={`${teamData?.directCount ?? 0}`}
            icon={Network}
          />
          <SummaryCard
            label="VIP/Royalty"
            value={`VIP ${vipLevel}`}
            detail={nextVipLevel ? `Next VIP ${nextVipLevel}` : "Max status"}
            icon={Crown}
          />
        </div>
      </SectionShell>
    </AnimatedPage>
  );
}
