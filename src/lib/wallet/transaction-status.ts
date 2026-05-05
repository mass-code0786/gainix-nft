export interface WalletTransactionStatusSource {
  status?: string | null;
  payoutStatus?: string | null;
  onChainStatus?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface WalletTransactionStatusDisplay {
  label: string;
  className: string;
}

function normalizedValue(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

function fieldValue(transaction: WalletTransactionStatusSource, key: "status" | "payoutStatus" | "onChainStatus") {
  return normalizedValue(transaction[key] ?? transaction.metadata?.[key]);
}

function fallbackStatusText(status: string | null | undefined) {
  if (!status) {
    return "Unknown";
  }

  return status.replace(/_/g, " ");
}

export function getWalletTransactionStatusDisplay(
  transaction: WalletTransactionStatusSource,
): WalletTransactionStatusDisplay {
  const status = fieldValue(transaction, "status");
  const payoutStatus = fieldValue(transaction, "payoutStatus");
  const onChainStatus = fieldValue(transaction, "onChainStatus");

  if (onChainStatus === "CONFIRMED" || payoutStatus === "PAID" || status === "COMPLETED") {
    return {
      label: "Confirmed",
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (status === "APPROVED_PENDING_TX" || payoutStatus === "PENDING_TX" || onChainStatus === "PENDING") {
    return {
      label: "Processing",
      className: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    };
  }

  if (status === "REQUESTED") {
    return {
      label: "Requested",
      className: "border-white/10 bg-white/5 text-zinc-400",
    };
  }

  return {
    label: fallbackStatusText(transaction.status ?? (transaction.metadata?.status as string | null | undefined)),
    className: "border-white/10 bg-white/5 text-zinc-400",
  };
}
