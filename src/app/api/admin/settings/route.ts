import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { adminSettingsInputSchema } from "@/server/api/validation";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { updateAdminSettings } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:settings", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminSettingsInputSchema.parse(body);
    const result = await updateAdminSettings(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.settings.update",
      status: "success",
      metadata: input,
    });
    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.settings.update",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
