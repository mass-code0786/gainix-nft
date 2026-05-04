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

const erc20BalanceAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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
  const usdtTokenAddress = firstRequiredEnv(["USDT_TOKEN_ADDRESS", "NEXT_PUBLIC_USDT_TOKEN_ADDRESS"]) as Address;

  return {
    contractAddress: firstRequiredEnv([
      "WITHDRAWAL_VAULT_ADDRESS",
      "WITHDRAWAL_CONTRACT_ADDRESS",
      "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_GAINIX_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_WITHDRAWAL_CONTRACT_ADDRESS",
    ]) as Address,
    rpcUrl: firstRequiredEnv(["BSC_RPC_URL", "BSC_MAINNET_RPC_URL", "NEXT_PUBLIC_BSC_MAINNET_RPC_URL"]),
    chainId: Number(firstRequiredEnv(["BSC_CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID"])),
    usdtTokenAddress,
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

  try {
    const [owner, isOperator, operatorBalance, vaultUsdtToken] = await Promise.all([
      client.readContract({
        address: config.contractAddress,
        abi: withdrawalAbi,
        functionName: "owner",
      }),
      client.readContract({
        address: config.contractAddress,
        abi: withdrawalAbi,
        functionName: "operators",
        args: [account.address],
      }),
      client.getBalance({ address: account.address }),
      client.readContract({
        address: config.contractAddress,
        abi: withdrawalAbi,
        functionName: "usdtToken",
      }),
    ]);
    const vaultUsdtBalance = await client.readContract({
      address: vaultUsdtToken,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [config.contractAddress],
    });
    const operatorAuthorized = isOperator || isAddressEqual(owner, account.address);

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
      throw new ApiError(500, "USDT token config does not match withdrawal vault.");
    }

    if (!operatorAuthorized) {
      throw new ApiError(409, "Withdrawal operator is not authorized on vault.");
    }

    if (operatorBalance <= BigInt(0)) {
      throw new ApiError(409, "Operator wallet needs BNB for gas.");
    }

    if (vaultUsdtBalance < amount) {
      throw new ApiError(409, "Withdrawal vault has insufficient USDT.");
    }

    await client.simulateContract({
      account: account.address,
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "authorizeUSDTWithdrawal",
      args: [input.walletAddress as Address, amount, requestId],
    });

    const hash = await walletClient.writeContract({
      address: config.contractAddress,
      abi: withdrawalAbi,
      functionName: "authorizeUSDTWithdrawal",
      args: [input.walletAddress as Address, amount, requestId],
      chain: null,
    });
    console.info("[withdraw.approve] authorizeUSDTWithdrawal txHash=", hash);

    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new ApiError(502, "USDT withdrawal authorization transaction failed.");
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
      vaultAddress: config.contractAddress,
      operatorAddress: account.address,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : null,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("unauthorized")) {
      throw new ApiError(409, "Withdrawal operator is not authorized on vault.");
    }
    if (message.includes("insufficient funds") || message.includes("exceeds the balance")) {
      throw new ApiError(409, "Operator wallet needs BNB for gas.");
    }

    throw new ApiError(502, error instanceof Error ? error.message : "USDT withdrawal authorization failed.");
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
