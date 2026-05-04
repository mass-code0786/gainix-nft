import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, formatUnits, http, isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { withdrawalAbi } from "@/contracts/abis/withdrawal.abi";
import { contractActiveChainId } from "@/contracts/config/chain";
import { withSecurityHeaders } from "@/server/api/http";

const knownWithdrawalVaultAddress = "0x520fF6fB8690b495901E482D2B2395c562931659";
const decimals = 18;
const zero = BigInt(0);

function firstEnv(names: string[]) {
  return names.map((name) => process.env[name]?.trim()).find(Boolean) ?? null;
}

function resolveVaultAddress() {
  return (
    firstEnv([
      "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_GAINIX_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_WITHDRAWAL_CONTRACT_ADDRESS",
      "WITHDRAWAL_VAULT_ADDRESS",
      "WITHDRAWAL_CONTRACT_ADDRESS",
    ]) ?? knownWithdrawalVaultAddress
  ) as Address;
}

function resolveRpcUrl() {
  return firstEnv(["BSC_RPC_URL", "NEXT_PUBLIC_BSC_MAINNET_RPC_URL", "NEXT_PUBLIC_BSC_RPC_URL"]) ?? "https://bsc-dataseed.binance.org";
}

function isConfiguredAddress(address: string | null | undefined) {
  return Boolean(address && isAddress(address) && address.toLowerCase() !== zeroAddress);
}

function messageForStatus(claimable: bigint, vaultBalance: bigint, requestedAmount: bigint | null) {
  const amountToCheck = requestedAmount ?? claimable;

  if (claimable <= zero || (requestedAmount !== null && claimable < requestedAmount)) {
    return "Withdrawal is not authorized yet. Please wait for admin approval.";
  }

  if (vaultBalance < amountToCheck) {
    return "Withdrawal vault has insufficient balance.";
  }

  return "";
}

export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get("walletAddress")?.trim() ?? "";
  const amount = request.nextUrl.searchParams.get("amount")?.trim() ?? "";

  if (!isAddress(walletAddress)) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          authorized: false,
          claimableAmount: "0",
          vaultBalance: "0",
          canWithdraw: false,
          message: "Connect your wallet to continue.",
        },
        { status: 400 },
      ),
    );
  }

  const vaultAddress = resolveVaultAddress();
  if (!isConfiguredAddress(vaultAddress)) {
    return withSecurityHeaders(
      NextResponse.json({
        authorized: false,
        claimableAmount: "0",
        vaultBalance: "0",
        canWithdraw: false,
        message: "Withdrawal failed. Please try again later.",
      }),
    );
  }

  try {
    const client = createPublicClient({
      chain: { id: contractActiveChainId, name: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals }, rpcUrls: { default: { http: [resolveRpcUrl()] } } },
      transport: http(resolveRpcUrl()),
    });
    const requestedAmount = amount ? parseUnits(amount, decimals) : null;
    const [claimable, vaultBalance] = await Promise.all([
      client.readContract({
        address: vaultAddress,
        abi: withdrawalAbi,
        functionName: "claimable",
        args: [walletAddress as Address],
      }),
      client.getBalance({ address: vaultAddress }),
    ]);
    const message = messageForStatus(claimable, vaultBalance, requestedAmount);
    const canWithdraw = !message;

    console.info("[withdraw.status] wallet=", walletAddress, "claimable=", formatUnits(claimable, decimals), "vaultBalance=", formatUnits(vaultBalance, decimals));

    return withSecurityHeaders(
      NextResponse.json({
        authorized: claimable > zero,
        claimableAmount: formatUnits(claimable, decimals),
        vaultBalance: formatUnits(vaultBalance, decimals),
        canWithdraw,
        message,
      }),
    );
  } catch (error) {
    console.error("[withdraw.error] rawError=", error);
    return withSecurityHeaders(
      NextResponse.json({
        authorized: false,
        claimableAmount: "0",
        vaultBalance: "0",
        canWithdraw: false,
        message: "Withdrawal failed. Please try again later.",
      }),
    );
  }
}
