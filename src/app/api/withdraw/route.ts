import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { walletAmountMutationInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { requestWithdrawal } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "withdraw", rateLimitRules.withdraw);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = walletAmountMutationInputSchema.parse(body);
    walletAddress = input.walletAddress;
    assertAuthenticatedWallet(session, input.walletAddress);
    const result = await requestWithdrawal(input);
    await writeAuditLog(request, {
      userId: result.user.id,
      walletAddress,
      action: "withdraw.request",
      status: "success",
      metadata: { amount: input.amount },
    });

    return successResponse(result, 200);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "withdraw.request",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
