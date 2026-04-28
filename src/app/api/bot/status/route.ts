import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getBotStatus } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureTradingRuntime();
    const searchParams = request.nextUrl.searchParams;
    const result = await getBotStatus({
      userId: searchParams.get("userId") ?? undefined,
      walletAddress: searchParams.get("walletAddress") ?? undefined,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
