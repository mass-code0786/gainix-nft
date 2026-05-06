"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";
import type {
  BotAutomationActivity,
  BotAutomationPlan,
  BotAutomationSubscription,
} from "@/types";

interface BotStatusResponse {
  plans: BotAutomationPlan[];
  subscriptions: BotAutomationSubscription[];
  activeSubscriptions: number;
  totalBuyTradesCompleted?: number;
  totalSellTradesCompleted?: number;
  buyLimit?: number;
  sellLimit?: number;
  remainingTrades?: number;
  progressPercent?: number;
  todayBotProfit: number;
  totalBotProfit: number;
  latestActivity: BotAutomationActivity | null;
}

interface BotSummaryResponse extends BotStatusResponse {
  activity: BotAutomationActivity[];
}

export function useBotSubscription() {
  const { fullAddress, isConnected } = useWallet();
  const [plans, setPlans] = useState<BotAutomationPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<BotAutomationSubscription[]>([]);
  const [timeline, setTimeline] = useState<BotAutomationActivity[]>([]);
  const [todayBotProfit, setTodayBotProfit] = useState(0);
  const [totalBotProfit, setTotalBotProfit] = useState(0);
  const [latestActivity, setLatestActivity] = useState<BotAutomationActivity | null>(null);
  const [status, setStatus] = useState<"active" | "inactive" | "fallback">("fallback");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !fullAddress) {
      setPlans([]);
      setSubscriptions([]);
      setTimeline([]);
      setTodayBotProfit(0);
      setTotalBotProfit(0);
      setLatestActivity(null);
      setStatus("inactive");
      return;
    }

    const controller = new AbortController();
    const startedAt = performance.now();

    async function load() {
      setIsLoading(true);

      try {
        const payload = await fetchJson<BotSummaryResponse>(
          `/api/bot/summary?walletAddress=${fullAddress}`,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) {
          return;
        }

        console.log("[bot.ui.api]", payload);
        console.log("[bot.history.api]", {
          tradeCount: new Set((payload.activity ?? []).map((entry) => entry.tradeId ?? entry.cycleId ?? entry.id.split(":")[0])).size,
          timelineRows: payload.activity?.length ?? 0,
          tradeIds: Array.from(new Set((payload.activity ?? []).map((entry) => entry.tradeId ?? entry.cycleId ?? entry.id.split(":")[0]))),
        });
        setPlans(payload.plans ?? []);
        setSubscriptions(payload.subscriptions ?? []);
        setTimeline(payload.activity ?? []);
        setTodayBotProfit(payload.todayBotProfit ?? 0);
        setTotalBotProfit(payload.totalBotProfit ?? 0);
        setLatestActivity(payload.latestActivity ?? null);
        setStatus(payload.activeSubscriptions > 0 ? "active" : "inactive");
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setPlans([]);
        setSubscriptions([]);
        setTimeline([]);
        setTodayBotProfit(0);
        setTotalBotProfit(0);
        setLatestActivity(null);
        setStatus("fallback");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          console.info(`[perf.ui] page=bot-subscription loadMs=${Math.round(performance.now() - startedAt)}`);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [fullAddress, isConnected]);

  const activeSubscription = useMemo(
    () =>
      subscriptions.find((subscription) => subscription.status === "active") ??
      subscriptions[0] ??
      null,
    [subscriptions],
  );

  const progress = useMemo(() => {
    if (!activeSubscription) {
      return 0;
    }

    const progressPercent = Number(activeSubscription.progressPercent);

    const progress = Number.isFinite(progressPercent)
      ? Math.min(100, Math.max(0, Math.floor(progressPercent)))
      : 0;
    console.log("[bot.progress.ui]", {
      subscriptionId: activeSubscription.id,
      userId: activeSubscription.userId,
      totalBuyTradesCompleted: activeSubscription.totalBuyTradesCompleted,
      totalSellTradesCompleted: activeSubscription.totalSellTradesCompleted,
      buyLimit: activeSubscription.buyLimit,
      sellLimit: activeSubscription.sellLimit,
      remainingTrades: activeSubscription.remainingTrades,
      progressPercent: progress,
    });

    return progress;
  }, [activeSubscription]);

  return {
    plans,
    subscriptions,
    timeline,
    activeSubscription,
    latestActivity,
    todayBotProfit,
    totalBotProfit,
    progress,
    status,
    isLoading,
    refresh: async () => {
      if (!isConnected || !fullAddress) {
        return;
      }

      const payload = await fetchJson<BotSummaryResponse>(
        `/api/bot/summary?walletAddress=${fullAddress}`,
      );

      console.log("[bot.ui.api]", payload);
      console.log("[bot.history.api]", {
        tradeCount: new Set((payload.activity ?? []).map((entry) => entry.tradeId ?? entry.cycleId ?? entry.id.split(":")[0])).size,
        timelineRows: payload.activity?.length ?? 0,
        tradeIds: Array.from(new Set((payload.activity ?? []).map((entry) => entry.tradeId ?? entry.cycleId ?? entry.id.split(":")[0]))),
      });
      setPlans(payload.plans ?? []);
      setSubscriptions(payload.subscriptions ?? []);
      setTimeline(payload.activity ?? []);
      setTodayBotProfit(payload.todayBotProfit ?? 0);
      setTotalBotProfit(payload.totalBotProfit ?? 0);
      setLatestActivity(payload.latestActivity ?? null);
      setStatus(payload.activeSubscriptions > 0 ? "active" : "inactive");
    },
  };
}
