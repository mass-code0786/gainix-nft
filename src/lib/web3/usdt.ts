import { bsc } from "wagmi/chains";
import type { Address } from "viem";

export const USDT_DECIMALS = 18;
export const USDT_SYMBOL = "USDT";

export const usdtPaymentConfig = {
  tokenAddress: (process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS ?? "") as Address,
  treasuryAddress: (process.env.NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS ?? "") as Address,
  chainId: Number(process.env.NEXT_PUBLIC_USDT_CHAIN_ID ?? process.env.NEXT_PUBLIC_BSC_CHAIN_ID ?? bsc.id),
  decimals: USDT_DECIMALS,
  symbol: USDT_SYMBOL,
};

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
  return Boolean(usdtPaymentConfig.tokenAddress && usdtPaymentConfig.treasuryAddress);
}
