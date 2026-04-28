"use client";

import { marketplaceAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { useWallet } from "@/hooks/useWallet";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

interface CancelListingInput {
  listingId: number;
}

export function useCancelListing() {
  const { chainId } = useWallet();
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = chainId ?? contractTestChain.id;
  const addresses = getGainixAddresses(activeChainId);

  const cancelListing = async ({ listingId }: CancelListingInput) => {
    const request = buildGainixWriteRequest({
      address: addresses.marketplace,
      abi: marketplaceAbi,
      functionName: "cancelListing",
      args: [BigInt(listingId)],
      chainId: activeChainId,
    });

    await executeWrite(request);
  };

  return {
    cancelListing,
    feedback,
  };
}
