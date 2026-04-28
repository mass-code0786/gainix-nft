"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import type {
  BotAutomationActivity,
  BotAutomationPlan,
  BotAutomationSubscription,
} from "@/types";

interface BotStatusResponse {
  plans: BotAutomationPlan[];
  subscriptions: BotAutomationSubscription[];
  activeSubscriptions: number;
  todayBotProfit: number;
  totalBotProfit: number;
  latestActivity: BotAutomationActivity | null;
}

interface BotActivityResponse {
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

    let isCancelled = false;

    async function load() {
      setIsLoading(true);

      try {
        const [statusResponse, activityResponse] = await Promise.all([
          fetch(`/api/bot/status?walletAddress=${fullAddress}`, { cache: "no-store" }),
          fetch(`/api/bot/activity?walletAddress=${fullAddress}`, { cache: "no-store" }),
        ]);

        if (!statusResponse.ok || !activityResponse.ok) {
          throw new Error("Unable to load bot status.");
        }

        const statusPayload = (await statusResponse.json()) as BotStatusResponse;
        const activityPayload = (await activityResponse.json()) as BotActivityResponse;

        if (isCancelled) {
          return;
        }

        setPlans(statusPayload.plans ?? []);
        setSubscriptions(statusPayload.subscriptions ?? []);
        setTimeline(activityPayload.activity ?? []);
        setTodayBotProfit(statusPayload.todayBotProfit ?? 0);
        setTotalBotProfit(statusPayload.totalBotProfit ?? 0);
        setLatestActivity(statusPayload.latestActivity ?? null);
        setStatus(statusPayload.activeSubscriptions > 0 ? "active" : "inactive");
      } catch {
        if (isCancelled) {
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

    const total = activeSubscription.totalCycles;
    const completed = activeSubscription.completedCycles;

    return total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;
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

      const [statusResponse, activityResponse] = await Promise.all([
        fetch(`/api/bot/status?walletAddress=${fullAddress}`, { cache: "no-store" }),
        fetch(`/api/bot/activity?walletAddress=${fullAddress}`, { cache: "no-store" }),
      ]);

      if (!statusResponse.ok || !activityResponse.ok) {
        throw new Error("Unable to refresh bot status.");
      }

      const statusPayload = (await statusResponse.json()) as BotStatusResponse;
      const activityPayload = (await activityResponse.json()) as BotActivityResponse;

      setPlans(statusPayload.plans ?? []);
      setSubscriptions(statusPayload.subscriptions ?? []);
      setTimeline(activityPayload.activity ?? []);
      setTodayBotProfit(statusPayload.todayBotProfit ?? 0);
      setTotalBotProfit(statusPayload.totalBotProfit ?? 0);
      setLatestActivity(statusPayload.latestActivity ?? null);
      setStatus(statusPayload.activeSubscriptions > 0 ? "active" : "inactive");
    },
  };
}
