import { NextResponse } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { processTradingEngineTick } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error: "Bot cycle trigger is disabled in production.",
        },
        { status: 403 },
      );
    }

    await ensureTradingRuntime();
    const result = await processTradingEngineTick();
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
