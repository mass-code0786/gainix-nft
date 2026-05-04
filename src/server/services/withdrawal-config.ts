import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export const WITHDRAWAL_VAULT_ENV_NAMES = [
  "WITHDRAWAL_VAULT_ADDRESS",
  "WITHDRAWAL_CONTRACT_ADDRESS",
  "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
  "NEXT_PUBLIC_GAINIX_WITHDRAWAL_VAULT_ADDRESS",
  "NEXT_PUBLIC_WITHDRAWAL_CONTRACT_ADDRESS",
] as const;

export function firstEnv(names: readonly string[]) {
  return names.map((name) => process.env[name]?.trim()).find(Boolean) ?? null;
}

export function normalizeEvmAddress(address: string | null | undefined) {
  const normalizedInput = address?.trim().toLowerCase();
  if (!normalizedInput || !isAddress(normalizedInput)) {
    return null;
  }

  const normalized = getAddress(normalizedInput);
  return normalized.toLowerCase() === zeroAddress ? null : normalized;
}

export function resolveWithdrawalVaultAddress() {
  return normalizeEvmAddress(firstEnv(WITHDRAWAL_VAULT_ENV_NAMES)) as Address | null;
}
