import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { getPublicUsdtConfig } from "@/server/services/usdt-payment";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    return successResponse(getPublicUsdtConfig(), 200);
  } catch (error) {
    return errorResponse(error);
  }
}
