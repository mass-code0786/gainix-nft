import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError } from "@/server/api/errors";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { approveWithdrawalInputSchema } from "@/server/api/validation";
import { successResponse, withSecurityHeaders } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { approveWithdrawal } from "@/server/services/trading-service";

export const runtime = "nodejs";

function errorStep(error: unknown) {
  if (error instanceof ApiError && typeof error.details?.step === "string") {
    return error.details.step;
  }

  return "ADMIN_WITHDRAWAL_APPROVE_ROUTE";
}

function errorStatus(error: unknown) {
  if (error instanceof ApiError) {
    return error.statusCode === 502 ? 500 : error.statusCode;
  }

  return 500;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Withdrawal approval failed.";
}

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
      step: errorStep(error),
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : null,
    });

    try {
      await writeAuditLog(request, {
        walletAddress,
        action: "admin.withdrawal.approve",
        status: "failure",
        metadata: { error: errorMessage(error), step: errorStep(error), withdrawalId },
      });
    } catch (auditError) {
      console.error("[withdraw.approve.error]", {
        withdrawalId,
        step: "AUDIT_LOG_FAILURE",
        message: auditError instanceof Error ? auditError.message : "unknown",
        stack: auditError instanceof Error ? auditError.stack : null,
      });
    }

    return withSecurityHeaders(
      NextResponse.json(
        { error: errorMessage(error), step: errorStep(error) },
        { status: errorStatus(error) },
      ),
    );
  }
}
