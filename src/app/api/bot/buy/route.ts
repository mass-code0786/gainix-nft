import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, AUTH_COOKIE, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { botBuyInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { assertRegisteredWalletForBotBuy, buyBotSubscription } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    console.info("[bot.buy] route hit");
    rateLimit(request, "bot:buy", rateLimitRules.botBuy);
    await ensureTradingRuntime();
    const cookiePresent = Boolean(request.cookies.get(AUTH_COOKIE)?.value);
    console.info(`[bot.buy] cookie present=${cookiePresent}`);
    const body = await request.json();
    console.info("[bot.buy] body=", body);
    const input = botBuyInputSchema.parse(body);
    walletAddress = input.walletAddress;
    console.info(`[bot.buy] body wallet=${walletAddress}`);

    if (!cookiePresent) {
      console.warn("[bot.buy] auth failed reason=Connect to Continue");
      throw new ApiError(401, "Connect to Continue");
    }

    try {
      const session = requireWalletSession(request);
      assertAuthenticatedWallet(session, input.walletAddress);
      console.info(`[bot.buy] auth user=${session.walletAddress}`);
    } catch (authError) {
      const reason = authError instanceof Error ? authError.message : "Wallet auth failed.";
      console.warn(`[bot.buy] auth failed reason=${reason}`);
      const user = await assertRegisteredWalletForBotBuy(input.walletAddress);
      console.info(`[bot.buy] auth user=${user.walletAddress}`);
    }

    const result = await buyBotSubscription(input);
    console.info(`[bot.buy] package resolved=${result.subscription.planId}`);
    console.info(`[bot.buy] success=${result.subscription.id}`);
    await writeAuditLog(request, {
      walletAddress,
      action: "bot.buy",
      status: "success",
      metadata: { planId: result.subscription.planId },
    });

    return successResponse(result, 200);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "bot.buy",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    if (error instanceof Error) {
      console.warn(`[bot.buy] failed reason=${error.message}`);
    }
    return errorResponse(error);
  }
}
