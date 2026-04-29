import {
  createPublicClient,
  decodeFunctionData,
  http,
  isAddressEqual,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { withdrawalAbi } from "@/contracts/abis/withdrawal.abi";
import { ApiError } from "@/server/api/errors";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `${name} is not configured.`);
  }

  return value;
}

export function getServerWithdrawalConfig() {
  return {
    contractAddress: requiredEnv("WITHDRAWAL_CONTRACT_ADDRESS") as Address,
    rpcUrl: requiredEnv("BSC_RPC_URL"),
    chainId: Number(requiredEnv("BSC_CHAIN_ID")),
    decimals: 18,
    confirmations: Number(process.env.BSC_WITHDRAWAL_CONFIRMATIONS ?? 1),
  };
}

export async function verifyWithdrawalTransaction(input: {
  walletAddress: string;
  txHash: string;
  netAmount: number;
}) {
  const config = getServerWithdrawalConfig();
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash: input.txHash as Hex }).catch(() => null),
    client.getTransaction({ hash: input.txHash as Hex }).catch(() => null),
  ]);

  if (!receipt || !transaction) {
    throw new ApiError(404, "Withdrawal transaction not found.");
  }

  if (receipt.status !== "success") {
    throw new ApiError(409, "Withdrawal transaction failed.");
  }

  if (!transaction.to || !isAddressEqual(transaction.to, config.contractAddress)) {
    throw new ApiError(409, "Transaction was not sent to the withdrawal contract.");
  }

  if (!isAddressEqual(transaction.from, input.walletAddress as Address)) {
    throw new ApiError(409, "Transaction sender does not match wallet.");
  }

  const decoded = decodeFunctionData({
    abi: withdrawalAbi,
    data: transaction.input,
  });

  if (decoded.functionName !== "withdraw") {
    throw new ApiError(409, "Transaction did not call withdraw.");
  }

  const [user, amount] = decoded.args;
  if (!isAddressEqual(user, input.walletAddress as Address)) {
    throw new ApiError(409, "Withdrawal recipient does not match wallet.");
  }

  const expectedAmount = parseUnits(input.netAmount.toFixed(config.decimals), config.decimals);
  if (amount !== expectedAmount) {
    throw new ApiError(409, "Withdrawal transaction amount does not match net amount.");
  }

  const currentBlock = await client.getBlockNumber();
  const confirmations = Number(currentBlock - receipt.blockNumber + BigInt(1));
  if (confirmations < config.confirmations) {
    throw new ApiError(409, "Withdrawal transaction is not confirmed yet.");
  }

  return {
    txHash: input.txHash.toLowerCase(),
    confirmations,
    chainId: config.chainId,
    contractAddress: config.contractAddress.toLowerCase(),
  };
}
