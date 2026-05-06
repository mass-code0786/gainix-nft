import { NextRequest } from "next/server";
import { requireWalletSession } from "@/server/api/auth";
import { errorResponse, successResponse } from "@/server/api/http";
import { walletQuerySchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getWalletBalances } from "@/server/services/trading-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTradingRuntime();
    const session = request.nextUrl.searchParams.get("walletAddress")
      ? null
      : requireWalletSession(request);
    const walletAddress = request.nextUrl.searchParams.get("walletAddress") ?? session?.walletAddress;
    const result = await getWalletBalances(
      walletQuerySchema.parse({
        walletAddress,
      }),
    );

    return successResponse({
      user: result.user,
      wallet: result.wallet,
      isRegistered: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
