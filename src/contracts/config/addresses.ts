import type { Address } from "viem";
import { contractDefaultChain, contractTestChain } from "@/contracts/config/chain";

interface GainixAddresses {
  nft: Address;
  marketplace: Address;
  botPass: Address;
  withdrawal: Address;
}

export const gainixContractAddresses: Record<number, GainixAddresses> = {
  [contractDefaultChain.id]: {
    nft: (process.env.NEXT_PUBLIC_BSC_NFT_CONTRACT ?? "0x1111111111111111111111111111111111111156") as Address,
    marketplace: (process.env.NEXT_PUBLIC_BSC_MARKETPLACE_CONTRACT ?? "0x2222222222222222222222222222222222222256") as Address,
    botPass: (process.env.NEXT_PUBLIC_BSC_BOTPASS_CONTRACT ?? "0x3333333333333333333333333333333333333356") as Address,
    withdrawal: (process.env.NEXT_PUBLIC_BSC_WITHDRAWAL_CONTRACT ?? "0x4444444444444444444444444444444444444456") as Address,
  },
  [contractTestChain.id]: {
    nft: (process.env.NEXT_PUBLIC_BSC_TESTNET_NFT_CONTRACT ?? "0x1111111111111111111111111111111111111157") as Address,
    marketplace: (process.env.NEXT_PUBLIC_BSC_TESTNET_MARKETPLACE_CONTRACT ?? "0x2222222222222222222222222222222222222257") as Address,
    botPass: (process.env.NEXT_PUBLIC_BSC_TESTNET_BOTPASS_CONTRACT ?? "0x3333333333333333333333333333333333333357") as Address,
    withdrawal: (process.env.NEXT_PUBLIC_BSC_TESTNET_WITHDRAWAL_CONTRACT ?? "0x4444444444444444444444444444444444444457") as Address,
  },
};

export function getGainixAddresses(chainId: number = contractDefaultChain.id) {
  return gainixContractAddresses[chainId] ?? gainixContractAddresses[contractDefaultChain.id];
}
