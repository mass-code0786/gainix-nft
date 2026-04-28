import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { botBuyInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { buyBotSubscription } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "bot:buy", rateLimitRules.botBuy);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = botBuyInputSchema.parse(body);
    walletAddress = input.walletAddress;
    assertAuthenticatedWallet(session, input.walletAddress);
    const result = await buyBotSubscription(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "bot.buy",
      status: "success",
      metadata: { planId: input.planId },
    });

    return successResponse(result, 200);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "bot.buy",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
