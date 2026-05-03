import type { BotAutomationActivity } from "@/types";
import { formatCurrency } from "@/utils/format";
import { getStatusTone } from "@/utils/format";

interface BotActivityTimelineProps {
  activity: BotAutomationActivity[];
}

function formatActionLabel(activity: BotAutomationActivity) {
  if (activity.action === "AUTO_SELL" && typeof activity.profit === "number") {
    return `Auto Sold${activity.profit > 0 ? ` - Profit ${formatCurrency(activity.profit)}` : ""}`;
  }

  if (activity.action === "AUTO_LIST") {
    return "Listed For Sell";
  }

  return "Auto Bought NFT";
}

function isFakeSkippedBotAttempt(activity: BotAutomationActivity) {
  return (
    activity.status === "SKIPPED" &&
    activity.amount === 0 &&
    formatActionLabel(activity).includes("Auto Bought NFT") &&
    (activity.nft?.name ?? activity.nftId ?? "System NFT") === "System NFT"
  );
}

export function BotActivityTimeline({ activity }: BotActivityTimelineProps) {
  const visibleActivity = activity.filter((entry) => !isFakeSkippedBotAttempt(entry));

  return (
    <div className="section-shell lux-card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Bot Activity</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">Automation Timeline</h2>
        </div>
      </div>

      <div className="space-y-3">
        {visibleActivity.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            No bot activity yet.
          </div>
        ) : (
          visibleActivity.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  {new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  - {formatActionLabel(entry)}
                </p>
                <p className="text-sm text-zinc-400">
                  {entry.nft?.name ?? entry.nftId ?? "System NFT"} - {formatCurrency(entry.amount)}
                </p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusTone(entry.status)}`}>
                {entry.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
