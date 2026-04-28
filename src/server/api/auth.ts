import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, verifyMessage, type Address } from "viem";
import { nftAbi } from "@/contracts/abis/nft.abi";
import { ApiError } from "@/server/api/errors";

export const AUTH_COOKIE = "gainix_wallet_session";
const AUTH_VERSION = "v1";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const NONCE_TTL_MS = 5 * 60_000;

interface StoredNonce {
  nonce: string;
  message: string;
  expiresAt: number;
}

export interface WalletSession {
  walletAddress: string;
  exp: number;
}

const nonces = new Map<string, StoredNonce>();

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET ??
    process.env.WALLET_AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "Wallet auth secret is not configured.");
  }

  return "gainix-dev-wallet-auth-secret";
}

function sign(value: string) {
  return base64Url(createHmac("sha256", getSessionSecret()).update(value).digest());
}

export function createAuthMessage(walletAddress: string, nonce: string) {
  return [
    "Sign in to Gainix NFT.",
    "",
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Nonce: ${nonce}`,
    "This signature authorizes secure financial and admin actions.",
  ].join("\n");
}

export function issueNonce(walletAddress: string) {
  const normalizedWallet = walletAddress.toLowerCase();
  const nonce = randomBytes(24).toString("hex");
  const message = createAuthMessage(normalizedWallet, nonce);
  nonces.set(normalizedWallet, {
    nonce,
    message,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return { nonce, message, expiresAt: new Date(Date.now() + NONCE_TTL_MS).toISOString() };
}

export async function verifyWalletSignature(walletAddress: string, signature: string) {
  const normalizedWallet = walletAddress.toLowerCase();
  const stored = nonces.get(normalizedWallet);

  if (!stored || stored.expiresAt <= Date.now()) {
    nonces.delete(normalizedWallet);
    throw new ApiError(401, "Sign-in nonce expired. Please sign again.");
  }

  const isValid = await verifyMessage({
    address: normalizedWallet as Address,
    message: stored.message,
    signature: signature as `0x${string}`,
  });

  if (!isValid) {
    throw new ApiError(401, "Wallet signature verification failed.");
  }

  nonces.delete(normalizedWallet);
}

export function createSessionToken(walletAddress: string) {
  const payload: WalletSession = {
    walletAddress: walletAddress.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${AUTH_VERSION}.${encodedPayload}.${sign(`${AUTH_VERSION}.${encodedPayload}`)}`;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function parseSessionToken(token: string | undefined) {
  if (!token) {
    throw new ApiError(401, "Sign to continue.");
  }

  const [version, encodedPayload, signature] = token.split(".");
  if (version !== AUTH_VERSION || !encodedPayload || !signature) {
    throw new ApiError(401, "Invalid wallet session.");
  }

  const expectedSignature = sign(`${version}.${encodedPayload}`);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiError(401, "Invalid wallet session.");
  }

  let payload: WalletSession;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as WalletSession;
  } catch {
    throw new ApiError(401, "Invalid wallet session.");
  }
  if (!payload.walletAddress || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "Wallet session expired. Please sign again.");
  }

  return payload;
}

export function requireWalletSession(request: NextRequest) {
  return parseSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export function assertAuthenticatedWallet(session: WalletSession, walletAddress: string) {
  if (session.walletAddress !== walletAddress.toLowerCase()) {
    throw new ApiError(403, "Authenticated wallet does not match request walletAddress.");
  }
}

export async function isAdminWallet(walletAddress: string) {
  const wallet = walletAddress.toLowerCase();
  const configuredAdmins = (process.env.ADMIN_WALLET_ADDRESSES ?? process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configuredAdmins.includes(wallet)) {
    return true;
  }

  const client = createPublicClient({
    transport: http(
      process.env.BSC_RPC_URL ||
        process.env.NEXT_PUBLIC_BSC_RPC_URL ||
        process.env.BSC_TESTNET_RPC_URL ||
        process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL,
    ),
  });
  const nftAddress = (process.env.NEXT_PUBLIC_BSC_TESTNET_NFT_CONTRACT ??
    "0x1111111111111111111111111111111111111157") as Address;

  try {
    const [owner, isAdmin] = await Promise.all([
      client.readContract({
        address: nftAddress,
        abi: nftAbi,
        functionName: "owner",
      }),
      client.readContract({
        address: nftAddress,
        abi: nftAbi,
        functionName: "admins",
        args: [wallet as Address],
      }),
    ]);

    return String(owner).toLowerCase() === wallet || Boolean(isAdmin);
  } catch {
    throw new ApiError(403, "Unable to verify admin wallet on-chain.");
  }
}

export async function requireAdminSession(request: NextRequest) {
  const session = requireWalletSession(request);
  if (await isAdminWallet(session.walletAddress)) {
    return session;
  }

  throw new ApiError(403, "Admin wallet required.");
}
