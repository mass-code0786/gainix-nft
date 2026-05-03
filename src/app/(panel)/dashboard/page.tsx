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
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { WalletActionPanel } from "@/components/wallet/wallet-action-panel";
import { incomeCategoryMeta, incomeCategoryOrder } from "@/data/income";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useRegistration } from "@/hooks/useRegistration";
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
  compact = false,
  detailClassName = "text-zinc-400",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  compact?: boolean;
  detailClassName?: string;
}) {
  return (
    <div className={`rounded-[22px] border border-white/10 bg-black/25 ${compact ? "p-3 sm:p-4" : "p-4"}`}>
      <div className={`flex items-start justify-between ${compact ? "gap-2 sm:gap-3" : "gap-3"}`}>
        <div className="min-w-0">
          <p
            className={
              compact
                ? "text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]"
                : "text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500"
            }
          >
            {label}
          </p>
          <p
            className={
              compact
                ? "mt-2 truncate font-display text-[1.15rem] font-semibold leading-tight text-white sm:text-2xl"
                : "mt-2 truncate font-display text-2xl font-semibold text-white"
            }
          >
            {value}
          </p>
          {detail ? (
            <p className={`mt-1 truncate ${compact ? "text-xs sm:text-sm" : "text-sm"} ${detailClassName}`}>
              {detail}
            </p>
          ) : null}
        </div>
        <div
          className={`grid shrink-0 place-items-center border border-red-400/20 bg-red-500/10 text-red-100 ${
            compact ? "h-8 w-8 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl" : "h-10 w-10 rounded-2xl"
          }`}
        >
          <Icon className={compact ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5"} />
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

function TeamSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "red",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "red" | "green";
}) {
  const isGreen = tone === "green";

  return (
    <div
      className={`h-full rounded-2xl border p-3 shadow-[0_0_28px_rgba(239,68,68,0.12)] sm:p-4 ${
        isGreen
          ? "border-green-500/30 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_34%),linear-gradient(155deg,rgba(9,18,12,0.92),rgba(6,8,8,0.96))] shadow-[0_0_28px_rgba(34,197,94,0.12)]"
          : "border-red-500/20 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_34%),linear-gradient(155deg,rgba(25,8,10,0.92),rgba(8,8,12,0.96))]"
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">{label}</p>
          <p className={`mt-2 truncate font-display text-[1.15rem] font-semibold leading-tight sm:text-2xl ${isGreen ? "text-green-400" : "text-white"}`}>
            {value}
          </p>
          {detail ? <p className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">{detail}</p> : null}
        </div>
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border sm:h-10 sm:w-10 sm:rounded-2xl ${
            isGreen
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-400/20 bg-red-500/10 text-red-100"
          }`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
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

function formatActivePlanAmount(price: number | undefined) {
  if (typeof price !== "number") {
    return "No Active Plan";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

function ActivePlanCard({
  price,
  isRunning,
}: {
  price?: number;
  isRunning: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/25 p-3 text-center sm:p-4">
      <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">
        Active Plan
      </p>
      <p className="mt-2 whitespace-normal break-words font-display text-xl font-bold leading-tight text-white">
        {formatActivePlanAmount(price)}
      </p>
      {isRunning ? <p className="mt-1 text-xs text-zinc-400 sm:text-sm">Running</p> : null}
    </div>
  );
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
  const dashboard = useDashboardSummary();
  const {
    wallet,
    refresh: refreshPortfolio,
    error: portfolioError,
    isLoading: isWalletDataLoading,
  } = dashboard.portfolio;
  const { categories: incomeCategories, error: incomeError, isLoading: isIncomeLoading } = dashboard.income;
  const {
    activeSubscription,
    latestActivity,
    todayBotProfit,
    status: botStatus,
    isLoading: isBotLoading,
  } = dashboard.bot;
  const { data: teamData, error: teamError, isLoading: isTeamLoading } = dashboard.team;

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
      {isWalletDataLoading ? (
        <SkeletonBlock className="h-96" />
      ) : (
        <WalletActionPanel
          walletAddress={walletAddress}
          tradingWallet={wallet?.tradingWallet ?? 0}
          withdrawalWallet={wallet?.withdrawalWallet ?? 0}
          gxnTokenBalance={wallet?.gxnTokenBalance ?? 0}
          gxnTokenValueUsd={wallet?.gxnTokenValueUsd ?? 0.05}
          gxnTokenUsdValue={wallet?.gxnTokenUsdValue ?? 0}
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
      )}

      {(portfolioError || incomeError || teamError) ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {portfolioError ?? incomeError ?? teamError}
        </div>
      ) : null}

      <SectionShell title="Income Overview">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {isIncomeLoading ? (
            <>
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
            </>
          ) : incomeCategoryOrder.map((key) => {
            const category = incomeCategories.find((item) => item.key === key);
            const Icon = incomeIcons[key];

            return (
              <SummaryCard
                key={key}
                label={incomeCategoryMeta[key].label}
                value={formatCurrency(category?.total ?? 0)}
                detail={`+${formatCurrency(category?.today ?? 0)} today`}
                detailClassName="font-semibold text-emerald-400"
                icon={Icon}
                compact
              />
            );
          })}
        </div>
      </SectionShell>

      <SectionShell title="Bot Status">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {isBotLoading ? (
            <>
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
            </>
          ) : (
            <>
              <ActivePlanCard price={activeSubscription?.price} isRunning={botStatus === "active"} />
              <SummaryCard
                label="Completed Cycles"
                value={completedCycles}
                icon={Layers3}
                compact
              />
              <SummaryCard
                label="Today Bot Profit"
                value={formatCurrency(todayBotProfit)}
                icon={CircleDollarSign}
                compact
              />
              <SummaryCard
                label="Latest Action"
                value={latestActionLabel(latestActivity?.action)}
                detail={latestActivity ? formatCurrency(latestActivity.amount) : undefined}
                icon={Network}
                compact
              />
            </>
          )}
        </div>
        <Link href="/bot-subscription" className="secondary-button mt-4 w-full sm:w-fit">
          Auto Trading Bot
        </Link>
      </SectionShell>

      <div className="pb-20 sm:pb-0">
        <SectionShell title="Team Summary">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {isTeamLoading ? (
              <>
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
              </>
            ) : (
              <>
                <TeamSummaryCard
                  label="Total Team"
                  value={`${totalTeam}`}
                  icon={Users}
                />
                <TeamSummaryCard
                  label="Referral Team"
                  value={`${teamData?.directCount ?? 0}`}
                  icon={Network}
                />
                <TeamSummaryCard
                  label="VIP/Royalty"
                  value={`VIP ${vipLevel}`}
                  detail={nextVipLevel ? `Next VIP ${nextVipLevel}` : "Max status"}
                  icon={Crown}
                />
              </>
            )}
          </div>
        </SectionShell>
      </div>
    </AnimatedPage>
  );
}
