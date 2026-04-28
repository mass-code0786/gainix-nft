import Link from "next/link";
import { Activity, ShoppingBag, Tag, XCircle } from "lucide-react";
import { buildMarketplaceHref } from "@/lib/marketplace/routing";
import { cn } from "@/utils/cn";
import { formatCurrency, formatWallet } from "@/utils/format";

interface ActivityFeedItem {
  id: string;
  type: "mint" | "list" | "buy" | "sell" | "cancel";
  nftName: string;
  nftSlug: string;
  nftTokenId?: number;
  href?: string;
  from: string;
  to?: string;
  price?: number;
  time: string;
  txHash: string;
}

interface ActivityFeedProps {
  items: ActivityFeedItem[];
  limit?: number;
}

const iconMap = {
  mint: Activity,
  list: Tag,
  buy: ShoppingBag,
  sell: ShoppingBag,
  cancel: XCircle,
};

export function ActivityFeed({ items, limit = 5 }: ActivityFeedProps) {
  return (
    <div className="section-shell lux-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="muted-label">Activity</p>
          <h3 className="font-display text-2xl font-semibold text-white">Recent market moves</h3>
        </div>
      </div>

      <div className="space-y-3">
        {items.slice(0, limit).map((item) => {
          const Icon = iconMap[item.type];
          const nftHref =
            item.href ?? (typeof item.nftTokenId === "number" ? buildMarketplaceHref(item.nftTokenId) : `/marketplace/${item.nftSlug}`);

          return (
            <div key={item.id} className="glass-card interactive-surface rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-gainix-400/20 bg-gainix-500/10 p-3 text-gainix-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={nftHref} prefetch={false} className="font-medium text-white">
                        {item.nftName}
                      </Link>
                      <p className="mt-1 text-sm text-zinc-500">
                        {item.type.toUpperCase()} by {formatWallet(item.from)}
                        {item.to ? ` -> ${formatWallet(item.to)}` : ""}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.time}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {item.price ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                        {formatCurrency(item.price)}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 uppercase tracking-[0.14em]",
                        item.type === "cancel"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                      )}
                    >
                      {item.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
