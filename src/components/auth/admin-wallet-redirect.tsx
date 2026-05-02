"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useWalletRole } from "@/hooks/useWalletRole";

export function AdminWalletRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { fullAddress, hasMounted, isConnected } = useWallet();
  const { isAdmin } = useWalletRole(fullAddress);

  useEffect(() => {
    if (!hasMounted || !isConnected || !isAdmin || pathname.startsWith("/admin")) return;
    router.replace("/admin");
  }, [hasMounted, isAdmin, isConnected, pathname, router]);

  return null;
}
