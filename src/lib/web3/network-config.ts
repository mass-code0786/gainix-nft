import type { Address } from "viem";
import { gainixActiveChainId, gainixDefaultChain } from "@/lib/web3/chains";

interface GainixNetworkConfig {
  chainId: number;
  label: string;
  rpcUrl: string;
  explorerBaseUrl: string;
}

export const gainixNetworkConfig: Record<number, GainixNetworkConfig> = {
  [gainixDefaultChain.id]: {
    chainId: gainixDefaultChain.id,
    label: "BNB Smart Chain Mainnet",
    rpcUrl: process.env.NEXT_PUBLIC_BSC_MAINNET_RPC_URL ?? "https://bsc-dataseed.binance.org",
    explorerBaseUrl: "https://bscscan.com",
  },
};

export function getGainixNetwork(chainId?: number) {
  if (!chainId) {
    return gainixNetworkConfig[gainixActiveChainId];
  }

  return gainixNetworkConfig[chainId] ?? gainixNetworkConfig[gainixDefaultChain.id];
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
