import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { confirmWithdrawalInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { confirmOnChainWithdrawal, getWalletBalances } from "@/server/services/trading-service";
import { verifyWithdrawalTransaction } from "@/server/services/withdrawal-chain";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "withdraw:confirm", rateLimitRules.withdraw);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = confirmWithdrawalInputSchema.parse(body);
    walletAddress = input.walletAddress;
    assertAuthenticatedWallet(session, input.walletAddress);

    const balances = await getWalletBalances({ walletAddress: input.walletAddress });
    const withdrawal = balances.withdrawals.find((item) => item.id === input.withdrawalId);
    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found.");
    }

    const verification = await verifyWithdrawalTransaction({
      walletAddress: input.walletAddress,
      txHash: input.txHash,
      netAmount: withdrawal.netAmount,
    });
    const result = await confirmOnChainWithdrawal(input);

    await writeAuditLog(request, {
      userId: result.user.id,
      walletAddress,
      action: "withdraw.confirm",
      status: "success",
      metadata: { withdrawalId: input.withdrawalId, txHash: verification.txHash },
    });

    return successResponse({ ...result, verification }, 200);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "withdraw.confirm",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
