import type { Address } from "viem";
import type { NFTItem, PortfolioHolding } from "@/types";
import { ipfsToHttp } from "@/lib/web3/token-metadata";

const livePalette = [
  { accent: "#f43f5e", secondaryAccent: "#7f1d1d", category: "Genesis" },
  { accent: "#f97316", secondaryAccent: "#7c2d12", category: "Vault" },
  { accent: "#eab308", secondaryAccent: "#713f12", category: "Signal" },
  { accent: "#22c55e", secondaryAccent: "#14532d", category: "Relay" },
  { accent: "#0ea5e9", secondaryAccent: "#0f172a", category: "Orbit" },
  { accent: "#8b5cf6", secondaryAccent: "#312e81", category: "Pulse" },
] as const;

export const GAINIX_CHAIN_SCAN_START_TOKEN_ID = 1000;
export const GAINIX_CHAIN_SCAN_WINDOW = 48;

function getPalette(tokenId: number) {
  return livePalette[tokenId % livePalette.length] ?? livePalette[0];
}

export function buildLiveNftSlug(tokenId: number) {
  return `gainix-mainnet-${tokenId}`;
}

export function buildLiveNftItem({
  tokenId,
  owner,
  contractAddress,
  tokenUri,
  imageUri,
  name,
  description,
  animalType,
  listedPrice = null,
  listingId,
  seller,
}: {
  tokenId: number;
  owner: Address;
  contractAddress: Address;
  tokenUri: string;
  imageUri?: string;
  name?: string;
  description?: string;
  animalType?: string;
  listedPrice?: number | null;
  listingId?: string;
  seller?: Address;
}): NFTItem {
  const palette = getPalette(tokenId);
  const basePrice = Number((0.28 + (tokenId % 7) * 0.05).toFixed(2));
  const currentPrice = listedPrice ?? basePrice;
  const floorPrice = Number((currentPrice * 0.92).toFixed(2));

  return {
    id: `live-${tokenId}`,
    tokenId,
    slug: buildLiveNftSlug(tokenId),
    name: name?.trim() || `Gainix Mainnet #${tokenId}`,
    animalType: animalType?.trim() || palette.category,
    collection: "Gainix Mainnet Collection",
    currentPrice,
    listedPrice,
    changePercent: Number((((tokenId % 9) - 4) * 1.35).toFixed(2)),
    rarity: tokenId % 5 === 0 ? "Legendary" : tokenId % 3 === 0 ? "Epic" : tokenId % 2 === 0 ? "Rare" : "Uncommon",
    accent: palette.accent,
    secondaryAccent: palette.secondaryAccent,
    description: description?.trim() || "A live Gainix collectible with real ownership, market status, and collection metadata.",
    owner,
    creator: seller ?? owner,
    seller,
    floorPrice,
    previewSymbol: `G${String(tokenId).slice(-2).padStart(2, "0")}`,
    supply: 1,
    rank: tokenId,
    tags:
      listedPrice !== null
        ? ["Live", "Listed", "BNB Smart Chain Mainnet"]
        : ["Live", "Wallet Owned", "BNB Smart Chain Mainnet"],
    activity: [],
    relatedSlugs: [],
    contractAddress,
    listingId,
    tokenUri,
    ipfsMetadataUri: tokenUri,
    imageUri: imageUri ? ipfsToHttp(imageUri) : "",
    network: "BNB Smart Chain",
  };
}

export function buildLivePortfolioHolding(nft: NFTItem): PortfolioHolding {
  const currentValue = nft.listedPrice ?? nft.currentPrice;
  const purchasedAt = Number((Math.max(currentValue * 0.82, 0.05)).toFixed(2));
  const profit = Number((currentValue - purchasedAt).toFixed(2));

  return {
    id: `live-holding-${nft.tokenId}`,
    nftSlug: nft.slug,
    tokenId: nft.tokenId,
    units: 1,
    totalInvested: purchasedAt,
    currentValue,
    purchasedAt,
    profit,
    status: nft.listedPrice !== null ? "Listed" : "Held",
    lastTrade: nft.listedPrice !== null ? "Live listing" : "Recently minted",
    contractAddress: nft.contractAddress,
  };
}
