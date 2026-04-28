import { cn } from "@/utils/cn";
import type { HTMLAttributes } from "react";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card lux-card", className)} {...props} />;
}
