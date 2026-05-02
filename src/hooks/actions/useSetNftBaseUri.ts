"use client";

import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

export function useSetNftBaseUri() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const addresses = getGainixAddresses(contractActiveChainId);

  const setBaseTokenUri = async (baseUri: string) => {
    const request = buildGainixWriteRequest({
      address: addresses.nft,
      abi: nftAbi,
      functionName: "setBaseTokenUri",
      args: [baseUri],
      chainId: contractActiveChainId,
    });

    await executeWrite(request);
  };

  return {
    setBaseTokenUri,
    feedback,
  };
}
