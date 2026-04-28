"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractTestChain } from "@/contracts/config/chain";
import { useWallet } from "@/hooks/useWallet";
import { useContractDataRefreshVersion } from "@/lib/web3/contract-data-refresh";
import { readGainixContract } from "@/lib/web3/read/contract-read";
import { isSameAddress, normalizeAddress, normalizeAddressForComparison } from "@/lib/web3/wallet-utils";

interface NftAdminAccessState {
  contractAddress: Address;
  contractChainId: number;
  currentChainId: number | null;
  connectedWallet: Address | null;
  connectedWalletComparison: string | null;
  checkedWalletComparison: string | null;
  owner: Address | null;
  ownerComparison: string | null;
  nextTokenId: number | null;
  adminCheckResult: boolean | null;
  isOwner: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  walletStatus: string;
  isLoading: boolean;
  error?: string;
}

const contractChainId = contractTestChain.id;

const initialState = (contractAddress: Address): NftAdminAccessState => ({
  contractAddress,
  contractChainId,
  currentChainId: null,
  connectedWallet: null,
  connectedWalletComparison: null,
  checkedWalletComparison: null,
  owner: null,
  ownerComparison: null,
  nextTokenId: null,
  adminCheckResult: null,
  isOwner: false,
  isAdmin: false,
  hasAccess: false,
  walletStatus: "disconnected",
  isLoading: true,
});

export function useNftAdminAccess() {
  const { address, chainId, status, isWalletHydrating } = useWallet();
  const addresses = getGainixAddresses(contractChainId);
  const client = usePublicClient({ chainId: contractChainId });
  const refreshVersion = useContractDataRefreshVersion();
  const [state, setState] = useState<NftAdminAccessState>(() => initialState(addresses.nft));
  const requestVersionRef = useRef(0);
  const connectedWallet = normalizeAddress(address);
  const connectedWalletComparison = normalizeAddressForComparison(address);

  const refresh = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!client) {
      setState((current) => ({
        ...current,
        contractAddress: addresses.nft,
        contractChainId,
        currentChainId: chainId ?? null,
        connectedWallet,
        connectedWalletComparison,
        checkedWalletComparison: connectedWalletComparison,
        walletStatus: status,
        isLoading: false,
        error: "Public client is not available for BNB testnet.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      contractAddress: addresses.nft,
      contractChainId,
      currentChainId: chainId ?? null,
      connectedWallet,
      connectedWalletComparison,
      checkedWalletComparison: null,
      walletStatus: status,
      adminCheckResult: null,
      isOwner: false,
      isAdmin: false,
      hasAccess: false,
      isLoading: true,
      error: undefined,
    }));

    if (isWalletHydrating) {
      return;
    }

    try {
      const [owner, nextTokenId] = await Promise.all([
        readGainixContract({
          address: addresses.nft,
          abi: nftAbi,
          functionName: "owner",
          client,
        }),
        readGainixContract({
          address: addresses.nft,
          abi: nftAbi,
          functionName: "nextTokenId",
          client,
        }),
      ]);

      const normalizedOwner = normalizeAddress(owner);
      const ownerComparison = normalizeAddressForComparison(owner);

      if (!normalizedOwner || !ownerComparison || nextTokenId === null) {
        throw new Error("Unable to read owner or next token state.");
      }

      let adminCheckResult: boolean | null = null;
      let adminReadError: string | undefined;

      if (connectedWallet) {
        try {
          adminCheckResult = Boolean(
            await readGainixContract({
              address: addresses.nft,
              abi: nftAbi,
              functionName: "admins",
              args: [connectedWallet],
              client,
            }),
          );
        } catch (error) {
          adminReadError = error instanceof Error ? error.message : "Unable to verify admin access.";
        }
      }

      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      const ownerMatch = isSameAddress(normalizedOwner, connectedWallet);
      const adminMatch = adminCheckResult === true;

      setState({
        contractAddress: addresses.nft,
        contractChainId,
        currentChainId: chainId ?? null,
        connectedWallet,
        connectedWalletComparison,
        checkedWalletComparison: connectedWalletComparison,
        owner: normalizedOwner,
        ownerComparison,
        nextTokenId: Number(nextTokenId),
        adminCheckResult,
        isOwner: ownerMatch,
        isAdmin: adminMatch,
        hasAccess: ownerMatch,
        walletStatus: status,
        isLoading: false,
        error: !ownerMatch && adminReadError ? adminReadError : undefined,
      });
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setState({
        contractAddress: addresses.nft,
        contractChainId,
        currentChainId: chainId ?? null,
        connectedWallet,
        connectedWalletComparison,
        checkedWalletComparison: connectedWalletComparison,
        owner: null,
        ownerComparison: null,
        nextTokenId: null,
        adminCheckResult: null,
        isOwner: false,
        isAdmin: false,
        hasAccess: false,
        walletStatus: status,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to read NFT admin state.",
      });
    }
  }, [
    addresses.nft,
    chainId,
    client,
    connectedWallet,
    connectedWalletComparison,
    isWalletHydrating,
    status,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshVersion]);

  // Only trust owner access after the current wallet value has been checked.
  const isOwnerCheckReady =
    !isWalletHydrating && !state.isLoading && state.checkedWalletComparison === connectedWalletComparison;

  return {
    ...state,
    chainMismatch: Boolean(chainId && chainId !== contractChainId),
    isOwnerCheckReady,
    refresh,
  };
}
