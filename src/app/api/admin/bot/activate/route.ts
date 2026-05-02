import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { adminActivateBotInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { activateBotByAdmin } from "@/server/services/trading-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    console.info("[admin.bot.activate] route hit");
    rateLimit(request, "admin:bot-activate", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminActivateBotInputSchema.parse(body);
    const result = await activateBotByAdmin(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.bot.activate",
      status: "success",
      metadata: input,
    });
    return successResponse(result);
  } catch (error) {
    console.error("[admin.bot.activate] failed", {
      statusCode: error instanceof ApiError ? error.statusCode : undefined,
      message: error instanceof Error ? error.message : "unknown",
    });
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.bot.activate",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    if (error instanceof ApiError && error.statusCode === 401) {
      return errorResponse(new ApiError(401, "Sign to continue."));
    }
    return errorResponse(error);
  }
}
