import { NextRequest } from "next/server";
import { ApiError } from "@/server/api/errors";

interface RateLimitRule {
  windowMs: number;
  max: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export const rateLimitRules = {
  register: { windowMs: 60_000, max: 10 },
  authNonce: { windowMs: 60_000, max: 20 },
  authVerify: { windowMs: 60_000, max: 10 },
  depositVerify: { windowMs: 60_000, max: 8 },
  withdraw: { windowMs: 60_000, max: 5 },
  nftMutation: { windowMs: 60_000, max: 20 },
  botBuy: { windowMs: 60_000, max: 8 },
  admin: { windowMs: 60_000, max: 60 },
} satisfies Record<string, RateLimitRule>;

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit(request: NextRequest, key: string, rule: RateLimitRule) {
  const now = Date.now();
  const ip = getClientIp(request);
  const bucketKey = `${key}:${ip}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + rule.windowMs });
    return;
  }

  current.count += 1;

  if (current.count > rule.max) {
    throw new ApiError(429, "Too many requests. Please wait and try again.");
  }
}
