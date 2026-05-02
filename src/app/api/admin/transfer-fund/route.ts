import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { adminTransferFundInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { transferFundByAdmin } from "@/server/services/trading-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    console.info("[admin.transfer-fund] route hit");
    rateLimit(request, "admin:transfer-fund", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminTransferFundInputSchema.parse(body);
    const result = await transferFundByAdmin(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.transfer_fund",
      status: "success",
      metadata: input,
    });
    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.transfer_fund",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
