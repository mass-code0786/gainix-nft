import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { adminCreateNftInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { createAdminMarketplaceNft } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:nfts:create", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminCreateNftInputSchema.parse(body);
    const result = await createAdminMarketplaceNft(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.create",
      status: "success",
      metadata: { tokenId: input.tokenId, basePrice: input.basePrice, status: input.status },
    });

    return successResponse(result, 201);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.create",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
