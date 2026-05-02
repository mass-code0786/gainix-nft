export type WalletRole = "user" | "admin" | "super_admin";

export function normalizeWalletAddress(walletAddress: string | null | undefined) {
  return walletAddress?.trim().toLowerCase() ?? "";
}

function parseWalletList(input: string | undefined) {
  return new Set(
    (input ?? "")
      .split(",")
      .map((value) => normalizeWalletAddress(value))
      .filter(Boolean),
  );
}

export function getClientConfiguredWalletRole(walletAddress: string | null | undefined): WalletRole {
  const wallet = normalizeWalletAddress(walletAddress);
  if (!wallet) return "user";

  const ownerWallet = normalizeWalletAddress(process.env.NEXT_PUBLIC_OWNER_WALLET_ADDRESS);
  if (ownerWallet && wallet === ownerWallet) return "super_admin";

  const adminWallets = parseWalletList(
    [process.env.NEXT_PUBLIC_ADMIN_WALLETS, process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES]
      .filter(Boolean)
      .join(","),
  );

  return adminWallets.has(wallet) ? "admin" : "user";
}

export function getServerConfiguredWalletRole(walletAddress: string | null | undefined): WalletRole {
  const wallet = normalizeWalletAddress(walletAddress);
  if (!wallet) return "user";

  const ownerWallet = normalizeWalletAddress(
    process.env.OWNER_WALLET_ADDRESS ?? process.env.NEXT_PUBLIC_OWNER_WALLET_ADDRESS,
  );
  if (ownerWallet && wallet === ownerWallet) return "super_admin";

  const adminWallets = parseWalletList(
    [
      process.env.ADMIN_WALLETS,
      process.env.ADMIN_WALLET_ADDRESSES,
      process.env.NEXT_PUBLIC_ADMIN_WALLETS,
      process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES,
    ]
      .filter(Boolean)
      .join(","),
  );

  return adminWallets.has(wallet) ? "admin" : "user";
}

export function isPrivilegedRole(role: WalletRole) {
  return role === "admin" || role === "super_admin";
}
