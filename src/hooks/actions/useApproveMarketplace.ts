"use client";

import type { Address } from "viem";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

export function useApproveMarketplace() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = contractActiveChainId;
  const addresses = getGainixAddresses(activeChainId);

  const approveMarketplace = async (nftAddress?: Address) => {
    const request = buildGainixWriteRequest({
      address: nftAddress ?? addresses.nft,
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [addresses.marketplace, true],
      chainId: activeChainId,
    });

    await executeWrite(request);
  };

  return {
    approveMarketplace,
    feedback,
  };
}
