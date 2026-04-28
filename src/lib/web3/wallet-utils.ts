import { getAddress, type Address } from "viem";
import { gainixChainLabels, gainixChains } from "@/lib/web3/chains";

export function shortenAddress(address?: Address | null, fallback = "Not connected") {
  if (!address) {
    return fallback;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function normalizeAddress(address?: string | null): Address | null {
  if (!address) {
    return null;
  }

  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return null;
  }

  try {
    return getAddress(trimmedAddress);
  } catch {
    return null;
  }
}

export function normalizeAddressForComparison(address?: string | null) {
  const normalizedAddress = normalizeAddress(address);

  return normalizedAddress ? normalizedAddress.toLowerCase() : null;
}

export function isSameAddress(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeAddressForComparison(left);
  const normalizedRight = normalizeAddressForComparison(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function getChainMetadata(chainId?: number) {
  if (!chainId) {
    return {
      chainName: "No network",
      isSupported: false,
      badgeTone: "border-zinc-600/30 bg-zinc-800/60 text-zinc-300",
    };
  }

  const chain = gainixChains.find((item) => item.id === chainId);
  const isSupported = Boolean(chain);

  return {
    chainName: gainixChainLabels[chainId] ?? chain?.name ?? `Chain ${chainId}`,
    isSupported,
    badgeTone: isSupported
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };
}
