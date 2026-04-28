"use client";

import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

export function useSetNftBaseUri() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const addresses = getGainixAddresses(contractTestChain.id);

  const setBaseTokenUri = async (baseUri: string) => {
    const request = buildGainixWriteRequest({
      address: addresses.nft,
      abi: nftAbi,
      functionName: "setBaseTokenUri",
      args: [baseUri],
      chainId: contractTestChain.id,
    });

    await executeWrite(request);
  };

  return {
    setBaseTokenUri,
    feedback,
  };
}
