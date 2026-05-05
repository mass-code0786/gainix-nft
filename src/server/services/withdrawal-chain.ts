import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  formatEther,
  formatUnits,
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
import {
  firstEnv,
  normalizeEvmAddress,
  resolveWithdrawalVaultAddress,
  WITHDRAWAL_VAULT_ENV_NAMES,
} from "@/server/services/withdrawal-config";

const erc20BalanceAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

let envFilesLoaded = false;

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function ensureWithdrawalEnvLoaded() {
  if (envFilesLoaded) {
    return;
  }

  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.mainnet"));
  envFilesLoaded = true;
}

function firstRequiredEnv(names: string[], step: string) {
  ensureWithdrawalEnvLoaded();
  const name = names.find((key) => process.env[key]?.trim());
  if (!name) {
    throw new ApiError(500, `${names.join(" or ")} is not configured.`, { step });
  }

  return process.env[name]!.trim();
}

function firstOptionalEnv(names: readonly string[]) {
  ensureWithdrawalEnvLoaded();
  return firstEnv(names);
}

export function getServerWithdrawalConfig() {
  const usdtTokenAddress = normalizeEvmAddress(
    firstRequiredEnv(["USDT_TOKEN_ADDRESS", "NEXT_PUBLIC_USDT_TOKEN_ADDRESS"], "ENV_USDT_TOKEN"),
  );
  if (!usdtTokenAddress) {
    throw new ApiError(500, "USDT token address is invalid.", { step: "ENV_USDT_TOKEN" });
  }

  const contractAddress = resolveWithdrawalVaultAddress();
  if (!contractAddress) {
    throw new ApiError(500, "Withdrawal vault address is invalid.", { step: "ENV_WITHDRAWAL_VAULT" });
  }

  return {
    contractAddress,
    rpcUrl: firstRequiredEnv(["BSC_RPC_URL", "BSC_MAINNET_RPC_URL", "NEXT_PUBLIC_BSC_MAINNET_RPC_URL"], "ENV_RPC_URL"),
    chainId: Number(firstRequiredEnv(["BSC_CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID"], "ENV_CHAIN_ID")),
    usdtTokenAddress,
    decimals: 18,
    confirmations: Number(process.env.BSC_WITHDRAWAL_CONFIRMATIONS ?? 1),
  };
}

