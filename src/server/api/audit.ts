import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/server/api/prisma";
import { getClientIp } from "@/server/api/rate-limit";

interface AuditInput {
  userId?: string | null;
  walletAddress?: string | null;
  action: string;
  status: "success" | "failure";
  metadata?: Prisma.InputJsonObject;
}

export async function writeAuditLog(request: NextRequest, input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        walletAddress: input.walletAddress?.toLowerCase() ?? null,
        action: input.action,
        status: input.status,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: input.metadata,
      },
    });
  } catch {
    // Audit writes must not change the outcome of the protected action.
  }
}
