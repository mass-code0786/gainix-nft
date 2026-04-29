"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CircleDollarSign, Wallet } from "lucide-react";
import { NFTPreview } from "@/components/sections/nft-preview";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { TxFeedbackCard } from "@/components/ui/tx-feedback-card";
import { useListNFT } from "@/hooks/actions/useListNFT";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/utils/format";

export default function ListPage() {
  const searchParams = useSearchParams();
  const querySlug = searchParams.get("slug");
  const mode = searchParams.get("mode");
  const { ownedNfts } = usePortfolio();
  const { isConnected } = useWallet();
  const { getMarketState, getLastSalePrice } = useMarketplaceListings();
  const { listNFT, feedback: listFeedback } = useListNFT();

  const [selectedSlug, setSelectedSlug] = useState(querySlug ?? ownedNfts[0]?.slug ?? "");
  const selected = ownedNfts.find((item) => item.slug === selectedSlug) ?? ownedNfts[0];

  useEffect(() => {
    if (querySlug) {
      setSelectedSlug(querySlug);
    }
  }, [querySlug]);

  const state = useMemo(() => (selected ? getMarketState(selected.slug) : null), [selected, getMarketState]);
  const cancelling = mode === "cancel" || Boolean(selected?.listedPrice);

  if (!isConnected) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="List NFT"
          title="Connect wallet to list"
          description="Connect your wallet to manage listings."
        />
        <div className="section-shell text-sm text-zinc-300">
          <div className="flex items-center gap-2 text-zinc-200">
            <Wallet className="h-4 w-4 text-gainix-300" />
            Wallet not connected
          </div>
          <p className="mt-3">Connect first, then return here to publish or manage a sale.</p>
          <Link href="/connect" className="premium-button mt-4 w-fit">
            Connect wallet
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  if (!selected) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="List NFT"
          title="No owned NFTs"
          description="No NFTs available to list."
        />
        <div className="section-shell">
          <p className="text-sm text-zinc-300">
            Acquire an NFT from the marketplace first, then return here to list it for sale.
          </p>
          <Link href="/marketplace" className="premium-button mt-4 w-fit">
            Browse marketplace
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  const lastSale = getLastSalePrice(selected.slug) ?? selected.floorPrice;
  const activeFeedback = listFeedback;

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow="List NFT"
        title={cancelling ? "Manage active listing" : "Sell NFT for USDT"}
        description="List your NFT for automatic backend settlement."
      />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="section-shell">
          <div className="flex flex-wrap gap-2">
            {ownedNfts.map((item) => (
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

          <div className="mt-4 sm:mt-5 grid gap-4 sm:gap-6 lg:grid-cols-[260px_1fr]">
            <NFTPreview nft={selected} className="h-64" />
            <div className="space-y-4 sm:space-y-5">
              <div>
                <p className="font-display text-3xl font-semibold text-white">{selected.name}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Status: {state?.isListed ? "Live on marketplace" : "Ready to list"}. Last sale {formatCurrency(lastSale)}.
                </p>
              </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Backend price</p>
                    <p className="mt-2 text-white">{formatCurrency(selected.floorPrice)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Sales count</p>
                    <p className="mt-2 text-white">{state?.soldCount ?? 0}</p>
                </div>
              </div>

              {cancelling ? (
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
                  <div className="flex items-center gap-2 text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="font-medium">Active listing detected</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-amber-100/80">
                    This NFT is already listed in the Gainix backend. Cancel listing is not available from this panel yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                    <div className="flex items-center justify-between">
                      <span>Auto-sell price</span>
                      <span>{formatCurrency(selected.currentPrice)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void listNFT({ nftId: selected.id });
                    }}
                    className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CircleDollarSign className="mr-2 h-4 w-4" />
                    Publish listing
                  </button>
                </div>
              )}

              <TxFeedbackCard feedback={activeFeedback} />
            </div>
          </div>
        </div>

        <div className="section-shell">
          <p className="muted-label">Listing flow</p>
          <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-300">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              Listings are submitted to the Gainix backend using your connected wallet address.
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              Auto-sell in 1-2 hours after listing.
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              Submit the listing and refresh your portfolio to see the updated status.
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
