"use client";

import type { Address } from "viem";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

interface AdminMintInput {
  recipient: Address;
  tokenUri: string;
}

export function useAdminMint() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const addresses = getGainixAddresses(contractActiveChainId);

  const adminMint = async ({ recipient, tokenUri }: AdminMintInput) => {
    const request = buildGainixWriteRequest({
      address: addresses.nft,
      abi: nftAbi,
      functionName: "adminMint",
      args: [recipient, tokenUri],
      chainId: contractActiveChainId,
    });

    await executeWrite(request);
  };

  return {
    adminMint,
    feedback,
  };
}
