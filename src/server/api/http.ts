import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/server/api/errors";

export function successResponse(payload: unknown, status = 200, cacheControl = "no-store, max-age=0") {
  return withSecurityHeaders(NextResponse.json(payload, { status }), cacheControl);
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return withSecurityHeaders(NextResponse.json(
      {
        error: error.message,
        ...(error.details ?? {}),
      },
      { status: error.statusCode },
    ));
  }

  if (error instanceof ZodError) {
    return withSecurityHeaders(NextResponse.json(
      {
        error: "Validation failed.",
        details: error.flatten(),
      },
      { status: 400 },
    ));
  }

  return withSecurityHeaders(NextResponse.json({ error: "Internal server error." }, { status: 500 }));
}

export function withSecurityHeaders(response: NextResponse, cacheControl = "no-store, max-age=0") {
  response.headers.set("Cache-Control", cacheControl);
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}
