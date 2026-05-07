import { NextRequest } from "next/server";
import {
  createSessionToken,
  isAdminWallet,
  setSessionCookie,
  verifyWalletSignature,
} from "@/server/api/auth";
import { getServerConfiguredWalletRole, isPrivilegedRole } from "@/lib/auth/wallet-role";
import { writeAuditLog } from "@/server/api/audit";
import { errorResponse, successResponse } from "@/server/api/http";
import { prisma } from "@/server/api/prisma";
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
    const user = await prisma.user.findUnique({
      where: { walletAddress: input.walletAddress },
    });
    console.log("[verify]", {
      walletAddress: input.walletAddress,
      isRegistered: Boolean(user),
    });
    const configuredRole = getServerConfiguredWalletRole(input.walletAddress);
    const hasOnChainAdminAccess = isPrivilegedRole(configuredRole)
      ? false
      : await isAdminWallet(input.walletAddress).catch(() => false);
    const role = isPrivilegedRole(configuredRole)
      ? configuredRole
      : hasOnChainAdminAccess
      ? "admin"
      : "user";
    const response = successResponse({
      success: true,
      walletAddress: input.walletAddress,
      verified: true,
      walletVerified: true,
      isRegistered: Boolean(user),
      user,
      role,
    });
    setSessionCookie(response, createSessionToken(input.walletAddress, role));
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
