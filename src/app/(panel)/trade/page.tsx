"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Wallet } from "lucide-react";
import { ActivityFeed } from "@/components/marketplace/activity-feed";
import { NFTPreview } from "@/components/sections/nft-preview";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { TxFeedbackCard } from "@/components/ui/tx-feedback-card";
import { useBuyNFT } from "@/hooks/actions/useBuyNFT";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { useWallet } from "@/hooks/useWallet";
import { buildMarketplaceHref } from "@/lib/marketplace/routing";
import { formatCurrency } from "@/utils/format";

export default function TradePage() {
  const searchParams = useSearchParams();
  const querySlug = searchParams.get("slug");
  const { liveListings, activity, getMarketState } = useMarketplaceListings();
  const { isConnected, address } = useWallet();
  const { buyNFT, feedback: buyFeedback } = useBuyNFT();
  const [selectedSlug, setSelectedSlug] = useState(querySlug ?? liveListings[0]?.slug ?? "");

  useEffect(() => {
    if (querySlug) {
      setSelectedSlug(querySlug);
    }
  }, [querySlug]);

  const selected = liveListings.find((item) => item.slug === selectedSlug) ?? liveListings[0];

  if (!selected) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="Trade"
          title="No active listings"
          description="No listings available right now."
        />
        <div className="section-shell text-sm text-zinc-300">Check back soon for new drops.</div>
      </AnimatedPage>
    );
  }

  const state = getMarketState(selected.slug, address);
  const scopedActivity = activity.filter((item) => item.nftSlug === selected.slug);

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow="Trade"
        title="Trade"
        description="Review pricing and buy this NFT with USDT."
      />

      {!isConnected ? (
        <div className="section-shell text-sm text-zinc-300">
          <div className="flex items-center gap-2 text-zinc-200">
            <Wallet className="h-4 w-4 text-gainix-300" />
            Wallet disconnected
          </div>
          <p className="mt-2">Connect wallet to continue.</p>
          <Link href="/connect" className="secondary-button mt-4 w-fit">
            Connect wallet
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 sm:space-y-6">
          <div className="section-shell">
            <p className="muted-label">Select listing</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {liveListings.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setSelectedSlug(item.slug)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    item.slug === selected.slug
                      ? "border-gainix-400/40 bg-gainix-500/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-400"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="section-shell overflow-hidden">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[260px_1fr]">
              <NFTPreview nft={selected} className="h-64" />
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <p className="font-display text-3xl font-semibold text-white">{selected.name}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Status: {state.isListed ? "Live listing" : "Not listed"}. Sales tracked: {state.soldCount}.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-500">Listed price</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(selected.currentPrice)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-500">Ownership</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {state.isOwnedByViewer ? "Owned by you" : "Owned by another wallet"}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="muted-label">Order summary</p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span>Backend price</span>
                      <span>{formatCurrency(selected.currentPrice)}</span>
                    </div>
                    <div className="soft-divider pt-3 text-base font-medium text-white">
                      <div className="flex items-center justify-between">
                        <span>Total</span>
                        <span>{formatCurrency(selected.currentPrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {state.isOwnedByViewer ? (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                    This NFT is already in your wallet. Manage pricing or remove the live listing from the sale screen.
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {state.isOwnedByViewer ? (
                    <Link href={`/list?slug=${selected.slug}`} className="premium-button">
                      Manage listing
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buyNFT({ nftId: selected.id })}
                      className="premium-button"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Buy NFT with USDT
                    </button>
                  )}
                  <Link href={buildMarketplaceHref(selected)} className="secondary-button">
                    View NFT detail
                  </Link>
                </div>

                <TxFeedbackCard feedback={buyFeedback} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {scopedActivity.length === 0 ? (
            <div className="section-shell text-sm text-zinc-300">
              No activity history available for this listing yet.
            </div>
          ) : (
            <ActivityFeed items={scopedActivity} limit={5} />
          )}

          <div className="section-shell text-sm text-zinc-300">
            <p className="muted-label">Order notes</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                Backend settlement is tracked using your connected wallet address.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
