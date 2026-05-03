import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { walletQuerySchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getWalletSummary } from "@/server/services/trading-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const endpoint = "/api/wallet/summary";

  try {
    await ensureTradingRuntime();
    const searchParams = request.nextUrl.searchParams;
    const result = await getWalletSummary(
      walletQuerySchema.parse({
        userId: searchParams.get("userId") ?? undefined,
        walletAddress: searchParams.get("walletAddress") ?? undefined,
      }),
    );

    console.info(`[perf.api] endpoint=${endpoint} durationMs=${Math.round(performance.now() - startedAt)}`);
    return successResponse(result);
  } catch (error) {
    console.info(`[perf.api] endpoint=${endpoint} durationMs=${Math.round(performance.now() - startedAt)}`);
    return errorResponse(error);
  }
}
