import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  isAddress,
  isAddressEqual,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { ApiError } from "@/server/api/errors";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const bscMainnetUsdtAddress = "0x55d398326f99059fF775485246999027B3197955";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const blockedProductionAddresses = new Set([
  zeroAddress,
  "0x4444444444444444444444444444444444444456",
  "0x4444444444444444444444444444444444444457",
]);

const tokenEnvNames = ["NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS"] as const;
const treasuryEnvNames = [
  "NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS",
  "PLATFORM_TREASURY_ADDRESS",
  "PLATFORM_TREASURY_WALLET",
  "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
  "WITHDRAWAL_VAULT_ADDRESS",
] as const;
const chainIdEnvNames = ["NEXT_PUBLIC_USDT_CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID", "BSC_CHAIN_ID"] as const;
const rpcEnvNames = ["BSC_RPC_URL", "NEXT_PUBLIC_BSC_MAINNET_RPC_URL", "NEXT_PUBLIC_BSC_RPC_URL"] as const;

function envValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return { key: name, value };
    }
  }

  return { key: null, value: "" };
}

function logDepositConfigState(input: {
  missingKeys: string[];
  resolvedKeys: Record<string, string | null>;
  chainId: number;
  hasTreasuryAddress: boolean;
  hasUsdtAddress: boolean;
}) {
  const payload = {
    missingKeys: input.missingKeys,
    resolvedKeys: input.resolvedKeys,
    chainId: input.chainId,
    hasTreasuryAddress: input.hasTreasuryAddress,
    hasUsdtAddress: input.hasUsdtAddress,
  };

  if (input.missingKeys.length > 0) {
    console.error("[gainix:deposit-config] Missing or invalid USDT deposit config:", {
      ...payload,
      expected: {
        usdtToken: tokenEnvNames.join(" or "),
        treasury: treasuryEnvNames.join(" or "),
        chainId: chainIdEnvNames.join(" or "),
        rpcUrl: rpcEnvNames.join(" or "),
      },
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[gainix:deposit-config] Resolved USDT deposit config:", payload);
  }
}

function requireConfigAddress(value: string, key: string) {
  if (!isAddress(value) || value.toLowerCase() === zeroAddress) {
    throw new ApiError(500, `${key} is not configured.`);
  }

  return value as Address;
}

function requireConfigValue(value: string, key: string) {
  if (!value) {
    throw new ApiError(500, `${key} is not configured.`);
  }

  return value;
}

export function getServerUsdtConfig() {
  const token = envValue(tokenEnvNames);
  const treasury = envValue(treasuryEnvNames);
  const rpc = envValue(rpcEnvNames);
  const rawChainId = envValue(chainIdEnvNames);
  const tokenAddress = token.value || bscMainnetUsdtAddress;
  const treasuryAddress = treasury.value;
  const rpcUrl = rpc.value;
  const rawChainIdValue = rawChainId.value || "56";
  const chainId = Number(rawChainIdValue);
  const missingKeys = [
    isAddress(tokenAddress) && tokenAddress.toLowerCase() !== zeroAddress ? null : "USDT_TOKEN_ADDRESS",
    isAddress(treasuryAddress) && treasuryAddress.toLowerCase() !== zeroAddress ? null : "TREASURY_ADDRESS",
    rpcUrl ? null : "BSC_RPC_URL",
    Number.isFinite(chainId) && chainId > 0 ? null : "BSC_CHAIN_ID",
  ].filter((key): key is string => Boolean(key));

  logDepositConfigState({
    missingKeys,
    resolvedKeys: {
      usdtToken: token.key ?? "BSC_MAINNET_USDT_DEFAULT",
      treasury: treasury.key,
      chainId: rawChainId.key ?? "BSC_MAINNET_CHAIN_ID_DEFAULT",
      rpcUrl: rpc.key,
    },
    chainId,
    hasTreasuryAddress: Boolean(treasuryAddress),
    hasUsdtAddress: Boolean(tokenAddress),
  });

  if (missingKeys.length > 0) {
    throw new ApiError(500, `USDT deposit configuration is incomplete: ${missingKeys.join(", ")}.`);
  }

  const config = {
    tokenAddress: requireConfigAddress(tokenAddress, "USDT_TOKEN_ADDRESS"),
    treasuryAddress: requireConfigAddress(treasuryAddress, "TREASURY_ADDRESS"),
    rpcUrl: requireConfigValue(rpcUrl, "BSC_RPC_URL"),
    chainId,
    decimals: 18,
    confirmations: Number(process.env.BSC_DEPOSIT_CONFIRMATIONS ?? 1),
  };

  if (process.env.NODE_ENV === "production" && config.chainId === 56) {
    const treasury = config.treasuryAddress.toLowerCase();
    if (blockedProductionAddresses.has(treasury)) {
      throw new ApiError(500, "Production treasury address must be a real non-placeholder address.");
    }
  }

  return config;
}

export function getPublicUsdtConfig() {
  const config = getServerUsdtConfig();

  return {
    tokenAddress: config.tokenAddress,
    treasuryAddress: config.treasuryAddress,
    chainId: config.chainId,
    decimals: config.decimals,
    symbol: "USDT",
  };
}

function roundAmount(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100_000_000) / 100_000_000;
}

export async function verifyUsdtDepositTransaction(input: {
  walletAddress: string;
  txHash: string;
  expectedAmount: number;
}) {
  const config = getServerUsdtConfig();
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  const receipt = await client.getTransactionReceipt({ hash: input.txHash as Hex }).catch(() => null);
  if (!receipt) {
    throw new ApiError(404, "Transaction receipt not found.");
  }

  if (receipt.status !== "success") {
    throw new ApiError(409, "Transaction was not successful.");
  }

  const currentBlock = await client.getBlockNumber();
  const confirmations = Number(currentBlock - receipt.blockNumber + BigInt(1));
  if (confirmations < config.confirmations) {
    throw new ApiError(409, "Transaction is not confirmed yet.");
  }

  const transferLog = receipt.logs.find((log) => {
    if (!isAddressEqual(log.address, config.tokenAddress)) {
      return false;
    }

    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data,
        topics: log.topics,
      });
      const from = decoded.args.from as Address;
      const to = decoded.args.to as Address;
      return (
        isAddressEqual(from, input.walletAddress as Address) &&
        isAddressEqual(to, config.treasuryAddress)
      );
    } catch {
      return false;
    }
  });

  if (!transferLog) {
    throw new ApiError(409, "Matching USDT transfer to treasury not found.");
  }

  const decoded = decodeEventLog({
    abi: [transferEvent],
    data: transferLog.data,
    topics: transferLog.topics,
  });
  const rawAmount = decoded.args.value as bigint;
  const creditedAmount = roundAmount(Number(formatUnits(rawAmount, config.decimals)));
  const expectedAmount = roundAmount(input.expectedAmount);

  if (creditedAmount !== expectedAmount) {
    throw new ApiError(409, "USDT transfer amount does not match expected amount.");
  }

  return {
    chainId: config.chainId,
    tokenAddress: config.tokenAddress.toLowerCase(),
    treasuryAddress: config.treasuryAddress.toLowerCase(),
    creditedAmount,
    confirmations,
  };
}
