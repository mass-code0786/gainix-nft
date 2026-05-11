"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchJson } from "@/lib/api/client";

export interface TeamLevelMember {
  walletAddress: string;
  joinedAt: string;
  packageAmount: number;
  botAmount: number;
  tradingWallet: number;
  status: "Active" | "Inactive";
  level: number;
}

interface TeamLevelMembersResponse {
  success: true;
  level: number;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  members: TeamLevelMember[];
}

const PAGE_SIZE = 20;

export function useTeamLevelMembers(level: number) {
  const { fullAddress, isConnected } = useWallet();
  const [members, setMembers] = useState<TeamLevelMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, signal?: AbortSignal) => {
      if (!isConnected || !fullAddress) {
        setMembers([]);
        setTotal(0);
        setPage(1);
        setHasMore(false);
        return;
      }

      if (nextPage === 1) {
        setMembers([]);
        setTotal(0);
        setPage(1);
        setHasMore(false);
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        console.info("[team.level.fetch]", { level });
        const response = await fetchJson<TeamLevelMembersResponse>(
          `/api/team/level-members?walletAddress=${encodeURIComponent(fullAddress)}&level=${level}&page=${nextPage}&pageSize=${PAGE_SIZE}`,
          { signal },
        );

        if (signal?.aborted) {
          return;
        }

        setMembers((current) => (nextPage === 1 ? response.members : [...current, ...response.members]));
        setTotal(response.total);
        setPage(response.page);
        setHasMore(response.hasMore);
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load level members.");
          if (nextPage === 1) {
            setMembers([]);
            setTotal(0);
            setHasMore(false);
          }
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [fullAddress, isConnected, level],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(1, controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadPage]);

  return {
    members,
    total,
    page,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore: () => loadPage(page + 1),
  };
}
