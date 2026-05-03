"use client";

import type { Config, Connector } from "wagmi";

const WALLET_STORAGE_KEY_PATTERNS = [
  /^wagmi(\.|$)/i,
  /walletconnect/i,
  /^wc(@|:|-)/i,
  /web3modal/i,
  /rainbowkit/i,
  /^rk-/i,
  /^gainix[:_-](wallet|auth|session)/i,
  /^gainix_wallet_session$/i,
];

function isWalletStorageKey(key: string) {
  return WALLET_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function clearWalletKeys(storage: Storage) {
  for (const key of Object.keys(storage)) {
    if (isWalletStorageKey(key)) {
      storage.removeItem(key);
    }
  }
}

export function clearWalletSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  clearWalletKeys(window.localStorage);
  clearWalletKeys(window.sessionStorage);
}

export async function clearWalletAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    console.warn("[wallet] auth session cleanup failed", error);
  }
}

export async function disconnectWalletConnector(connector: Connector) {
  await connector.disconnect?.();
}

export function forceResetWagmiClient(config: Config) {
  config.setState((state) => ({
    ...state,
    connections: new Map(),
    current: null,
    status: "disconnected",
  }));
  void config._internal.revalidate();
}
