import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getLatestMarketplaceNfts } from "@/server/services/trading-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTradingRuntime();
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 5);
    const result = await getLatestMarketplaceNfts(Number.isFinite(limit) ? limit : 5);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
