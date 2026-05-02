import { bsc } from "wagmi/chains";
import { isAddress, zeroAddress, type Address } from "viem";

export const USDT_DECIMALS = 18;
export const USDT_SYMBOL = "USDT";
export const BSC_MAINNET_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955" as Address;

export interface UsdtPaymentConfig {
  tokenAddress: Address;
  treasuryAddress: Address;
  chainId: number;
  decimals: number;
  symbol: string;
}

function envAddress(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return { key: name, value: value as Address };
    }
  }

  return { key: null, value: "" as Address };
}

function logDepositConfigState(input: {
  missingKeys: string[];
  resolvedKeys: Record<string, string | null>;
  chainId: number;
  hasTreasuryAddress: boolean;
  hasUsdtAddress: boolean;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const payload = {
    missingKeys: input.missingKeys,
    resolvedKeys: input.resolvedKeys,
    chainId: input.chainId,
    hasTreasuryAddress: input.hasTreasuryAddress,
    hasUsdtAddress: input.hasUsdtAddress,
  };

  if (input.missingKeys.length > 0) {
    console.warn("[gainix:deposit-config] Missing or invalid browser deposit config:", payload);
    return;
  }

  console.info("[gainix:deposit-config] Resolved browser deposit config:", payload);
}

const browserToken = envAddress("NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS");
const browserTreasury = envAddress(
    "NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS",
    "PLATFORM_TREASURY_ADDRESS",
    "PLATFORM_TREASURY_WALLET",
    "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
    "WITHDRAWAL_VAULT_ADDRESS",
);
const browserChainIdKey =
  process.env.NEXT_PUBLIC_USDT_CHAIN_ID
    ? "NEXT_PUBLIC_USDT_CHAIN_ID"
    : process.env.NEXT_PUBLIC_CHAIN_ID
      ? "NEXT_PUBLIC_CHAIN_ID"
      : process.env.BSC_CHAIN_ID
        ? "BSC_CHAIN_ID"
        : null;

export const usdtPaymentConfig: UsdtPaymentConfig = {
  tokenAddress: browserToken.value || BSC_MAINNET_USDT_ADDRESS,
  treasuryAddress: browserTreasury.value,
  chainId: Number(
    process.env.NEXT_PUBLIC_USDT_CHAIN_ID ??
      process.env.NEXT_PUBLIC_CHAIN_ID ??
      process.env.BSC_CHAIN_ID ??
      bsc.id,
  ),
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

  logDepositConfigState({
    missingKeys,
    resolvedKeys: {
      usdtToken: browserToken.key ?? "BSC_MAINNET_USDT_DEFAULT",
      treasury: browserTreasury.key,
      chainId: browserChainIdKey ?? "BSC_MAINNET_CHAIN_ID_DEFAULT",
    },
    chainId: usdtPaymentConfig.chainId,
    hasTreasuryAddress: Boolean(usdtPaymentConfig.treasuryAddress),
    hasUsdtAddress: Boolean(usdtPaymentConfig.tokenAddress),
  });

  return missingKeys.length === 0;
}
