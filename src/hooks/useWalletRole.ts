"use client";

import { useEffect, useMemo } from "react";
import { getClientConfiguredWalletRole, isPrivilegedRole } from "@/lib/auth/wallet-role";

export function useWalletRole(walletAddress: string | null | undefined) {
  const role = useMemo(() => getClientConfiguredWalletRole(walletAddress), [walletAddress]);
  const normalizedWallet = walletAddress?.trim().toLowerCase() ?? "";
  const isAdmin = isPrivilegedRole(role);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    console.info("[gainix:admin-wallet]", {
      connectedWallet: walletAddress ?? null,
      normalizedWallet: normalizedWallet || null,
      isAdmin,
      role,
    });
  }, [isAdmin, normalizedWallet, role, walletAddress]);

  return { role, isAdmin, normalizedWallet };
}
