"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { nftAbi } from "@/contracts";
import { getGainixAddresses, isValidNonZeroAddress } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { useWallet } from "@/hooks/useWallet";
import {
  getClientConfiguredAdminWallets,
  getClientConfiguredWalletRole,
  isPrivilegedRole,
  normalizeWalletAddress,
  type WalletRole,
} from "@/lib/auth/wallet-role";
import { useContractDataRefreshVersion } from "@/lib/web3/contract-data-refresh";
import { readGainixContract } from "@/lib/web3/read/contract-read";
import { isSameAddress, normalizeAddress, normalizeAddressForComparison } from "@/lib/web3/wallet-utils";

interface NftAdminAccessState {
  contractAddress: Address | null;
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
  role: WalletRole;
  hasAccess: boolean;
  walletStatus: string;
  isLoading: boolean;
  error?: string;
}

const contractChainId = contractActiveChainId;

const initialState = (contractAddress: Address | null): NftAdminAccessState => ({
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
  role: "user",
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
  const envRole = getClientConfiguredWalletRole(address);
  const envAdminWallets = useMemo(() => getClientConfiguredAdminWallets(), []);
  const envOwnerWallet = normalizeWalletAddress(process.env.NEXT_PUBLIC_OWNER_WALLET_ADDRESS) || null;

  const logAdminAccess = useCallback(
    (result: { hasAccess: boolean; role: WalletRole; source: string; error?: string }) => {
      if (process.env.NODE_ENV !== "development") {
        return;
      }

      console.info("[gainix:admin-wallet]", {
        connectedWallet: address ?? null,
        normalizedWallet: connectedWalletComparison,
        adminWalletsFromEnv: envAdminWallets,
        ownerWalletFromEnv: envOwnerWallet,
        nftContractAddress: addresses.nft,
        isAdmin: result.hasAccess,
        role: result.role,
        source: result.source,
        error: result.error,
      });
    },
    [address, addresses.nft, connectedWalletComparison, envAdminWallets, envOwnerWallet],
  );

  const refresh = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!client) {
      const hasEnvAccess = isPrivilegedRole(envRole);
      setState((current) => ({
        ...current,
        contractAddress: addresses.nft,
        contractChainId,
        currentChainId: chainId ?? null,
        connectedWallet,
        connectedWalletComparison,
        checkedWalletComparison: connectedWalletComparison,
        walletStatus: status,
        role: envRole,
        hasAccess: hasEnvAccess,
        isOwner: envRole === "super_admin",
        isAdmin: envRole === "admin",
        isLoading: false,
        error: hasEnvAccess ? undefined : "Public client is not available for the configured Gainix chain.",
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
      role: envRole,
      hasAccess: false,
      isLoading: true,
      error: undefined,
    }));

    if (isWalletHydrating) {
      return;
    }

    const hasEnvAccess = isPrivilegedRole(envRole);
    if (hasEnvAccess) {
      logAdminAccess({ hasAccess: true, role: envRole, source: "env" });
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
        isOwner: envRole === "super_admin",
        isAdmin: envRole === "admin",
        role: envRole,
        hasAccess: true,
        walletStatus: status,
        isLoading: false,
      });
      return;
    }

    const nftAddress = addresses.nft;

    if (!isValidNonZeroAddress(nftAddress)) {
      const error = "NEXT_PUBLIC_GAINIX_NFT_ADDRESS is not configured with a valid non-zero address.";
      logAdminAccess({ hasAccess: false, role: envRole, source: "config", error });
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
        role: envRole,
        hasAccess: false,
        walletStatus: status,
        isLoading: false,
        error,
      });
      return;
    }

    try {
      const [owner, nextTokenId] = await Promise.all([
        readGainixContract({
          address: nftAddress,
          abi: nftAbi,
          functionName: "owner",
          client,
        }),
        readGainixContract({
          address: nftAddress,
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
              address: nftAddress,
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
      const role: WalletRole = ownerMatch ? "super_admin" : adminMatch ? "admin" : "user";
      const hasAccess = isPrivilegedRole(role);

      logAdminAccess({ hasAccess, role, source: "chain" });

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
        isAdmin: adminMatch || role === "admin",
        role,
        hasAccess,
        walletStatus: status,
        isLoading: false,
        error: !ownerMatch && adminReadError ? adminReadError : undefined,
      });
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "Unable to read NFT admin state.";
      logAdminAccess({
        hasAccess: false,
        role: "user",
        source: "chain-error",
        error: errorMessage,
      });

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
        role: "user",
        hasAccess: false,
        walletStatus: status,
        isLoading: false,
        error: errorMessage,
      });
    }
  }, [
    addresses.nft,
    chainId,
    client,
    connectedWallet,
    connectedWalletComparison,
    envRole,
    isWalletHydrating,
    logAdminAccess,
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
