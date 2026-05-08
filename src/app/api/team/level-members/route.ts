import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/http";
import { teamLevelMembersQuerySchema } from "@/server/api/validation";
import { ensureTradingRuntime } from "@/server/services/runtime";
import { getTeamLevelMembers } from "@/server/services/trading-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureTradingRuntime();
    const searchParams = request.nextUrl.searchParams;
    const query = teamLevelMembersQuerySchema.parse({
      userId: searchParams.get("userId") ?? undefined,
      walletAddress: searchParams.get("walletAddress") ?? undefined,
      level: searchParams.get("level") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    const result = await getTeamLevelMembers(
      {
        userId: query.userId,
        walletAddress: query.walletAddress,
      },
      {
        level: query.level,
        page: query.page,
        pageSize: query.pageSize,
      },
    );

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
