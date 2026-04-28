import { NextRequest } from "next/server";
import { requireWalletSession } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { errorResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { ensureTradingRuntime } from "@/server/services/runtime";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    rateLimit(request, "deposit:manual", rateLimitRules.depositVerify);
    requireWalletSession(request);
    await ensureTradingRuntime();
    await request.json().catch(() => null);
    const result = new ApiError(
      410,
      "Manual deposits are disabled. Submit a USDT BEP20 transaction through /api/deposit/verify.",
    );

    throw result;
  } catch (error) {
    return errorResponse(error);
  }
}
