"use client";

import { useEffect, useState } from "react";
import type { NFTItem } from "@/types";
import { ipfsToHttp, isLegacyGainixDemoUri } from "@/lib/web3/token-metadata";
import { cn } from "@/utils/cn";

interface NFTPreviewProps {
  nft: NFTItem;
  size?: "sm" | "lg";
  className?: string;
  chrome?: "full" | "minimal";
}

export function NFTPreview({ nft, size = "sm", className, chrome = "full" }: NFTPreviewProps) {
  const isLarge = size === "lg";
  const isMinimal = chrome === "minimal";
  const imageSrc = nft.imageUri ? ipfsToHttp(nft.imageUri) : "";
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const canRenderImage = Boolean(imageSrc) && /^https?:\/\//i.test(imageSrc) && !isLegacyGainixDemoUri(imageSrc);
  const hasRenderableImage = canRenderImage && !imageFailed;
  const imageStageClassName = isLarge
    ? "absolute inset-x-4 bottom-5 top-6 sm:inset-x-6 sm:bottom-6 sm:top-8"
    : isMinimal
      ? "absolute inset-x-2 bottom-2 top-2 sm:inset-x-3 sm:bottom-3 sm:top-3"
      : "absolute inset-x-3 bottom-4 top-5 sm:inset-x-4 sm:bottom-5 sm:top-6";

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/10 shadow-glow",
        "aspect-[3/4] w-full",
        isLarge ? "mx-auto max-w-[28rem]" : "",
        className,
      )}
      style={{
        background: `radial-gradient(circle at 20% 20%, ${nft.accent}55, transparent 34%), radial-gradient(circle at 78% 22%, ${nft.secondaryAccent}99, transparent 28%), linear-gradient(160deg, rgba(10,10,14,0.96), rgba(28,8,12,0.94))`,
      }}
    >
      {hasRenderableImage ? (
        <div className={imageStageClassName}>
          <img
            src={imageSrc}
            alt={nft.name}
            className="h-full w-full object-contain object-center drop-shadow-[0_20px_42px_rgba(0,0,0,0.42)]"
            loading={isLarge ? "eager" : "lazy"}
            fetchPriority={isLarge ? "high" : "auto"}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageLoaded(false);
              setImageFailed(true);
            }}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "absolute inset-0",
          isMinimal
            ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(12,8,10,0.08)_38%,rgba(7,5,6,0.2)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(14,10,14,0.1)_36%,rgba(8,6,8,0.46)_100%)]",
        )}
      />
      <div className={cn("absolute inset-0 screen-grid", isMinimal ? "opacity-25" : "opacity-45")} />
      <div
        className={cn(
          "absolute rounded-full blur-[88px]",
          isMinimal ? "-left-8 top-6 h-24 w-24 opacity-60" : "-left-10 top-8 h-32 w-32",
        )}
        style={{ backgroundColor: nft.accent }}
      />

      {!isMinimal ? (
        <>
          <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-zinc-300 sm:right-5 sm:top-5 sm:text-[11px]">
            Token #{nft.tokenId}
          </div>
          <div className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300 sm:text-[11px]">
            {nft.collection}
          </div>
          <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] text-zinc-200 sm:left-5 sm:top-5">
            {nft.rarity}
          </div>
        </>
      ) : null}

      {!imageLoaded ? (
        <div className={cn("absolute inset-x-0 bottom-0", isMinimal ? "p-3" : "p-6")}>
          <div
            className={cn(
              "inline-flex items-center rounded-[24px] border border-white/10 bg-black/30 backdrop-blur-xl",
              isMinimal ? "px-4 py-2" : "px-5 py-3",
            )}
          >
            <span
              className={cn(
                "font-display font-semibold tracking-[0.2em] text-white/95",
                isLarge ? "text-7xl" : isMinimal ? "text-3xl" : "text-5xl",
              )}
            >
              {nft.previewSymbol}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
