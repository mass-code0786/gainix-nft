"use client";

import { marketplaceAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

interface CancelListingInput {
  listingId: number;
}

export function useCancelListing() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = contractActiveChainId;
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
