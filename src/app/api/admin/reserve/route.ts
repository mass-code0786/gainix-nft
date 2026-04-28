import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { adminReserveInputSchema } from "@/server/api/validation";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { updateSystemReserve } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:reserve", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminReserveInputSchema.parse(body);
    const result = await updateSystemReserve(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.reserve.update",
      status: "success",
      metadata: input,
    });
    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.reserve.update",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
