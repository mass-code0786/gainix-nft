import { NextRequest } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  verifyWalletSignature,
} from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { authVerifyInputSchema } from "@/server/api/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | null = null;

  try {
    rateLimit(request, "auth:verify", rateLimitRules.authVerify);
    const body = await request.json();
    const input = authVerifyInputSchema.parse(body);
    walletAddress = input.walletAddress;

    await verifyWalletSignature(input.walletAddress, input.signature);
    const response = successResponse({ walletAddress: input.walletAddress, verified: true });
    setSessionCookie(response, createSessionToken(input.walletAddress));
    await writeAuditLog(request, {
      walletAddress,
      action: "auth.verify",
      status: "success",
    });

    return response;
  } catch (error) {
    await writeAuditLog(request, {
      walletAddress,
      action: "auth.verify",
      status: "failure",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return errorResponse(error);
  }
}
