import { NextRequest } from "next/server";
import { assertAuthenticatedWallet, requireWalletSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { nftMutationInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { buyMarketplaceNft } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "nft:buy", rateLimitRules.nftMutation);
    const session = requireWalletSession(request);
    await ensureTradingRuntime();
    const body = await request.json();
    const input = nftMutationInputSchema.parse(body);
    walletAddress = input.walletAddress;
    assertAuthenticatedWallet(session, input.walletAddress);
    const result = await buyMarketplaceNft(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "nft.buy",
      status: "success",
      metadata: { nftId: input.nftId },
    });

    return successResponse(result, 201);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "nft.buy",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
