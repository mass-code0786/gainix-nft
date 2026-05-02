"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { buildMarketplaceHref } from "@/lib/marketplace/routing";
import type { NFTItem } from "@/types";
import { formatCurrency, formatPercent, getChangeTone } from "@/utils/format";
import { NFTPreview } from "./nft-preview";

interface NFTCardProps {
  nft: NFTItem;
  href?: string;
  actionLabel?: string;
  price?: number;
}

export function NFTCard({ nft, href, actionLabel = "Buy", price }: NFTCardProps) {
  const router = useRouter();
  const targetHref = href ?? buildMarketplaceHref(nft);
  const positive = nft.changePercent >= 0;
  const displayPrice = price ?? nft.listedPrice ?? nft.currentPrice;

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${nft.name}`}
      onClick={() => router.push(targetHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(targetHref);
        }
      }}
      className="market-card market-card-compact group cursor-pointer"
    >
      <NFTPreview nft={nft} chrome="minimal" className="market-card-preview" />

      <div className="mt-3 space-y-3">
        <div className="flex min-w-0 items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-fit overflow-visible">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Price</p>
            <p className="mt-1 whitespace-nowrap overflow-visible text-base font-bold leading-tight text-white sm:text-lg">
              {formatCurrency(displayPrice)}
            </p>
          </div>

          <div
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-1 text-[9px] font-semibold sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
              positive ? "border-emerald-500/20 bg-emerald-500/10" : "border-rose-500/20 bg-rose-500/10"
            } ${getChangeTone(nft.changePercent)}`}
          >
            {positive ? <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
            <span>24h {formatPercent(nft.changePercent)}</span>
          </div>
        </div>

        <Link
          href={targetHref}
          prefetch={false}
          onClick={(event) => event.stopPropagation()}
          className="premium-button w-full justify-center rounded-[18px] px-3 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase sm:text-sm"
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
