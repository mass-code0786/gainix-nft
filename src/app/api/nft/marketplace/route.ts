import { errorResponse, successResponse } from "@/server/api/http";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getMarketplaceNfts } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureTradingRuntime();
    const result = await getMarketplaceNfts();
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
