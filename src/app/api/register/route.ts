import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { registerInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { registerUser } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    rateLimit(request, "register", rateLimitRules.register);
    await ensureTradingRuntime();
    const body = await request.json();
    const result = await registerUser(registerInputSchema.parse(body));

    return successResponse(result, 201);
  } catch (error) {
    console.error("[register] error", error);
    return errorResponse(error);
  }
}
