import type { Address } from "viem";
import { gainixDefaultChain, gainixTestChain } from "@/lib/web3/chains";

interface GainixNetworkConfig {
  chainId: number;
  label: string;
  rpcUrl: string;
  explorerBaseUrl: string;
}

export const gainixNetworkConfig: Record<number, GainixNetworkConfig> = {
  [gainixDefaultChain.id]: {
    chainId: gainixDefaultChain.id,
    label: "BNB Smart Chain",
    rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org",
    explorerBaseUrl: "https://bscscan.com",
  },
  [gainixTestChain.id]: {
    chainId: gainixTestChain.id,
    label: "BNB Smart Chain Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerBaseUrl: "https://testnet.bscscan.com",
  },
};

export function getGainixNetwork(chainId?: number) {
  if (!chainId) {
    return gainixNetworkConfig[gainixTestChain.id];
  }

  return gainixNetworkConfig[chainId] ?? gainixNetworkConfig[gainixTestChain.id];
}

export function getExplorerAddressUrl(address: Address, chainId?: number) {
  const network = getGainixNetwork(chainId);
  return `${network.explorerBaseUrl}/address/${address}`;
}

export function getExplorerTxUrl(hash: `0x${string}`, chainId?: number) {
  const network = getGainixNetwork(chainId);
  return `${network.explorerBaseUrl}/tx/${hash}`;
}

export const gainixUseMockFallback = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
