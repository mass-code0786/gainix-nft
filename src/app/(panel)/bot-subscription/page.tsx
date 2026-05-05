"use client";

import { useState } from "react";
import { ActiveBotPreview } from "@/components/bot-pass/active-bot-preview";
import { BotActivityTimeline } from "@/components/bot-pass/bot-activity-timeline";
import { BotPlanCard } from "@/components/bot-pass/bot-plan-card";
import { AnimatedPage } from "@/components/ui/animated-page";
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { useBotSubscription } from "@/hooks/useBotSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import type { BotAutomationPlan } from "@/types";

function formatLatestAction(label: string | null | undefined) {
  if (!label) {
    return "Waiting for next bot cycle";
  }

  if (label === "AUTO_BUY") {
    return "Auto Bought NFT";
  }

  if (label === "AUTO_LIST") {
    return "Listed For Sell";
  }

  if (label === "AUTO_SELL") {
    return "Auto Sold";
  }

  return label;
}

async function readApiError(response: Response) {
  if (response.status === 401) {
    return "Please reconnect wallet and try again";
  }

  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? "Bot purchase failed.";
  } catch {
    return "Bot purchase failed.";
  }
}

function safeCounter(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export default function BotSubscriptionPage() {
  const { fullAddress, isConnected } = useWallet();
  const walletAuth = useWalletAuth(fullAddress);
  const {
    plans,
    activeSubscription,
    timeline,
    latestActivity,
    todayBotProfit,
    totalBotProfit,
    progress,
    status,
    isLoading,
    refresh,
  } = useBotSubscription();
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  async function handleBuy(plan: BotAutomationPlan) {
    if (!fullAddress) {
      return;
    }

    setIsPurchasing(plan.planId);
    setPurchaseMessage(null);
    setPurchaseError(null);

    try {
      await walletAuth.ensureVerifiedSession();
      const response = await fetch("/api/bot/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: fullAddress,
          planId: plan.planId,
          packageId: plan.planId,
          price: plan.price,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as { message?: string };
      setPurchaseMessage(payload.message ?? "Bot plan purchased successfully.");
      await refresh();
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : "Bot purchase failed.");
    } finally {
      setIsPurchasing(null);
    }
  }

  return (
    <AnimatedPage>
      <div className="section-shell lux-card">
        <h1 className="font-display text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem]">
          Auto Trading Bot
        </h1>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {isLoading && plans.length === 0 ? (
          <>
            <SkeletonBlock className="h-36" />
            <SkeletonBlock className="h-36" />
            <SkeletonBlock className="h-36" />
          </>
        ) : plans.map((plan) => (
          <BotPlanCard
            key={plan.planId}
            name={plan.planName}
            price={plan.price}
            buyLimit={plan.buyTrades}
            sellLimit={plan.sellTrades}
            onBuy={() => void handleBuy(plan)}
            isDisabled={!isConnected || Boolean(isPurchasing)}
            isLoading={isPurchasing === plan.planId}
          />
        ))}
      </div>

      {isLoading ? (
        <SkeletonBlock className="h-64" />
      ) : (
        <ActiveBotPreview
          botName={activeSubscription?.planName ?? "No Active Bot"}
          statusLabel={
            activeSubscription
              ? activeSubscription.status === "completed"
                ? "Completed"
                : "Running"
              : status === "fallback"
                ? "Paused"
                : "Paused"
          }
          completedBuyTrades={
            activeSubscription
              ? `${safeCounter(activeSubscription.totalBuyTradesCompleted)} / ${safeCounter(activeSubscription.buyLimit)}`
              : "0 / 0"
          }
          completedSellTrades={
            activeSubscription
              ? `${safeCounter(activeSubscription.totalSellTradesCompleted)} / ${safeCounter(activeSubscription.sellLimit)}`
              : "0 / 0"
          }
          remainingTrades={
            activeSubscription
              ? `${safeCounter(activeSubscription.remainingTrades)}`
              : "0"
          }
          progress={progress}
          todayProfit={todayBotProfit}
          totalProfit={totalBotProfit}
          latestAction={formatLatestAction(latestActivity?.action)}
        />
      )}

      <BotActivityTimeline activity={timeline} />

      {purchaseMessage ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {purchaseMessage}
        </div>
      ) : null}
      {purchaseError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {purchaseError}
        </div>
      ) : null}
      {walletAuth.signPrompt && isConnected ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
          {walletAuth.signPrompt}
        </div>
      ) : null}
    </AnimatedPage>
  );
}
