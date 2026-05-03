"use client";

import { useEffect, useRef } from "react";
import { useBotSubscription } from "@/hooks/useBotSubscription";
import { useIncome } from "@/hooks/useIncome";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useTeam } from "@/hooks/useTeam";

export function useDashboardSummary() {
  const portfolio = usePortfolio();
  const income = useIncome();
  const bot = useBotSubscription();
  const team = useTeam();
  const isLoading = portfolio.isLoading || income.isLoading || bot.isLoading || team.isLoading;
  const startedAtRef = useRef(performance.now());
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !loggedRef.current) {
      loggedRef.current = true;
      console.info(`[perf.ui] page=dashboard loadMs=${Math.round(performance.now() - startedAtRef.current)}`);
    }
  }, [isLoading]);

  return {
    portfolio,
    income,
    bot,
    team,
    isLoading,
  };
}
