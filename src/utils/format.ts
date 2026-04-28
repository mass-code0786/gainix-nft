export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value: number) {
  return compactFormatter.format(value);
}

export function formatUsdt(value: number) {
  return formatCurrency(value);
}

export function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

export function formatGasBnb(value: number) {
  return `${value.toFixed(4)} BNB`;
}

export function formatTodayIncome(value: number) {
  return `+${Math.abs(value).toFixed(2)} today`;
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatWallet(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function getChangeTone(value: number) {
  return value >= 0 ? "text-emerald-400" : "text-rose-400";
}

export function getStatusTone(status: string) {
  if (status === "Completed" || status === "Processed" || status === "Executed" || status === "Active") {
    return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
  }

  if (status === "Pending" || status === "Queued" || status === "Processing") {
    return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  }

  return "text-zinc-300 bg-white/5 border-white/10";
}
