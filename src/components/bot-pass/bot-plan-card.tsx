import { BadgeCheck, Bot, Sparkles } from "lucide-react";
import { formatCurrency } from "@/utils/format";

interface BotPlanCardProps {
  name: string;
  price: number;
  buyLimit: number;
  sellLimit: number;
  onBuy?: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
}

const features = ["Auto Trading", "Profit Generation", "MLM Enabled"] as const;

export function BotPlanCard({
  name,
  price,
  buyLimit,
  sellLimit,
  onBuy,
  isDisabled = false,
  isLoading = false,
}: BotPlanCardProps) {
  return (
    <div className="section-shell lux-card flex h-full flex-col gap-4 rounded-[28px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold text-white">{name}</p>
          <p className="mt-2 text-2xl font-semibold text-transparent bg-gradient-to-r from-white via-amber-100 to-amber-300 bg-clip-text">
            {formatCurrency(price)}
          </p>
          <p className="mt-2 text-sm text-zinc-300">
            {buyLimit.toLocaleString()} Buy + {sellLimit.toLocaleString()} Sell
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gainix-400/20 bg-gradient-to-br from-rose-500/18 via-red-500/12 to-amber-400/18 text-amber-100 shadow-[0_0_24px_rgba(249,115,22,0.16)]">
          <Bot className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-2">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
            <Sparkles className="h-3.5 w-3.5 text-gainix-300" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onBuy}
        disabled={isDisabled}
        className="premium-button mt-auto w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        <BadgeCheck className="mr-2 h-4 w-4" />
        {isLoading ? "Buying..." : "Buy"}
      </button>
    </div>
  );
}
