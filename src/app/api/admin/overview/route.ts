import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getAdminOverview } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    rateLimit(request, "admin:overview", rateLimitRules.admin);
    await requireAdminSession(request);
    await ensureTradingRuntime();
    const result = await getAdminOverview();
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
