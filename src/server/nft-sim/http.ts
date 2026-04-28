import { NextResponse } from "next/server";
import { ApiError } from "@/server/nft-sim/errors";

export function successResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      error: "Internal server error.",
    },
    { status: 500 },
  );
}
