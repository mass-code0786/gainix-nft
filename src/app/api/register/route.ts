import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { rateLimit, rateLimitRules } from "@/server/api/rate-limit";
import { registerInputSchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { registerUser } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let walletAddress: string | undefined;
  let referralCode: string | undefined;

  try {
    rateLimit(request, "register", rateLimitRules.register);
    const body = await request.json();
    walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress : undefined;
    referralCode = typeof body?.ref === "string"
      ? body.ref
      : typeof body?.referralCode === "string"
        ? body.referralCode
        : undefined;

    console.log("[register.start]", { walletAddress, referralCode });

    await ensureTradingRuntime();
    const result = await registerUser(registerInputSchema.parse({
      ...body,
      ref: typeof body?.ref === "string" ? body.ref : referralCode,
    }));

    const created = result.message === "User registered successfully.";
    console.log(created ? "[register.created]" : "[register.exists]", {
      walletAddress: result.user.walletAddress,
      userId: result.user.id,
      sponsorUserId: result.sponsorUserId,
    });

    return successResponse({ success: true, ...result }, created ? 201 : 200);
  } catch (error) {
    console.error("[register.error]", {
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return errorResponse(error);
  }
}
