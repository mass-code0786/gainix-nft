import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatTodayIncome, formatUsdt } from "@/utils/format";

interface IncomeCardProps {
  title: string;
  total: number;
  today: number;
  href: string;
  icon: LucideIcon;
  className?: string;
}

export function IncomeCard({
  title,
  total,
  today,
  href,
  icon: Icon,
  className,
}: IncomeCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "glass-card interactive-surface flex h-full min-h-[138px] flex-col justify-between rounded-[26px] border border-white/10 p-3.5 sm:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-5 text-zinc-100 sm:text-xs">{title}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-rose-500/20 via-orange-500/12 to-amber-400/18 text-amber-100 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4">
        <p className="font-display text-[1.35rem] font-semibold leading-tight text-white sm:text-[1.55rem]">
          {formatUsdt(total)}
        </p>
        <p className="mt-1 text-sm font-semibold text-emerald-400">{formatTodayIncome(today)}</p>
      </div>
    </Link>
  );
}
