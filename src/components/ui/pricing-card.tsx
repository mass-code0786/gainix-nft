"use client";

import { BadgeCheck, Bot, Sparkles } from "lucide-react";
import type { BotPlan } from "@/types";

interface PricingCardProps {
  plan: BotPlan;
  active?: boolean;
  onAction?: (plan: BotPlan) => void;
  actionLabel?: string;
  loading?: boolean;
}

export function PricingCard({
  plan,
  active = false,
  onAction,
  actionLabel,
  loading = false,
}: PricingCardProps) {
  return (
    <div className={`section-shell interactive-surface overflow-hidden ${plan.highlight || active ? "border-gainix-400/30 bg-gainix-900/20" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-gainix-400/20 bg-gainix-500/10 px-3 py-1 text-xs font-medium text-gainix-200">
            {plan.badge}
          </div>
          <h3 className="font-display text-2xl font-semibold text-white">${plan.price}</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{plan.description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-gainix-200">
          <Bot className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-zinc-500">Queue cycles</p>
          <p className="mt-2 text-xl font-semibold text-white">{plan.cycles.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-zinc-500">Order windows</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {plan.buyTrades.toLocaleString()} / {plan.sellTrades.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Sparkles className="h-4 w-4 text-gainix-300" />
          {plan.feature}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-zinc-400">
        {plan.perks.map((perk) => (
          <div key={perk} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            {perk}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAction?.(plan)}
        disabled={loading}
        className="premium-button mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        <BadgeCheck className="mr-2 h-4 w-4" />
        {loading ? "Awaiting wallet..." : actionLabel ?? (active ? "Active utility plan" : "Select utility plan")}
      </button>
    </div>
  );
}
