"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Wallet2 } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";
import { useWallet } from "@/hooks/useWallet";

export default function ConnectPage() {
  const {
    isConnected,
    shortAddress,
    chainName,
    chainBadgeTone,
    previewMode,
    disconnect,
    isSupportedChain,
  } = useWallet();

  return (
    <main className="px-4 pb-10 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AnimatedPage>
          <PageHeader
            eyebrow="Connect"
            title="Connect your wallet"
            description="Enter Gainix NFT with one secure wallet connection."
            action={{ href: "/dashboard", label: "Open dashboard" }}
          />

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="muted-label">Access</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-[2.2rem]">
                    Wallet-first sign in
                  </h2>
                </div>
                <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200 shadow-glow">
                  <Wallet2 className="h-5 w-5" />
                </div>
              </div>

              <p className="text-sm leading-7 text-zinc-400">
                Connect once, then move between marketplace, portfolio, wallet, and bot access without friction.
              </p>

              <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <p className="muted-label">Status</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full border px-3 py-1 text-sm ${chainBadgeTone}`}>
                    {chainName}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-200">
                    {shortAddress}
                  </span>
                  {previewMode ? (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                      Not connected
                    </span>
                  ) : null}
                  {!isSupportedChain && isConnected ? (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                      Unsupported network
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {["MetaMask", "Trust Wallet", "WalletConnect"].map((wallet) => (
                  <div key={wallet} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="font-medium text-white">{wallet}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {wallet === "WalletConnect"
                        ? "Scan and connect in seconds."
                        : "Ready for direct connection."}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <WalletConnectButton />
                {isConnected ? (
                  <button type="button" onClick={() => disconnect()} className="secondary-button">
                    Disconnect wallet
                  </button>
                ) : null}
                <Link href="/dashboard" className="secondary-button">
                  Browse the app
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </GlassCard>

            <div className="space-y-6">
              <GlassCard>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-gainix-300" />
                  <div>
                    <p className="muted-label">Why connect</p>
                    <p className="font-display text-xl font-semibold text-white">Everything in one flow</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    "Track your collection in one place.",
                    "Browse live listings without extra setup.",
                    "Move from wallet to purchase flow with fewer steps.",
                  ].map((item) => (
                    <div key={item} className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard>
                <p className="muted-label">Experience</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm text-zinc-500">Access</p>
                    <p className="mt-2 font-medium text-white">Single wallet session</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm text-zinc-500">Navigation</p>
                    <p className="mt-2 font-medium text-white">Marketplace, portfolio, wallet, and bot pass</p>
                  </div>
                </div>
              </GlassCard>

              {isConnected ? (
                <GlassCard className="border-gainix-400/25 bg-gainix-900/20">
                  <p className="muted-label">Connected</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-white">
                    Wallet linked
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Continue into the app.
                  </p>
                  <Link href="/dashboard" className="premium-button mt-5">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enter Gainix NFT
                  </Link>
                </GlassCard>
              ) : null}
            </div>
          </div>
        </AnimatedPage>
      </div>
    </main>
  );
}
