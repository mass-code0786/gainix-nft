import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { depositVerifyInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { verifyDepositAndCredit } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "deposit:verify", rateLimitRules.depositVerify);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = depositVerifyInputSchema.parse(body);
    walletAddress = input.walletAddress;
    assertAuthenticatedWallet(session, input.walletAddress);
    const result = await verifyDepositAndCredit(input);
    await writeAuditLog(request, {
      userId: result.user.id,
      walletAddress,
      action: "deposit.verify",
      status: "success",
      metadata: { txHash: input.txHash, expectedAmount: input.expectedAmount },
    });

    return successResponse(result, 200);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "deposit.verify",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
