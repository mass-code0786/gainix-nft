import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { getPublicUsdtConfig } from "@/server/services/usdt-payment";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(_request: NextRequest) {
  try {
    return successResponse(getPublicUsdtConfig(), 200, "public, s-maxage=300, stale-while-revalidate=600");
  } catch (error) {
    return errorResponse(error);
  }
}
