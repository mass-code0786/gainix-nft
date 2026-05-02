import { bsc } from "wagmi/chains";
import { isAddress, zeroAddress, type Address } from "viem";

export const USDT_DECIMALS = 18;
export const USDT_SYMBOL = "USDT";
export const BSC_MAINNET_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955" as Address;

function envAddress(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value as Address;
    }
  }

  return "" as Address;
}

function logMissingDepositConfig(missingKeys: string[]) {
  if (missingKeys.length === 0 || process.env.NODE_ENV === "production") {
    return;
  }

  console.warn("[gainix:deposit-config] Missing or invalid deposit config:", {
    missingKeys,
    expected: {
      usdtToken: "NEXT_PUBLIC_USDT_TOKEN_ADDRESS or USDT_TOKEN_ADDRESS",
      withdrawalVault: "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS or WITHDRAWAL_VAULT_ADDRESS",
    },
  });
}

export const usdtPaymentConfig = {
  tokenAddress: envAddress("NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS") || BSC_MAINNET_USDT_ADDRESS,
  treasuryAddress: envAddress(
    "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
    "WITHDRAWAL_VAULT_ADDRESS",
    "NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS",
    "PLATFORM_TREASURY_ADDRESS",
    "PLATFORM_TREASURY_WALLET",
  ),
  chainId: Number(process.env.NEXT_PUBLIC_USDT_CHAIN_ID ?? process.env.NEXT_PUBLIC_BSC_CHAIN_ID ?? bsc.id),
  decimals: USDT_DECIMALS,
  symbol: USDT_SYMBOL,
};

export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function hasUsdtPaymentConfig() {
  const missingKeys = [
    isAddress(usdtPaymentConfig.tokenAddress) && usdtPaymentConfig.tokenAddress.toLowerCase() !== zeroAddress
      ? null
      : "USDT_TOKEN_ADDRESS",
    isAddress(usdtPaymentConfig.treasuryAddress) && usdtPaymentConfig.treasuryAddress.toLowerCase() !== zeroAddress
      ? null
      : "WITHDRAWAL_VAULT_ADDRESS",
  ].filter((key): key is string => Boolean(key));

  logMissingDepositConfig(missingKeys);

  return missingKeys.length === 0;
}
