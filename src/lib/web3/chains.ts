import { bsc, bscTestnet } from "wagmi/chains";

export const gainixChains = [bsc, bscTestnet] as const;
export const gainixDefaultChain = bsc;
export const gainixTestChain = bscTestnet;

export const gainixChainLabels: Record<number, string> = {
  [bsc.id]: "BNB Smart Chain",
  [bscTestnet.id]: "BNB Smart Chain Testnet",
};
