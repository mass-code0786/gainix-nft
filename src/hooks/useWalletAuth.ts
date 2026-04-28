"use client";

import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { fetchJson } from "@/lib/api/client";

interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

interface VerifyResponse {
  walletAddress: string;
  verified: boolean;
}

export function useWalletAuth(walletAddress: string | null | undefined) {
  const { signMessageAsync } = useSignMessage();
  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const normalizedWallet = walletAddress?.toLowerCase() ?? null;
  const hasVerifiedSession =
    Boolean(normalizedWallet && verifiedWallet === normalizedWallet);

  const ensureVerifiedSession = useCallback(async () => {
    if (!normalizedWallet) {
      throw new Error("Connect your wallet to continue.");
    }

    if (verifiedWallet === normalizedWallet) {
      return;
    }

    setIsSigning(true);
    setAuthError(null);

    try {
      const nonce = await fetchJson<NonceResponse>(
        `/api/auth/nonce?walletAddress=${encodeURIComponent(normalizedWallet)}`,
      );
      const signature = await signMessageAsync({ message: nonce.message });
      const verified = await fetchJson<VerifyResponse>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: normalizedWallet,
          signature,
        }),
      });

      if (!verified.verified) {
        throw new Error("Wallet signature verification failed.");
      }

      setVerifiedWallet(verified.walletAddress.toLowerCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet signature failed.";
      setAuthError(message);
      throw error;
    } finally {
      setIsSigning(false);
    }
  }, [normalizedWallet, signMessageAsync, verifiedWallet]);

  return {
    hasVerifiedSession,
    isSigning,
    authError,
    signPrompt: hasVerifiedSession ? null : "Sign to continue",
    ensureVerifiedSession,
  };
}
