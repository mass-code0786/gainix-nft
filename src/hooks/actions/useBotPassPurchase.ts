"use client";

import { parseEther } from "viem";
import { botPassAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { useWallet } from "@/hooks/useWallet";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

interface BotPassPurchaseInput {
  planId: number;
  valueInBnb: number;
}

export function useBotPassPurchase() {
  const { chainId } = useWallet();
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = chainId ?? contractTestChain.id;
  const addresses = getGainixAddresses(activeChainId);

  const purchaseBotPass = async ({ planId, valueInBnb }: BotPassPurchaseInput) => {
    const request = buildGainixWriteRequest({
      address: addresses.botPass,
      abi: botPassAbi,
      functionName: "subscribe",
      args: [BigInt(planId)],
      value: parseEther(String(valueInBnb)),
      chainId: activeChainId,
    });

    await executeWrite(request);
  };

  return {
    purchaseBotPass,
    feedback,
  };
}
