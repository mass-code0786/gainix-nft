"use client";

import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface FilterChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  getLabel?: (option: T) => string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
  getLabel,
}: FilterChipsProps<T>) {
  return (
    <div className={cn("scrollbar-none flex gap-2 overflow-x-auto pb-1", className)}>
      {options.map((option) => {
        const active = option === value;

        return (
          <motion.button
            key={option}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition",
              active
                ? "border-gainix-400/50 bg-gainix-500/20 text-white shadow-[0_0_20px_rgba(244,63,94,0.18)]"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
            )}
          >
            {getLabel ? getLabel(option) : option}
          </motion.button>
        );
      })}
    </div>
  );
}
