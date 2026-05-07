import { NextRequest } from "next/server";
import { requireWalletSession } from "@/server/api/auth";
import { errorResponse, successResponse } from "@/server/api/http";
import { prisma } from "@/server/api/prisma";
import { walletQuerySchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTradingRuntime();
    const session = request.nextUrl.searchParams.get("walletAddress")
      ? null
      : requireWalletSession(request);
    const input = walletQuerySchema.parse({
      walletAddress: request.nextUrl.searchParams.get("walletAddress") ?? session?.walletAddress,
    });
    const user = await prisma.user.findUnique({
      where: { walletAddress: input.walletAddress! },
    });

    console.log("[me]", {
      walletAddress: input.walletAddress,
      isRegistered: Boolean(user),
    });

    if (!user) {
      return successResponse({
        success: true,
        isRegistered: false,
        user: null,
      });
    }

    return successResponse({
      success: true,
      user,
      isRegistered: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
