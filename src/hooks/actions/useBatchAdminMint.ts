"use client";

import { useState } from "react";
import type { Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { triggerContractDataRefresh } from "@/lib/web3/contract-data-refresh";
import { getExplorerTxUrl } from "@/lib/web3/network-config";
import { buildGainixWriteRequest } from "@/lib/web3/write/contract-write";

export interface BatchMintItem {
  id: string;
  label: string;
  tokenUri: string;
}

export interface BatchMintResult {
  id: string;
  label: string;
  tokenUri: string;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  status: "pending_wallet" | "pending_chain" | "confirmed" | "failed";
  error?: string;
}

interface BatchMintState {
  status: "idle" | "running" | "success" | "error";
  results: BatchMintResult[];
  summary: string;
}

const initialState: BatchMintState = {
  status: "idle",
  results: [],
  summary: "Ready to mint selected metadata files.",
};

export function useBatchAdminMint() {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: contractActiveChainId });
  const addresses = getGainixAddresses(contractActiveChainId);
  const [state, setState] = useState<BatchMintState>(initialState);

  const mintBatch = async ({ recipient, items }: { recipient: Address; items: BatchMintItem[] }) => {
    if (!client) {
      setState({
        status: "error",
        results: [],
        summary: "Public client unavailable for the configured Gainix chain.",
      });
      return;
    }

    const results: BatchMintResult[] = [];
    setState({
      status: "running",
      results,
      summary: "Batch mint in progress. Confirm each transaction in your wallet.",
    });

    for (const item of items) {
      const request = buildGainixWriteRequest({
        address: addresses.nft,
        abi: nftAbi,
        functionName: "adminMint",
        args: [recipient, item.tokenUri],
        chainId: contractActiveChainId,
      });

      const pendingWallet: BatchMintResult = {
        id: item.id,
        label: item.label,
        tokenUri: item.tokenUri,
        status: "pending_wallet",
      };

      results.push(pendingWallet);
      setState({
        status: "running",
        results: [...results],
        summary: `Awaiting wallet confirmation for ${item.label}.`,
      });

      try {
        const txHash = await writeContractAsync(request as never);
        const pendingChain: BatchMintResult = {
          ...pendingWallet,
          txHash,
          explorerUrl: getExplorerTxUrl(txHash, contractActiveChainId),
          status: "pending_chain",
        };
        results[results.length - 1] = pendingChain;
        setState({
          status: "running",
          results: [...results],
          summary: `Transaction sent for ${item.label}. Waiting for chain confirmation.`,
        });

        const receipt = await client.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on-chain.");
        }

        const confirmed: BatchMintResult = {
          ...pendingChain,
          status: "confirmed",
        };
        results[results.length - 1] = confirmed;
        triggerContractDataRefresh();
        setState({
          status: "running",
          results: [...results],
          summary: `${item.label} minted. Continuing batch...`,
        });
      } catch (error) {
        const failed: BatchMintResult = {
          ...pendingWallet,
          status: "failed",
          error: error instanceof Error ? error.message : "Batch mint transaction failed.",
        };
        results[results.length - 1] = failed;
        setState({
          status: "error",
          results: [...results],
          summary: `Batch mint stopped at ${item.label}.`,
        });
        return;
      }
    }

    setState({
      status: "success",
      results: [...results],
      summary: `Batch mint completed (${results.length}/${results.length} confirmed).`,
    });
  };

  const reset = () => setState(initialState);

  return {
    ...state,
    mintBatch,
    reset,
  };
}
