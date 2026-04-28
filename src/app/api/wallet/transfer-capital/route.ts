import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { walletAddressOnlyInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { transferCapitalToWithdrawal } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    rateLimit(request, "wallet:transfer-capital", rateLimitRules.withdraw);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = walletAddressOnlyInputSchema.parse(body);
    assertAuthenticatedWallet(session, input.walletAddress);
    const result = await transferCapitalToWithdrawal(input);

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
