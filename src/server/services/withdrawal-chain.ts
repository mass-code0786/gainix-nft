import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  http,
  isAddressEqual,
  parseUnits,
  stringToHex,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withdrawalAbi } from "@/contracts/abis/withdrawal.abi";
import { ApiError } from "@/server/api/errors";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(500, `${name} is not configured.`);
  }

  return value;
}

function firstRequiredEnv(names: string[]) {
  const name = names.find((key) => process.env[key]?.trim());
  if (!name) {
    throw new ApiError(500, `${names.join(" or ")} is not configured.`);
  }

  return process.env[name]!.trim();
}

function firstOptionalEnv(names: string[]) {
  const name = names.find((key) => process.env[key]?.trim());
  return name ? process.env[name]!.trim() : null;
}

export function getServerWithdrawalConfig() {
  return {
    contractAddress: firstRequiredEnv([
      "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_GAINIX_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_WITHDRAWAL_CONTRACT_ADDRESS",
      "WITHDRAWAL_VAULT_ADDRESS",
      "WITHDRAWAL_CONTRACT_ADDRESS",
    ]) as Address,
    rpcUrl: requiredEnv("BSC_RPC_URL"),
    chainId: Number(requiredEnv("BSC_CHAIN_ID")),
    decimals: 18,
    confirmations: Number(process.env.BSC_WITHDRAWAL_CONFIRMATIONS ?? 1),
  };
}

function getWithdrawalOperatorPrivateKey() {
  const privateKey = firstOptionalEnv([
    "WITHDRAWAL_OPERATOR_PRIVATE_KEY",
    "BACKEND_OPERATOR_PRIVATE_KEY",
    "OPERATOR_PRIVATE_KEY",
    "DEPLOYER_PRIVATE_KEY",
  ]);

  if (!privateKey) {
    throw new ApiError(500, "Withdrawal operator private key is not configured.");
  }

  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
}

export function makeWithdrawalRequestId(withdrawalId: string) {
  return keccak256(stringToHex(`gainix:withdrawal:${withdrawalId}`));
}

export async function authorizeUsdtWithdrawalOnChain(input: {
  walletAddress: string;
  netAmount: number;
  withdrawalId: string;
}) {
  const config = getServerWithdrawalConfig();
  const account = privateKeyToAccount(getWithdrawalOperatorPrivateKey());
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    transport: http(config.rpcUrl),
  });
  const amount = parseUnits(input.netAmount.toFixed(config.decimals), config.decimals);
  const requestId = makeWithdrawalRequestId(input.withdrawalId);

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: withdrawalAbi,
    functionName: "authorizeUSDTWithdrawal",
    args: [input.walletAddress as Address, amount, requestId],
    chain: null,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new ApiError(502, "USDT withdrawal authorization transaction failed.");
  }

  return {
    txHash: hash.toLowerCase(),
    requestId,
    contractAddress: config.contractAddress.toLowerCase(),
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

  if (decoded.functionName !== "withdrawUSDT") {
    throw new ApiError(409, "Transaction did not call withdrawUSDT.");
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
