import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/server/api/auth";
import { withSecurityHeaders } from "@/server/api/http";

export const runtime = "nodejs";

export async function POST() {
  const response = withSecurityHeaders(NextResponse.json({ ok: true }));
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
