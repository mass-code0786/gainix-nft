import type { Address } from "viem";
import { contractActiveChain, contractDefaultChain } from "@/contracts/config/chain";

interface GainixAddresses {
  nft: Address;
  marketplace: Address;
  botPass: Address;
  withdrawal: Address;
}

const zeroAddress = "0x0000000000000000000000000000000000000000";
const placeholderAddresses = new Set(
  [
    zeroAddress,
    "0x1111111111111111111111111111111111111156",
    "0x1111111111111111111111111111111111111157",
    "0x2222222222222222222222222222222222222256",
    "0x2222222222222222222222222222222222222257",
    "0x3333333333333333333333333333333333333356",
    "0x3333333333333333333333333333333333333357",
    "0x4444444444444444444444444444444444444456",
    "0x4444444444444444444444444444444444444457",
  ].map((address) => address.toLowerCase()),
);

function envAddress(name: string, fallback?: string) {
  return (process.env[name] ?? fallback ?? zeroAddress) as Address;
}

function assertProductionAddress(name: string, rawAddress: string | undefined, address: Address) {
  if (!rawAddress) {
    throw new Error(`${name} is required when NEXT_PUBLIC_CHAIN_ID=56 in production.`);
  }

  const normalized = address.toLowerCase();
  if (placeholderAddresses.has(normalized)) {
    throw new Error(`${name} must be a deployed mainnet contract address in production.`);
  }
}

export const gainixContractAddresses: Record<number, GainixAddresses> = {
  [contractDefaultChain.id]: {
    nft: envAddress("NEXT_PUBLIC_GAINIX_NFT_ADDRESS"),
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
