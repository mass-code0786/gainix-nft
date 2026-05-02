import { createPublicClient, decodeEventLog, formatUnits, http, isAddressEqual, parseAbiItem, type Address, type Hex } from "viem";
import { ApiError } from "@/server/api/errors";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const blockedProductionAddresses = new Set([
  zeroAddress,
  "0x4444444444444444444444444444444444444456",
  "0x4444444444444444444444444444444444444457",
]);

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `${name} is not configured.`);
  }

  return value;
}

export function getServerUsdtConfig() {
  const config = {
    tokenAddress: requiredEnv("USDT_TOKEN_ADDRESS") as Address,
    treasuryAddress: (process.env.PLATFORM_TREASURY_ADDRESS ?? process.env.PLATFORM_TREASURY_WALLET ?? requiredEnv("PLATFORM_TREASURY_ADDRESS")) as Address,
    rpcUrl: requiredEnv("BSC_RPC_URL"),
    chainId: Number(requiredEnv("BSC_CHAIN_ID")),
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
