"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingCart, UserCircle2 } from "lucide-react";
import { ActivityFeed } from "@/components/marketplace/activity-feed";
import { NFTCard } from "@/components/sections/nft-card";
import { NFTPreview } from "@/components/sections/nft-preview";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { TxFeedbackCard } from "@/components/ui/tx-feedback-card";
import { useBuyNFT } from "@/hooks/actions/useBuyNFT";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { useNFTs } from "@/hooks/useNFTs";
import { useWallet } from "@/hooks/useWallet";
import { parseMarketplaceRouteParam } from "@/lib/marketplace/routing";
import { isSameAddress } from "@/lib/web3/wallet-utils";
import type { NFTItem } from "@/types";
import { formatCurrency, formatWallet } from "@/utils/format";

function getFallbackMarketState(nft: NFTItem, viewerAddress?: `0x${string}` | null) {
  const soldCount = nft.activity.filter((entry) => entry.type === "sell" || entry.type === "buy").length;
  const isListed = nft.listedPrice !== null && Boolean(nft.listingId);
  const isOwnedByViewer = isSameAddress(nft.owner, viewerAddress) || (isListed && isSameAddress(nft.seller, viewerAddress));

  return {
    exists: true,
    isOwnedByViewer,
    isListed,
    hasSales: soldCount > 0,
    listingStatus: isListed ? ("active_listing" as const) : soldCount > 0 ? ("sold_history" as const) : ("not_listed" as const),
    soldCount,
  };
}

function getFallbackLastSalePrice(nft: NFTItem) {
  return nft.activity.find((entry) => entry.type === "buy" || entry.type === "sell")?.price;
}

