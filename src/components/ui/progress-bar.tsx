import { cn } from "@/utils/cn";

interface ProgressBarProps {
  label: string;
  value: number;
  hint?: string;
  className?: string;
}

export function ProgressBar({ label, value, hint, className }: ProgressBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-500">{hint ?? `${value}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gainix-700 via-gainix-500 to-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.4)]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
