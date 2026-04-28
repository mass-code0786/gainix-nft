import { nftContract } from "@/contracts";
import { getMockNfts } from "@/lib/data-sources/mock-source";
import type { NFTItem } from "@/types";

type BackendNftRecord = {
  id: string;
  tokenId: string;
  name: string;
  imageUrl: string;
  basePrice: number;
  currentPrice: number;
  lastBuyPrice: number | null;
  totalTrades: number;
  status: "marketplace" | "owned" | "listed" | "sold";
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
const mockNftMap = new Map(getMockNfts().map((item) => [item.tokenId, item]));

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
  const mock = mockNftMap.get(tokenId);
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
    slug: mock?.slug ?? `${slugify(nft.name)}-${tokenId}`,
    name: nft.name,
    animalType: mock?.animalType ?? "Gainix NFT",
    collection: mock?.collection ?? "Gainix NFT Marketplace",
    currentPrice,
    listedPrice,
    changePercent: Number(derivedChange.toFixed(2)),
    rarity: mock?.rarity ?? "Rare",
    accent: mock?.accent ?? "#f43f5e",
    secondaryAccent: mock?.secondaryAccent ?? "#450a0a",
    description: mock?.description ?? `${nft.name} available in the Gainix marketplace.`,
    owner: ownerAddress,
    creator: mock?.creator ?? ZERO_ADDRESS,
    seller: options?.sellerAddress ?? (listedPrice !== null ? ownerAddress : undefined),
    floorPrice: mock?.floorPrice ?? basePrice,
    previewSymbol: mock?.previewSymbol ?? nft.name.slice(0, 2).toUpperCase(),
    supply: mock?.supply ?? 1,
    rank: mock?.rank ?? tokenId,
    tags: mock?.tags ?? ["Marketplace"],
    activity: [],
    relatedSlugs: mock?.relatedSlugs ?? [],
    contractAddress: mock?.contractAddress ?? nftContract.address,
    listingId: listedPrice !== null ? nft.id : undefined,
    tokenUri: mock?.tokenUri ?? `ipfs://gainix/${tokenId}.json`,
    ipfsMetadataUri: mock?.ipfsMetadataUri ?? `ipfs://gainix/${tokenId}.json`,
    imageUri: nft.imageUrl || mock?.imageUri || "",
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
