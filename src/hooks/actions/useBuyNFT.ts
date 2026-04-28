"use client";

import { useState } from "react";
import type { ContractWriteFeedback } from "@/hooks/actions/useContractWriteFlow";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { fetchJson } from "@/lib/api/client";

interface BuyNFTInput {
  nftId: string;
}

const idleFeedback: ContractWriteFeedback = {
  status: "idle",
  guidance: "Ready to submit backend buy action.",
};

export function useBuyNFT() {
  const { fullAddress } = useWallet();
  const walletAuth = useWalletAuth(fullAddress);
  const [feedback, setFeedback] = useState<ContractWriteFeedback>(idleFeedback);

  const buyNFT = async ({ nftId }: BuyNFTInput) => {
    if (!fullAddress) {
      setFeedback({
        status: "error",
        guidance: "Connect your wallet before buying.",
        error: "Wallet not connected.",
      });
      return;
    }

    setFeedback({
      status: "awaiting_wallet",
      guidance: walletAuth.signPrompt ?? "Submitting buy request to the Gainix backend.",
    });

    try {
      await walletAuth.ensureVerifiedSession();
      await fetchJson("/api/nft/buy", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: fullAddress,
          nftId,
        }),
      });

      setFeedback({
        status: "success",
        guidance: "NFT purchase recorded successfully.",
      });
    } catch (error) {
      setFeedback({
        status: "error",
        guidance: "NFT purchase failed.",
        error: error instanceof Error ? error.message : "Unknown buy error.",
      });
    }
  };

  return {
    buyNFT,
    feedback,
  };
}
