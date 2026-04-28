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

export function useTeam() {
  const { fullAddress, isConnected } = useWallet();
  const [data, setData] = useState<(TeamOverviewResponse & { royalty: RoyaltyStatusResponse }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !fullAddress) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [teamResponse, royaltyResponse] = await Promise.all([
          fetchJson<TeamOverviewResponse>(`/api/team?walletAddress=${fullAddress}`),
          fetchJson<RoyaltyStatusResponse>(`/api/royalty/status?walletAddress=${fullAddress}`),
        ]);

        if (!isCancelled) {
          setData({
            ...teamResponse,
            royalty: royaltyResponse,
          });
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load team.");
          setData(null);
        }
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

  return {
    data,
    isLoading,
    error,
  };
}
