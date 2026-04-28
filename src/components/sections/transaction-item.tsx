import { ArrowDownLeft, ArrowUpRight, Bot, Coins, Tag, Wallet } from "lucide-react";
import type { TransactionRecord } from "@/types";
import { cn } from "@/utils/cn";
import { formatCurrency, formatGasBnb, formatHash, getStatusTone } from "@/utils/format";

interface TransactionItemProps {
  item: TransactionRecord;
}

const iconMap = {
  Buy: ArrowDownLeft,
  Sell: ArrowUpRight,
  List: Tag,
  Cancel: Tag,
  Mint: Coins,
  "Bot Subscription": Bot,
  "Bot Buy": Bot,
  "Bot Sell": Bot,
  Reward: Coins,
  Withdrawal: Wallet,
};

export function TransactionItem({ item }: TransactionItemProps) {
  const Icon = iconMap[item.type];

  return (
    <div className="glass-card interactive-surface rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="truncate font-medium text-white">
                {item.nftName ? `${item.type} - ${item.nftName}` : item.type}
              </p>
              <p className="text-sm text-zinc-500">
                {item.date} - {item.chain}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-white">{formatCurrency(item.amount)}</p>
              <p className="text-sm text-zinc-500">Gas {formatGasBnb(item.gasFee)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${getStatusTone(item.status)}`}>
              {item.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
              {formatHash(item.hash)}
            </span>
            {item.profit ? (
              <span className={cn("text-xs", item.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {item.profit >= 0 ? "+" : ""}
                {formatCurrency(Math.abs(item.profit))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
