"use client";

import { useState } from "react";
import type { ContractWriteFeedback } from "@/hooks/actions/useContractWriteFlow";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { fetchJson } from "@/lib/api/client";

interface ListNFTInput {
  nftId: string;
}

const idleFeedback: ContractWriteFeedback = {
  status: "idle",
  guidance: "Ready to submit backend listing action.",
};

export function useListNFT() {
  const { fullAddress } = useWallet();
  const walletAuth = useWalletAuth(fullAddress);
  const [feedback, setFeedback] = useState<ContractWriteFeedback>(idleFeedback);

  const listNFT = async ({ nftId }: ListNFTInput) => {
    if (!fullAddress) {
      setFeedback({
        status: "error",
        guidance: "Connect your wallet before listing.",
        error: "Wallet not connected.",
      });
      return;
    }

    setFeedback({
      status: "awaiting_wallet",
      guidance: walletAuth.signPrompt ?? "Submitting listing request to the Gainix backend.",
    });

    try {
      await walletAuth.ensureVerifiedSession();
      await fetchJson("/api/nft/list", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: fullAddress,
          nftId,
        }),
      });

      setFeedback({
        status: "success",
        guidance: "NFT listed successfully.",
      });
    } catch (error) {
      setFeedback({
        status: "error",
        guidance: "NFT listing failed.",
        error: error instanceof Error ? error.message : "Unknown listing error.",
      });
    }
  };

  return {
    listNFT,
    feedback,
  };
}
