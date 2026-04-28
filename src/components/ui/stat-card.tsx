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
    <div className={cn("section-shell lux-card interactive-surface space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold leading-tight text-white sm:text-[1.75rem]">{value}</p>
        </div>
        {Icon ? (
          <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200 shadow-glow">
            <Icon className="h-5 w-5" />
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
