import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  change?: string;
  icon?: LucideIcon;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}

const toneMap = {
  positive: "text-emerald-400",
  negative: "text-rose-400",
  neutral: "text-zinc-300",
};

export function StatCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
  tone = "neutral",
  className,
}: StatCardProps) {
  return (
    <div className={cn("section-shell lux-card interactive-surface space-y-3 p-3 sm:space-y-4 sm:p-4", className)}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.2em]">{label}</p>
          <p className="mt-2 truncate font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">{value}</p>
        </div>
        {Icon ? (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-gainix-400/20 bg-gainix-500/10 text-gainix-200 shadow-glow">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
        {change ? <span className={toneMap[tone]}>{change}</span> : null}
        {detail ? <span className="text-zinc-500">{detail}</span> : null}
      </div>
    </div>
  );
}
