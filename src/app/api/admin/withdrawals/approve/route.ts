import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { approveWithdrawalInputSchema } from "@/server/api/validation";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { approveWithdrawal } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;
  let withdrawalId: string | null = null;

  try {
    rateLimit(request, "admin:withdrawals:approve", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = approveWithdrawalInputSchema.parse(body);
    withdrawalId = input.withdrawalId;
    console.info("[withdraw.approve] withdrawalId=", input.withdrawalId);
    const result = await approveWithdrawal(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.withdrawal.approve",
      status: "success",
      metadata: { ...input, withdrawalUserId: result.withdrawal.userId },
    });
    return successResponse(result);
  } catch (error) {
    console.error("[withdraw.approve.error]", {
      withdrawalId,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : null,
    });
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.withdrawal.approve",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