function getWithdrawalOperatorPrivateKey() {
  const privateKey = firstOptionalEnv(["WITHDRAWAL_OPERATOR_PRIVATE_KEY"]);

  if (!privateKey) {
    throw new ApiError(500, "WITHDRAWAL_OPERATOR_PRIVATE_KEY is not configured.", { step: "ENV_OPERATOR_PRIVATE_KEY" });
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
  let step = "START";
  let vaultAddress: string | null = null;
  let operatorAddress: string | null = null;

  try {
    step = "ENV_CONFIG";
    ensureWithdrawalEnvLoaded();
    const envVaultAddress = firstOptionalEnv(WITHDRAWAL_VAULT_ENV_NAMES);
    const envOperatorPrivateKey = firstOptionalEnv([
      "WITHDRAWAL_OPERATOR_PRIVATE_KEY",
    ]);
    const envRpcUrl = firstOptionalEnv(["BSC_RPC_URL", "BSC_MAINNET_RPC_URL", "NEXT_PUBLIC_BSC_MAINNET_RPC_URL"]);
    console.info("[withdraw.approve.debug]", {
      step,
      envVaultPresent: Boolean(envVaultAddress),
      envOperatorPrivateKeyPresent: Boolean(envOperatorPrivateKey),
      envOperatorPrivateKeyLength: envOperatorPrivateKey?.length ?? 0,
      rpcUrl: envRpcUrl,
    });

    const config = getServerWithdrawalConfig();
    const operatorPrivateKey = getWithdrawalOperatorPrivateKey();
    const account = privateKeyToAccount(operatorPrivateKey);
    vaultAddress = config.contractAddress;
    operatorAddress = account.address;
    const client = createPublicClient({
      transport: http(config.rpcUrl),
    });
    const walletClient = createWalletClient({
      account,
      transport: http(config.rpcUrl),
    });
    const amount = parseUnits(input.netAmount.toFixed(config.decimals), config.decimals);
    const requestId = makeWithdrawalRequestId(input.withdrawalId);

    console.info("[withdraw.approve.debug]", {
      step: "ENV",
      envVaultPresent: Boolean(config.contractAddress),
      envOperatorPrivateKeyPresent: Boolean(operatorPrivateKey),
      envOperatorPrivateKeyLength: operatorPrivateKey.length,
      operatorAddress: account.address,
      vaultAddress: config.contractAddress,
      rpcUrl: config.rpcUrl,
    });
    console.info("[withdraw.config] normalizedVaultAddress=", config.contractAddress);

    step = "READ_OPERATOR_AUTH";
    console.info("[withdraw.approve.debug]", { step, operatorAddress: account.address });
    const isOperator = await client.readContract({
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "operators",
      args: [account.address],
    });

    step = "READ_OPERATOR_BNB_BALANCE";
    console.info("[withdraw.approve.debug]", { step, operatorAddress: account.address });
    const operatorBalance = await client.getBalance({ address: account.address });

    step = "READ_USDT_TOKEN";
    console.info("[withdraw.approve.debug]", { step, vaultAddress: config.contractAddress });
    const vaultUsdtToken = await client.readContract({
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "usdtToken",
    });

    step = "READ_VAULT_USDT_BALANCE";
    console.info("[withdraw.approve.debug]", { step, vaultAddress: config.contractAddress, usdtToken: vaultUsdtToken });
    const vaultUsdtBalance = await client.readContract({
      address: vaultUsdtToken,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [config.contractAddress],
    });

    console.info("[withdraw.approve]", {
      withdrawalId: input.withdrawalId,
      userWallet: input.walletAddress,
      netAmount: input.netAmount,
      netAmountWei: amount.toString(),
      requestId,
      vaultAddress: config.contractAddress,
      operatorAddress: account.address,
      operatorBnbBalance: formatEther(operatorBalance),
      vaultUsdtToken,
      configuredUsdtToken: config.usdtTokenAddress,
      vaultUsdtBalance: formatUnits(vaultUsdtBalance, config.decimals),
    });

    if (!isAddressEqual(vaultUsdtToken, config.usdtTokenAddress)) {
      throw new ApiError(500, "USDT token config does not match withdrawal vault.", { step: "VALIDATE_USDT_TOKEN" });
    }

    if (!isOperator) {
      throw new ApiError(409, "Withdrawal operator is not authorized on vault.", { step: "VALIDATE_OPERATOR_AUTH" });
    }

    if (operatorBalance <= BigInt(0)) {
      throw new ApiError(409, "Operator wallet needs BNB for gas.", { step: "VALIDATE_OPERATOR_BNB" });
    }

    if (vaultUsdtBalance < amount) {
      throw new ApiError(409, "Withdrawal vault has insufficient USDT.", { step: "VALIDATE_VAULT_USDT" });
    }

    step = "SIMULATE_PAYOUT_USDT";
    console.info("[withdraw.approve.debug]", {
      step,
      userWallet: input.walletAddress,
      netAmountWei: amount.toString(),
      requestId,
    });
    await client.simulateContract({
      account: account.address,
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "payoutUSDT",
      args: [input.walletAddress as Address, amount, requestId],
    });

    step = "PAYOUT_USDT";
    console.info("[withdraw.approve.debug]", {
      step,
      userWallet: input.walletAddress,
      netAmountWei: amount.toString(),
      requestId,
    });
    const hash = await walletClient.writeContract({
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "payoutUSDT",
      args: [input.walletAddress as Address, amount, requestId],
      chain: null,
    });
    console.log("[approve] payout tx:", hash);
    console.log("[approve] user:", input.walletAddress);
    console.log("[approve] amount:", amount.toString());

    step = "WAIT_PAYOUT_RECEIPT";
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new ApiError(500, "USDT payout transaction failed.", { step });
    }

    return {
      txHash: hash.toLowerCase(),
      requestId,
      contractAddress: config.contractAddress.toLowerCase(),
      operatorAddress: account.address.toLowerCase(),
      vaultUsdtBalance: formatUnits(vaultUsdtBalance, config.decimals),
      operatorBnbBalance: formatEther(operatorBalance),
    };
  } catch (error) {
    console.error("[withdraw.approve.error]", {
      withdrawalId: input.withdrawalId,
      userWallet: input.walletAddress,
      netAmount: input.netAmount,
      vaultAddress,
      operatorAddress,
      step,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : null,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unauthorized")) {
      throw new ApiError(409, "Withdrawal operator is not authorized on vault.", { step });
    }
    if (message.includes("insufficient funds") || message.includes("exceeds the balance")) {
      throw new ApiError(409, "Operator wallet needs BNB for gas.", { step });
    }

    throw new ApiError(500, error instanceof Error ? error.message : "USDT withdrawal authorization failed.", { step });
  }
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
