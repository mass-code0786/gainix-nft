"use client";

import Link from "next/link";
import { Gem, LayoutGrid, WalletCards } from "lucide-react";
import { NFTCard } from "@/components/sections/nft-card";
import { AnimatedPage } from "@/components/ui/animated-page";
import { StatCard } from "@/components/ui/stat-card";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/utils/format";

export default function PortfolioPage() {
  const { holdings, ownedNfts, summary } = usePortfolio();
  const { shortAddress, previewMode } = useWallet();

  return (
    <AnimatedPage>
      {holdings.length === 0 ? (
        <div className="section-shell rounded-[24px] text-sm leading-7 text-zinc-300">
          No NFTs in this wallet yet.
          <Link href="/marketplace" className="premium-button mt-4 w-fit">
            Browse marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {holdings.map((holding) => {
            const nft = ownedNfts.find((item) => item.slug === holding.nftSlug);

            if (!nft) return null;

            return (
              <NFTCard
                key={holding.id}
                nft={nft}
                href={`/list?slug=${nft.slug}`}
                actionLabel="Sell"
                price={holding.currentValue}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Wallet" value={shortAddress} detail={previewMode ? "Disconnected" : "Connected"} icon={WalletCards} />
        <StatCard label="Collection value" value={formatCurrency(summary.nftValue)} detail="Estimated value" icon={Gem} tone="positive" />
        <StatCard label="Available" value={formatCurrency(summary.availableToSpend)} detail="Ready now" icon={LayoutGrid} />
        <StatCard label="Pending" value={formatCurrency(summary.pendingProceeds)} detail="Open sales" />
      </div>
    </AnimatedPage>
  );
}
