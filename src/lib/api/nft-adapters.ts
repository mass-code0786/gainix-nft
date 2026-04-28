import { nftContract } from "@/contracts";
import type { NFTItem } from "@/types";

type BackendNftRecord = {
  id: string;
  tokenId: string;
  name: string;
  description?: string;
  category?: string;
  imageUrl: string;
  basePrice: number;
  currentPrice: number;
  lastBuyPrice: number | null;
  totalTrades: number;
  status: "marketplace" | "owned" | "listed" | "sold" | "draft";
  ownerUserId: string | null;
  lastPriceIncreasePercent: number | null;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    walletAddress: `0x${string}`;
  } | null;
};

type BackendTradeRecord = {
  id: string;
  nftId: string;
  userId: string;
  buyPrice: number;
  sellPrice: number | null;
  profit: number | null;
  status: "bought" | "listed" | "auto_sold";
  listedAt: string | null;
  autoSellAt: string | null;
  soldAt: string | null;
  saleJobId: string | null;
  source: "manual" | "bot";
  botSubscriptionId: string | null;
  createdAt: string;
  nft?: BackendNftRecord | null;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function adaptBackendNftToItem(
  nft: BackendNftRecord,
  options?: {
    listedPrice?: number | null;
    ownerAddress?: `0x${string}` | null;
    sellerAddress?: `0x${string}` | null;
  },
): NFTItem {
  const tokenId = Number(nft.tokenId);
  const ownerAddress = options?.ownerAddress ?? nft.owner?.walletAddress ?? ZERO_ADDRESS;
  const listedPrice =
    typeof options?.listedPrice === "number"
      ? options.listedPrice
      : nft.status === "listed" || nft.status === "marketplace"
        ? nft.currentPrice
        : null;
  const currentPrice = listedPrice ?? nft.currentPrice;
  const basePrice = nft.basePrice || currentPrice;
  const derivedChange =
    typeof nft.lastPriceIncreasePercent === "number"
      ? nft.lastPriceIncreasePercent
      : basePrice > 0
        ? ((currentPrice - basePrice) / basePrice) * 100
        : 0;

  return {
    id: nft.id,
    tokenId,
    slug: `${slugify(nft.name)}-${tokenId}`,
    name: nft.name,
    animalType: nft.category ?? "Gainix NFT",
    collection: "Gainix NFT Marketplace",
    currentPrice,
    listedPrice,
    changePercent: Number(derivedChange.toFixed(2)),
    rarity: "Rare",
    accent: "#f43f5e",
    secondaryAccent: "#450a0a",
    description: nft.description || `${nft.name} available in the Gainix marketplace.`,
    owner: ownerAddress,
    creator: ZERO_ADDRESS,
    seller: options?.sellerAddress ?? (listedPrice !== null ? ownerAddress : undefined),
    floorPrice: basePrice,
    previewSymbol: nft.name.slice(0, 2).toUpperCase(),
    supply: 1,
    rank: tokenId,
    tags: nft.category ? [nft.category] : ["Marketplace"],
    activity: [],
    relatedSlugs: [],
    contractAddress: nftContract.address,
    listingId: listedPrice !== null ? nft.id : undefined,
    tokenUri: `ipfs://gainix/${tokenId}.json`,
    ipfsMetadataUri: `ipfs://gainix/${tokenId}.json`,
    imageUri: nft.imageUrl || "",
    network: "BNB Smart Chain",
  };
}

export function adaptBackendTradeToItem(
  trade: BackendTradeRecord,
  walletAddress?: `0x${string}` | null,
): NFTItem | null {
  if (!trade.nft) {
    return null;
  }

  return adaptBackendNftToItem(trade.nft, {
    listedPrice: trade.status === "listed" ? trade.nft.currentPrice : null,
    ownerAddress: walletAddress ?? trade.nft.owner?.walletAddress ?? ZERO_ADDRESS,
    sellerAddress: trade.status === "listed" ? walletAddress ?? trade.nft.owner?.walletAddress ?? ZERO_ADDRESS : undefined,
  });
}
