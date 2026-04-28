import { NextRequest } from "next/server";
import { issueNonce } from "@/server/api/auth";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { authNonceInputSchema } from "@/server/api/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    rateLimit(request, "auth:nonce", rateLimitRules.authNonce);
    const input = authNonceInputSchema.parse({
      walletAddress: request.nextUrl.searchParams.get("walletAddress"),
    });

    return successResponse(issueNonce(input.walletAddress));
  } catch (error) {
    return errorResponse(error);
  }
}
