"use client";

interface OwnerDebugPanelProps {
  contractAddress?: string | null;
  connectedWallet?: string | null;
  connectedWalletComparison?: string | null;
  owner?: string | null;
  ownerComparison?: string | null;
  isOwner: boolean;
  isOwnerCheckReady: boolean;
  currentChainId?: number | null;
  contractChainId: number;
  chainMismatch: boolean;
  walletStatus: string;
  adminCheckResult?: boolean | null;
  error?: string;
}

export function OwnerDebugPanel({
  contractAddress,
  connectedWallet,
  connectedWalletComparison,
  owner,
  ownerComparison,
  isOwner,
  isOwnerCheckReady,
  currentChainId,
  contractChainId,
  chainMismatch,
  walletStatus,
  adminCheckResult,
  error,
}: OwnerDebugPanelProps) {
  const rows = [
    { label: "Connected wallet", value: connectedWallet ?? "Not connected" },
    { label: "Connected wallet (lowercase)", value: connectedWalletComparison ?? "n/a" },
    { label: "Contract owner", value: owner ?? "Unavailable" },
    { label: "Contract owner (lowercase)", value: ownerComparison ?? "n/a" },
    { label: "Contract address", value: contractAddress ?? "Not configured" },
    { label: "isOwner", value: isOwnerCheckReady ? String(isOwner) : "checking" },
    { label: "Wallet status", value: walletStatus },
    { label: "Current chain id", value: currentChainId !== null && currentChainId !== undefined ? String(currentChainId) : "none" },
    { label: "Contract chain id", value: String(contractChainId) },
    { label: "Chain mismatch", value: chainMismatch ? "true" : "false" },
  ];

  if (adminCheckResult !== undefined && adminCheckResult !== null) {
    rows.push({ label: "admins(address)", value: String(adminCheckResult) });
  }

  return (
    <div className="section-shell">
      <p className="muted-label">Owner check debug</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-500">{row.label}</p>
            <p className="mt-2 break-all font-mono text-xs text-zinc-200">{row.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-6 text-zinc-400">
        Route access now uses only the `owner()` result from the NFT contract. The `admins(address)` flag is debug-only here.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
