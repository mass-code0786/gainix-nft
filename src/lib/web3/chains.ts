import { bsc } from "wagmi/chains";

export const gainixChains = [bsc] as const;
export const gainixDefaultChain = bsc;
export const gainixMainnetChain = bsc;

const supportedChainIds = new Set<number>(gainixChains.map((chain) => chain.id));

export function getConfiguredGainixChainId() {
  const rawChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!rawChainId) {
    return gainixMainnetChain.id;
  }

  const chainId = Number(rawChainId);
  if (!Number.isInteger(chainId) || !supportedChainIds.has(chainId)) {
    throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID: ${rawChainId}`);
  }

  return chainId;
}

export const gainixActiveChainId = getConfiguredGainixChainId();
export const gainixActiveChain =
  gainixChains.find((chain) => chain.id === gainixActiveChainId) ?? gainixMainnetChain;

export const gainixChainLabels: Record<number, string> = {
  [bsc.id]: "BNB Smart Chain Mainnet",
};
