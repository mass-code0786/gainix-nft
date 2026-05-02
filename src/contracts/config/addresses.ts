import type { Address } from "viem";
import { contractActiveChain, contractDefaultChain } from "@/contracts/config/chain";

interface GainixAddresses {
  nft: Address | null;
  marketplace: Address;
  botPass: Address;
  withdrawal: Address;
}

const zeroAddress = "0x0000000000000000000000000000000000000000";
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

function envAddress(name: string, fallback?: string) {
  return (process.env[name]?.trim() ?? fallback ?? zeroAddress) as Address;
}

function envOptionalNonZeroAddress(name: string) {
  const rawAddress = process.env[name]?.trim();

  if (!rawAddress || rawAddress.toLowerCase() === zeroAddress || !evmAddressPattern.test(rawAddress)) {
    return null;
  }

  return rawAddress as Address;
}

export function isValidNonZeroAddress(address: string | null | undefined): address is Address {
  return Boolean(address && evmAddressPattern.test(address) && address.toLowerCase() !== zeroAddress);
}

function assertProductionAddress(name: string, rawAddress: string | undefined, address: Address | null) {
  const trimmedAddress = rawAddress?.trim();

  if (!trimmedAddress) {
    throw new Error(`${name} is required when NEXT_PUBLIC_CHAIN_ID=56 in production.`);
  }

  if (!evmAddressPattern.test(trimmedAddress)) {
    throw new Error(`${name} must use 0x followed by 40 hex characters when NEXT_PUBLIC_CHAIN_ID=56 in production.`);
  }

  if (trimmedAddress.toLowerCase() === zeroAddress) {
    throw new Error(`${name} must not be the zero address in production.`);
  }
}

export const gainixContractAddresses: Record<number, GainixAddresses> = {
  [contractDefaultChain.id]: {
    nft: envOptionalNonZeroAddress("NEXT_PUBLIC_GAINIX_NFT_ADDRESS"),
    marketplace: envAddress("NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS"),
    botPass: envAddress("NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS"),
    withdrawal: envAddress("NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS"),
  },
};

if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_CHAIN_ID === String(contractDefaultChain.id)) {
  const addresses = gainixContractAddresses[contractDefaultChain.id];
  assertProductionAddress("NEXT_PUBLIC_GAINIX_NFT_ADDRESS", process.env.NEXT_PUBLIC_GAINIX_NFT_ADDRESS, addresses.nft);
  assertProductionAddress(
    "NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS",
    process.env.NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS,
    addresses.marketplace,
  );
  assertProductionAddress("NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS", process.env.NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS, addresses.botPass);
  assertProductionAddress(
    "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
    process.env.NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS,
    addresses.withdrawal,
  );
}

export function getGainixAddresses(chainId: number = contractDefaultChain.id) {
  return gainixContractAddresses[chainId] ?? gainixContractAddresses[contractDefaultChain.id];
}

if (process.env.NODE_ENV === "development") {
  console.debug("[Gainix web3 config]", {
    selectedChainId: contractActiveChain.id,
    selectedChainName: contractActiveChain.name,
    contractAddresses: getGainixAddresses(contractActiveChain.id),
  });
}
