"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { getChainMetadata, shortenAddress } from "@/lib/web3/wallet-utils";

export function useWallet() {
  const [isMounted, setIsMounted] = useState(false);
  const { address, chainId, isConnected, isConnecting, isDisconnected, status } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: nativeBalance } = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(isMounted && address && chainId && isConnected),
      retry: 0,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  });
  const chain = getChainMetadata(chainId);
  const isWalletHydrating = status === "connecting" || status === "reconnecting";
  const hasResolvedWalletSession = status === "connected" || status === "disconnected";

  return {
    address,
    fullAddress: address ?? null,
    shortAddress: shortenAddress(address),
    hasMounted: isMounted,
    isConnected,
    isConnecting,
    isDisconnected,
    status,
    chainId: chainId ?? null,
    chainName: chain.chainName,
    isSupportedChain: chain.isSupported,
    chainBadgeTone: chain.badgeTone,
    isWalletHydrating,
    hasResolvedWalletSession,
    previewMode: !isConnected,
    walletBalance: nativeBalance ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)) : 0,
    disconnect,
  };
}
