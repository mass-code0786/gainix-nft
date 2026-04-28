"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useWallet } from "@/hooks/useWallet";
import { useContractDataRefreshVersion } from "@/lib/web3/contract-data-refresh";
import { readGainixContractOrNull } from "@/lib/web3/read/contract-read";

export function useMarketplaceApproval(nftAddress?: Address) {
  const { address, chainId } = useWallet();
  const activeChainId = chainId ?? contractTestChain.id;
  const addresses = getGainixAddresses(activeChainId);
  const client = usePublicClient({ chainId: activeChainId });
  const refreshVersion = useContractDataRefreshVersion();
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!client || !address || !nftAddress) {
      setIsApproved(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const approved = await readGainixContractOrNull({
        address: nftAddress,
        abi: nftAbi,
        functionName: "isApprovedForAll",
        args: [address, addresses.marketplace],
        client,
      });

      setIsApproved(Boolean(approved));
    } catch {
      setIsApproved(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, addresses.marketplace, client, nftAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshVersion]);

  return {
    isApproved,
    isLoading,
    refresh,
  };
}
