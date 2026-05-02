"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  getMockNftBySlug,
  getMockNfts,
  getMockRelatedNfts,
} from "@/lib/data-sources/mock-source";
import { gainixUseMockFallback } from "@/lib/web3/network-config";
import { nftAbi } from "@/contracts";
import { getGainixAddresses } from "@/contracts/config/addresses";
import { contractActiveChainId } from "@/contracts/config/chain";
import { readGainixContractOrNull } from "@/lib/web3/read/contract-read";
import { useContractDataRefreshVersion } from "@/lib/web3/contract-data-refresh";
import {
  GAINIX_CHAIN_SCAN_WINDOW,
  buildLiveNftItem,
  GAINIX_TESTNET_SCAN_START_TOKEN_ID,
} from "@/lib/web3/live-nft";
import { buildCappedScanIds, GAINIX_RPC_SCAN_CAP, scanWithBatchCap } from "@/lib/web3/rpc-resilience";
import { resolveTokenMetadata } from "@/lib/web3/token-metadata";
import type { NFTItem } from "@/types";

const NFT_REFRESH_TIMEOUT_MS = 7_000;

function logResolvedMetadataImage(tokenId: number, metadata: Awaited<ReturnType<typeof resolveTokenMetadata>>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[gainix:nft-image]", {
    tokenId,
    rawMetadataImage: metadata.imageUri ?? null,
    resolvedImageUrl: metadata.imageHttpUrl ?? null,
  });
}

function createTimeoutPromise(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`NFT refresh timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
}

export function useNFTs() {
  const mockItems = useMemo(() => getMockNfts(), []);
  const [items, setItems] = useState<NFTItem[]>(mockItems);
  const [source, setSource] = useState<"mock" | "chain">("mock");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeChainId = contractActiveChainId;
  const addresses = getGainixAddresses(activeChainId);
  const client = usePublicClient({ chainId: activeChainId });
  const refreshVersion = useContractDataRefreshVersion();

  const refresh = useCallback(async () => {
    if (gainixUseMockFallback || !client) {
      setItems(mockItems);
      setSource("mock");
      return;
    }

    setIsRefreshing(true);

    try {
      await Promise.race([
        (async () => {
          const nextTokenId = await readGainixContractOrNull({
            address: addresses.nft,
            abi: nftAbi,
            functionName: "nextTokenId",
            client,
          });

          if (nextTokenId === null) {
            setItems(mockItems);
            setSource("mock");
            return;
          }

          const lastTokenId = Number(nextTokenId) - 1;
          const chainTokenIds = buildCappedScanIds({
            lastId: lastTokenId,
            minId: GAINIX_TESTNET_SCAN_START_TOKEN_ID,
            scanCap: Math.min(GAINIX_CHAIN_SCAN_WINDOW, GAINIX_RPC_SCAN_CAP),
          });
          const { items: chainTokens, aborted } = await scanWithBatchCap({
            ids: chainTokenIds,
            read: async (tokenId) => {
              const [owner, tokenUri] = await Promise.all([
                readGainixContractOrNull({
                  address: addresses.nft,
                  abi: nftAbi,
                  functionName: "ownerOf",
                  args: [BigInt(tokenId)],
                  client,
                }),
                readGainixContractOrNull({
                  address: addresses.nft,
                  abi: nftAbi,
                  functionName: "tokenURI",
                  args: [BigInt(tokenId)],
                  client,
                }),
              ]);

              if (!owner || !tokenUri) {
                return null;
              }

              return { tokenId, owner, tokenUri };
            },
          });

          if (aborted && chainTokens.length === 0) {
            setItems(mockItems);
            setSource("mock");
            return;
          }

          const chainTokenMap = new Map(chainTokens.map((item) => [item.tokenId, item]));
          const matchedMockItemsRaw = await Promise.all(
            mockItems.map(async (item) => {
              const chainItem = chainTokenMap.get(item.tokenId);

              if (!chainItem) {
                return null;
              }

              const metadata = await resolveTokenMetadata(chainItem.tokenUri);
              logResolvedMetadataImage(chainItem.tokenId, metadata);
              const categoryAttribute = metadata.attributes?.find(
                (entry) => entry.trait_type?.toLowerCase() === "category",
              );

              return {
                ...item,
                owner: chainItem.owner,
                contractAddress: addresses.nft,
                tokenUri: metadata.metadataUri,
                ipfsMetadataUri: metadata.metadataUri,
                imageUri: metadata.imageHttpUrl ?? metadata.imageUri ?? item.imageUri,
                name: metadata.name ?? item.name,
                description: metadata.description ?? item.description,
                animalType:
                  (typeof categoryAttribute?.value === "string" ? categoryAttribute.value : undefined) ?? item.animalType,
              };
            }),
          );
          const matchedMockItems = matchedMockItemsRaw.filter(
            (item): item is Exclude<(typeof matchedMockItemsRaw)[number], null> => item !== null,
          );

          const knownTokenIds = new Set(mockItems.map((item) => item.tokenId));
          const discoveredItems = await Promise.all(
            chainTokens
              .filter((item) => !knownTokenIds.has(item.tokenId))
              .sort((left, right) => right.tokenId - left.tokenId)
              .map(async (item) => {
                const metadata = await resolveTokenMetadata(item.tokenUri);
                logResolvedMetadataImage(item.tokenId, metadata);
                const categoryAttribute = metadata.attributes?.find(
                  (entry) => entry.trait_type?.toLowerCase() === "category",
                );

                return buildLiveNftItem({
                  tokenId: item.tokenId,
                  owner: item.owner,
                  contractAddress: addresses.nft,
                  tokenUri: metadata.metadataUri,
                  imageUri: metadata.imageHttpUrl ?? metadata.imageUri,
                  name: metadata.name,
                  description: metadata.description,
                  animalType: typeof categoryAttribute?.value === "string" ? categoryAttribute.value : undefined,
                });
              }),
          );

          const nextItems = [...matchedMockItems, ...discoveredItems].sort((left, right) => right.tokenId - left.tokenId);

          setItems(nextItems);
          setSource("chain");
        })(),
        createTimeoutPromise(NFT_REFRESH_TIMEOUT_MS),
      ]);
    } catch {
      setItems(mockItems);
      setSource("mock");
    } finally {
      setIsRefreshing(false);
    }
  }, [addresses.nft, client, mockItems]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshVersion]);

  return {
    source,
    isRefreshing,
    nfts: items,
    featured: items[0],
    getByTokenId: (tokenId: number) => items.find((item) => item.tokenId === tokenId),
    getBySlug: (slug: string) => items.find((item) => item.slug === slug) ?? (source === "mock" ? getMockNftBySlug(slug) : undefined),
    getRelated: (slugs: string[]) => {
      const related = items.filter((item) => slugs.includes(item.slug));
      return related.length || source !== "mock" ? related : getMockRelatedNfts(slugs);
    },
    refresh,
  };
}
