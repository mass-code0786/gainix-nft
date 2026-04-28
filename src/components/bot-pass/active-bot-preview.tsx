import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Bot, Wallet } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatSignedCurrency } from "@/utils/format";
import { getStatusTone } from "@/utils/format";

interface ActiveBotPreviewProps {
  botName: string;
  statusLabel: string;
  completedBuyTrades: string;
  completedSellTrades: string;
  remainingTrades: string;
  progress: number;
  todayProfit: number;
  totalProfit: number;
  latestAction: string;
}

export function ActiveBotPreview({
  botName,
  statusLabel,
  completedBuyTrades,
  completedSellTrades,
  remainingTrades,
  progress,
  todayProfit,
  totalProfit,
  latestAction,
}: ActiveBotPreviewProps) {
  return (
    <div className="section-shell lux-card flex flex-col gap-4 rounded-[28px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Active Bot</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">{botName}</h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gainix-400/20 bg-gradient-to-br from-rose-500/18 via-red-500/12 to-amber-400/18 text-amber-100 shadow-[0_0_24px_rgba(249,115,22,0.16)]">
          <Bot className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Buy Trades</p>
          <p className="mt-2 text-xl font-semibold text-white">{completedBuyTrades}</p>
        </div>
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-300">
            <BadgeCheck className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.18em]">Status</span>
          </div>
          <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getStatusTone(statusLabel)}`}>
            {statusLabel}
          </p>
        </div>
      </div>

      <ProgressBar label="Bot Progress" value={progress} hint={`${progress}%`} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Sell Trades</p>
          <p className="mt-2 text-xl font-semibold text-white">{completedSellTrades}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Remaining</p>
          <p className="mt-2 text-xl font-semibold text-white">{remainingTrades}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-[0.18em]">Today Profit</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-emerald-400">{formatSignedCurrency(todayProfit)}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Wallet className="h-4 w-4 text-amber-300" />
            <span className="text-xs uppercase tracking-[0.18em]">Total Profit</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{formatSignedCurrency(totalProfit)}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Latest Bot Action</p>
        <p className="mt-2 text-sm font-medium text-zinc-200">{latestAction}</p>
      </div>

      <Link href="/bot-subscription" className="secondary-button w-full text-center">
        View Bot Details
      </Link>
    </div>
  );
}
