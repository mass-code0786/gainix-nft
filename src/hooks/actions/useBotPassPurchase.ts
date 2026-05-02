"use client";

import { parseEther } from "viem";
import { botPassAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useContractWriteFlow } from "@/hooks/actions/useContractWriteFlow";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

interface BotPassPurchaseInput {
  planId: number;
  valueInBnb: number;
}

export function useBotPassPurchase() {
  const { executeWrite, feedback } = useContractWriteFlow();
  const activeChainId = contractActiveChainId;
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
