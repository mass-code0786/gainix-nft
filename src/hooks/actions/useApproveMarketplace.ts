"use client";

import type { Address } from "viem";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { useWallet } from "@/hooks/useWallet";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

export function useApproveMarketplace() {
  const { chainId } = useWallet();
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = chainId ?? contractTestChain.id;
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
