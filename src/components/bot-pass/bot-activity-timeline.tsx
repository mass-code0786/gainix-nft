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

function getBotEventOrder(type: string | null | undefined) {
  if (!type) return 99;

  const t = type.toLowerCase();

  if (t.includes("buy")) return 1;
  if (t.includes("list")) return 2;
  if (t.includes("sell") || t.includes("profit")) return 3;

  return 99;
}

function activityDisplayTime(activity: BotAutomationActivity) {
  if (activity.action === "AUTO_BUY") {
    return activity.tradeCreatedAt ?? activity.createdAt;
  }

  if (activity.action === "AUTO_LIST") {
    return activity.listedAt ?? activity.createdAt;
  }

  return activity.soldAt ?? activity.createdAt;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringField(activity: BotAutomationActivity, key: string) {
  const value = (activity as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventCycleKey(activity: BotAutomationActivity) {
  const explicitKey =
    stringField(activity, "botTradeId") ??
    stringField(activity, "nftTradeId") ??
    stringField(activity, "listingId") ??
    stringField(activity, "relatedTradeId") ??
    stringField(activity, "cycleId");

  if (explicitKey) {
    return explicitKey;
  }

  if (activity.botSubscriptionId && activity.nftId && activity.tradeCreatedAt) {
    return `${activity.botSubscriptionId}:${activity.nftId}:${activity.tradeCreatedAt}`;
  }

  return null;
}

function groupEventsByCycle(events: BotAutomationActivity[]) {
  const map = new Map<string, BotAutomationActivity[]>();
  const ungrouped: BotAutomationActivity[] = [];

  for (const event of events) {
    const key = eventCycleKey(event);

    if (!key) {
      ungrouped.push(event);
      continue;
    }

    map.set(key, [...(map.get(key) ?? []), event]);
  }

  return {
    cycles: Array.from(map.values()),
    ungrouped,
  };
}

function sortCycles(cycles: BotAutomationActivity[][]) {
  return [...cycles].sort((a, b) => {
    const maxA = Math.max(...a.map((event) => new Date(activityDisplayTime(event)).getTime()));
    const maxB = Math.max(...b.map((event) => new Date(activityDisplayTime(event)).getTime()));
    return maxB - maxA;
  });
}

function sortCycleEvents(events: BotAutomationActivity[]) {
  return [...events].sort((a, b) => {
    const orderDiff = getBotEventOrder(a.action) - getBotEventOrder(b.action);

    if (orderDiff !== 0) return orderDiff;

    return new Date(activityDisplayTime(a)).getTime() - new Date(activityDisplayTime(b)).getTime();
  });
}

function orderedTimeline(activity: BotAutomationActivity[]) {
  const events = activity.filter((entry) => !isFakeSkippedBotAttempt(entry));
  const { cycles, ungrouped } = groupEventsByCycle(events);

  console.log("[bot.timeline.ui]", cycles.length);

  if (cycles.length === 0) {
    return [...ungrouped].sort(
      (a, b) => new Date(activityDisplayTime(b)).getTime() - new Date(activityDisplayTime(a)).getTime(),
    );
  }

  return [
    ...sortCycles(cycles).flatMap((cycle) => sortCycleEvents(cycle)),
    ...ungrouped.sort(
      (a, b) => new Date(activityDisplayTime(b)).getTime() - new Date(activityDisplayTime(a)).getTime(),
    ),
  ];
}

export function BotActivityTimeline({ activity }: BotActivityTimelineProps) {
  const visibleActivity = orderedTimeline(activity);

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
                  {formatDate(activityDisplayTime(entry))}{" "}
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
