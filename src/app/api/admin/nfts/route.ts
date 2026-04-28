import { NextRequest } from "next/server";
import { requireAdminSession } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import {
  adminDeleteNftInputSchema,
  adminUpdateNftInputSchema,
} from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import {
  deleteAdminNft,
  getAdminNfts,
  updateAdminNft,
} from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:nfts", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const result = await getAdminNfts();

    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.list",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:nfts:update", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminUpdateNftInputSchema.parse(body);
    const result = await updateAdminNft(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.update",
      status: "success",
      metadata: input,
    });

    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.update",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "admin:nfts:delete", rateLimitRules.admin);
    const session = await requireAdminSession(request);
    walletAddress = session.walletAddress;
    await ensureTradingRuntime();
    const body = await request.json();
    const input = adminDeleteNftInputSchema.parse(body);
    const result = await deleteAdminNft(input);
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.delete",
      status: "success",
      metadata: input,
    });

    return successResponse(result);
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "admin.nfts.delete",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
