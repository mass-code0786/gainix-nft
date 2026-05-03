"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { maskAddressesInText } from "@/utils/format";

export function AdminSignIn() {
  const { fullAddress, isConnected } = useWallet();
  const walletAuth = useWalletAuth(fullAddress);

  return (
    <AnimatedPage>
      <PageHeader title="Admin" />
      <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
        {!isConnected ? "Wallet connection required." : "Connect to Continue"}
      </div>
      {isConnected ? (
        <button
          type="button"
          onClick={() => walletAuth.ensureVerifiedSession().then(() => window.location.reload())}
          disabled={walletAuth.isSigning}
          className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
        >
          {walletAuth.isSigning ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Connect to Continue
        </button>
      ) : null}
      {walletAuth.authError ? (
        <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {maskAddressesInText(walletAuth.authError)}
        </div>
      ) : null}
    </AnimatedPage>
  );
}
