import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { successResponse } from "@/server/api/http";
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

    return successResponse(result, 201);
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown registration error";

    console.error("[register.error]", {
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      { error: "Registration failed", detail: safeMessage },
      { status: 500 },
    );
  }
}
