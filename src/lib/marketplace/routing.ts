import type { NFTItem } from "@/types";

const MARKETPLACE_TOKEN_PREFIX = "token-";
const LEGACY_LIVE_SLUG_PREFIX = "gainix-testnet-";

function parseNumericToken(value: string) {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const tokenId = Number(value);
  return Number.isSafeInteger(tokenId) ? tokenId : undefined;
}

export function buildMarketplaceRouteParam(tokenId: number) {
  return `${MARKETPLACE_TOKEN_PREFIX}${tokenId}`;
}

export function buildMarketplaceHref(target: Pick<NFTItem, "tokenId"> | number) {
  const tokenId = typeof target === "number" ? target : target.tokenId;
  return `/marketplace/${buildMarketplaceRouteParam(tokenId)}`;
}

export function parseMarketplaceRouteParam(routeParam: string) {
  if (routeParam.startsWith(MARKETPLACE_TOKEN_PREFIX)) {
    return {
      tokenId: parseNumericToken(routeParam.slice(MARKETPLACE_TOKEN_PREFIX.length)),
      slug: undefined,
    };
  }

  if (routeParam.startsWith(LEGACY_LIVE_SLUG_PREFIX)) {
    return {
      tokenId: parseNumericToken(routeParam.slice(LEGACY_LIVE_SLUG_PREFIX.length)),
      slug: undefined,
    };
  }

  return {
    tokenId: undefined,
    slug: routeParam,
  };
}
