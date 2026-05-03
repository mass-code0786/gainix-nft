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
  const [imageFailed, setImageFailed] = useState(false);
  const canRenderImage = Boolean(imageSrc) && /^https?:\/\//i.test(imageSrc) && !isLegacyGainixDemoUri(imageSrc);
  const hasRenderableImage = canRenderImage && !imageFailed;
  const imageStageClassName = isLarge
    ? "absolute inset-x-4 bottom-5 top-6 sm:inset-x-6 sm:bottom-6 sm:top-8"
    : isMinimal
      ? "absolute inset-x-2 bottom-2 top-2 sm:inset-x-3 sm:bottom-3 sm:top-3"
      : "absolute inset-x-3 bottom-4 top-5 sm:inset-x-4 sm:bottom-5 sm:top-6";

  useEffect(() => {
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
            onError={() => {
              setImageFailed(true);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
