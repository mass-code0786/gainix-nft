"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Abi, ContractFunctionName } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { triggerContractDataRefresh } from "@/lib/web3/contract-data-refresh";
import { getExplorerTxUrl } from "@/lib/web3/network-config";
import type { GainixWriteRequest } from "@/lib/web3/write/contract-write";

export interface ContractWriteFeedback {
  status: "idle" | "awaiting_wallet" | "pending_chain" | "success" | "error";
  txHash?: `0x${string}`;
  error?: string;
  explorerUrl?: string;
  guidance: string;
}

export function useContractWriteFlow() {
  const [error, setError] = useState<string | undefined>(undefined);
  const { writeContractAsync, data: txHash, isPending: isAwaitingWallet } = useWriteContract();
  const lastRefreshedHash = useRef<`0x${string}` | undefined>(undefined);
  const {
    isLoading: isPendingOnChain,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  useEffect(() => {
    if (!isSuccess || !txHash || lastRefreshedHash.current === txHash) {
      return;
    }

    lastRefreshedHash.current = txHash;
    triggerContractDataRefresh();
  }, [isSuccess, txHash]);

  const status = useMemo<ContractWriteFeedback["status"]>(() => {
    if (error || isReceiptError) return "error";
    if (isSuccess) return "success";
    if (isPendingOnChain) return "pending_chain";
    if (isAwaitingWallet) return "awaiting_wallet";
    return "idle";
  }, [error, isReceiptError, isSuccess, isPendingOnChain, isAwaitingWallet]);

  const guidance = useMemo(() => {
    switch (status) {
      case "awaiting_wallet":
        return "Confirm the transaction in your wallet to continue.";
      case "pending_chain":
        return "Transaction submitted. Waiting for chain confirmation.";
      case "success":
        return "Transaction confirmed on-chain.";
      case "error":
        return "Transaction failed or was rejected. Review details and retry.";
      default:
        return "Ready to submit on-chain action.";
    }
  }, [status]);

  const feedback: ContractWriteFeedback = {
    status,
    txHash,
    error: error ?? receiptError?.message,
    explorerUrl: txHash ? getExplorerTxUrl(txHash) : undefined,
    guidance,
  };

  async function executeWrite<TAbi extends Abi, TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">>(
    request: GainixWriteRequest<TAbi, TFunctionName>,
  ) {
    setError(undefined);

    try {
      await writeContractAsync(request as never);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Unknown wallet write error.");
    }
  }

  return {
    executeWrite,
    feedback,
  };
}
