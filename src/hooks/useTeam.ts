"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";

interface TeamOverviewResponse {
  directCount: number;
  unlockedLevels: number;
  sponsor: {
    id: string;
    walletAddress: string;
  } | null;
  directs: Array<{
    id: string;
    walletAddress: string;
    createdAt: string;
  }>;
  levelBreakdown: Array<{
    level: number;
    downlineCount: number;
    unlocked: boolean;
  }>;
  vipStatus: {
    currentVipLevel: number;
    nextVipLevel: number | null;
    payoutAmount: number;
    currentRequirementProgress:
      | {
          selfPackageAmount: number;
          selfPackageRequired: number;
          qualifiedLevel1Users?: number;
          qualifiedLevel1Required?: number;
          qualifiedLevel2Users?: number;
          qualifiedLevel2Required?: number;
          minimumTeamPackageAmount?: number;
          teamSalesAmount?: number;
          directQualifiedUsers?: number;
          directQualifiedRequired?: number;
          previousVipLevelRequired?: number;
        }
      | null;
  };
}

interface RoyaltyStatusResponse {
  currentVipLevel: number;
  nextVipLevel: number | null;
  currentRequirementProgress:
    | {
        selfPackageAmount: number;
        selfPackageRequired: number;
        qualifiedLevel1Users?: number;
        qualifiedLevel1Required?: number;
        qualifiedLevel2Users?: number;
        qualifiedLevel2Required?: number;
        minimumTeamPackageAmount?: number;
        teamSalesAmount?: number;
        directQualifiedUsers?: number;
        directQualifiedRequired?: number;
        previousVipLevelRequired?: number;
      }
    | null;
  payoutAmount: number;
  payoutHistory: Array<{
    id: string;
    amount: number;
    vipLevel: number | null;
    payoutDate: string | null;
    createdAt: string;
  }>;
  payoutSchedule: {
    firstDay: number;
    secondDay: number;
    monthEnd: boolean;
  };
}

type TeamSummaryResponse = TeamOverviewResponse & { royalty: RoyaltyStatusResponse };

export function useTeam() {
  const { fullAddress, isConnected } = useWallet();
  const [data, setData] = useState<TeamSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !fullAddress) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const startedAt = performance.now();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const teamResponse = await fetchJson<TeamSummaryResponse>(
          `/api/team/summary?walletAddress=${fullAddress}`,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setData(teamResponse);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load team.");
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          console.info(`[perf.ui] page=team loadMs=${Math.round(performance.now() - startedAt)}`);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [fullAddress, isConnected]);

  return {
    data,
    isLoading,
    error,
  };
}