export default function NFTDetailPage() {
  const params = useParams<{ slug: string }>();
  const routeParam = typeof params.slug === "string" ? params.slug : params.slug[0];
  const { tokenId: tokenIdFromRoute, slug: legacySlug } = parseMarketplaceRouteParam(routeParam);
  const { getBySlug, getByTokenId: getNftByTokenId, getRelated } = useNFTs();
  const { address, isConnected } = useWallet();
  const {
    getByTokenId: getListingByTokenId,
    getActivityByTokenId,
    getMarketStateByTokenId,
    getLastSalePriceByTokenId,
  } = useMarketplaceListings();
  const { buyNFT, feedback: buyFeedback } = useBuyNFT();
  const fallbackNft = typeof tokenIdFromRoute === "number" ? getNftByTokenId(tokenIdFromRoute) : legacySlug ? getBySlug(legacySlug) : undefined;
  const listingNft =
    typeof tokenIdFromRoute === "number"
      ? getListingByTokenId(tokenIdFromRoute)
      : fallbackNft
        ? getListingByTokenId(fallbackNft.tokenId)
        : undefined;
  const nft = listingNft ?? fallbackNft;

  if (!nft) {
    return (
      <main className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="section-shell text-center">
            <p className="muted-label">Missing NFT</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white">NFT not found</h1>
            <Link href="/marketplace" className="premium-button mt-4">
              Return to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const state = listingNft ? getMarketStateByTokenId(nft.tokenId, address) : getFallbackMarketState(nft, address);
  const activity = listingNft
    ? getActivityByTokenId(nft.tokenId)
    : nft.activity.map((entry) => ({
        ...entry,
        nftName: nft.name,
        nftSlug: nft.slug,
        nftTokenId: nft.tokenId,
      }));
  const related = getRelated(nft.relatedSlugs);
  const lastSale = (listingNft ? getLastSalePriceByTokenId(nft.tokenId) : getFallbackLastSalePrice(nft)) ?? nft.floorPrice;
  const attributes = [
    { trait_type: "Category", value: nft.animalType },
    { trait_type: "Collection", value: nft.collection },
    { trait_type: "Supply", value: nft.supply },
    { trait_type: "Rank", value: `#${nft.rank}` },
  ];

  const listingStatusLabel =
    state.listingStatus === "active_listing"
      ? "Active listing"
      : state.listingStatus === "sold_history"
        ? "Previously sold"
        : "Not listed";

  const activeFeedback = buyFeedback;
  const canBuyNow = !state.isOwnedByViewer && state.isListed && Boolean(nft.listingId);

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow="NFT detail"
        title={nft.name}
        description="Collection details, pricing, and recent market activity."
      />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 sm:space-y-6">
          <div className="section-shell overflow-hidden">
            <NFTPreview nft={nft} size="lg" />
          </div>

          <div className="section-shell">
            <SectionHeader title="Details" />
            <p className="text-sm leading-7 text-zinc-400">{nft.description}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {attributes.map((attribute) => (
                <div key={attribute.trait_type} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-zinc-500">{attribute.trait_type}</p>
                  <p className="mt-2 font-medium text-white">{attribute.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="section-shell">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="muted-label">Listing</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-white">
                  {formatCurrency(nft.listedPrice ?? nft.currentPrice)}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">Last sale {formatCurrency(lastSale)}</p>
              </div>
              <span className="rounded-full border border-gainix-400/20 bg-gainix-500/10 px-3 py-1 text-sm text-gainix-100">
                {nft.network}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Collection</p>
                <p className="mt-2 font-medium text-white">{nft.collection}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Status</p>
                <p className="mt-2 font-medium text-white">{listingStatusLabel}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Total sales</p>
                <p className="mt-2 font-medium text-white">{state.soldCount}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-zinc-300">
                  <UserCircle2 className="h-4 w-4 text-gainix-300" />
                  <p className="text-sm text-zinc-500">Collector</p>
                </div>
                <p className="mt-2 font-medium text-white">{formatWallet(nft.owner)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Creator</p>
                <p className="mt-2 font-medium text-white">{formatWallet(nft.creator)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Token</p>
                <p className="mt-2 font-medium text-white">#{nft.tokenId}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-500">Rank</p>
                <p className="mt-2 font-medium text-white">#{nft.rank}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {state.isOwnedByViewer ? (
                <Link href={`/list?slug=${nft.slug}`} className="premium-button">
                  Sell NFT for USDT
                </Link>
              ) : canBuyNow ? (
                <button
                  type="button"
                  onClick={() => buyNFT({ nftId: nft.id })}
                  className="premium-button"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Buy with USDT
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="premium-button cursor-not-allowed opacity-60"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Listing unavailable
                </button>
              )}
              {state.isOwnedByViewer && isConnected ? (
                <Link href={`/list?slug=${nft.slug}`} className="secondary-button">
                  Manage listing
                </Link>
              ) : canBuyNow ? (
                <Link href={`/trade?slug=${nft.slug}`} className="secondary-button">
                  Review order
                </Link>
              ) : (
                <Link href="/marketplace" className="secondary-button">
                  Back to marketplace
                </Link>
              )}
            </div>

            {!isConnected ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/90">
                Connect your wallet to continue.
              </div>
            ) : !state.isOwnedByViewer && !state.isListed ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                This NFT is not actively listed right now. You can view the asset details here, but buying is disabled until it is relisted.
              </div>
            ) : null}

            <div className="mt-4">
              <TxFeedbackCard feedback={activeFeedback} />
            </div>
          </div>
        </div>
      </div>

      {activity.length === 0 ? (
        <div className="section-shell text-sm text-zinc-300">No recent activity yet.</div>
      ) : (
        <ActivityFeed
          items={activity.map((entry) => ({
            ...entry,
            nftName: nft.name,
            nftSlug: nft.slug,
            nftTokenId: nft.tokenId,
          }))}
          limit={6}
        />
      )}

      <div className="section-shell">
        <SectionHeader title="Related listings" />
        {related.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5 text-sm text-zinc-300">
            No related listings right now.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {related.map((item) => (
              <NFTCard key={item.id} nft={item} />
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
