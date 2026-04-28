import { CircleDollarSign } from "lucide-react";
import type { IncomeHistoryRecord } from "@/types";
import { cn } from "@/utils/cn";
import { formatUsdt } from "@/utils/format";

interface IncomeHistoryItemProps {
  item: IncomeHistoryRecord;
}

const statusTone = {
  Credited: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Pending: "border-amber-500/20 bg-amber-500/10 text-amber-300",
} as const;

export function IncomeHistoryItem({ item }: IncomeHistoryItemProps) {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200">
          <CircleDollarSign className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-white">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.date}</p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-semibold sm:text-base",
                  item.status === "Credited" ? "text-emerald-400" : "text-amber-300",
                )}
              >
                {item.status === "Credited" ? "+" : ""}
                {formatUsdt(item.amount)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs", statusTone[item.status])}>
              {item.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
              {item.reference}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
