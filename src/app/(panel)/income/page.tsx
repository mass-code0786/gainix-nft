"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleDollarSign } from "lucide-react";
import { IncomeHistoryItem } from "@/components/income/income-history-item";
import { AnimatedPage } from "@/components/ui/animated-page";
import { FilterChips } from "@/components/ui/filter-chips";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { incomeCategoryMeta, incomeCategoryOrder, isIncomeCategoryKey } from "@/data/income";
import { useIncome } from "@/hooks/useIncome";
import { formatTodayIncome, formatUsdt } from "@/utils/format";

export default function IncomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { categories, summary, isLoading, error } = useIncome();
  const requestedCategory = searchParams.get("category");
  const activeCategoryKey = isIncomeCategoryKey(requestedCategory) ? requestedCategory : incomeCategoryOrder[0];
  const activeCategory = categories.find((item) => item.key === activeCategoryKey) ?? categories[0];

  const handleCategoryChange = (nextCategory: (typeof incomeCategoryOrder)[number]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", nextCategory);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <AnimatedPage>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem]">Income</h1>

        <Link href="/dashboard" prefetch={false} className="secondary-button w-full sm:w-auto">
          Back to dashboard
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total Income" value={formatUsdt(summary.total)} icon={CircleDollarSign} tone="positive" />
        <StatCard label="Today" value={formatUsdt(summary.today)} tone="positive" />
        <StatCard label="This Week" value={formatUsdt(summary.weekly)} tone="positive" />
        <StatCard label="This Month" value={formatUsdt(summary.monthly)} tone="positive" />
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          Loading income overview.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="section-shell">
        <SectionHeader title="Income Categories" />
        <FilterChips
          options={incomeCategoryOrder}
          value={activeCategoryKey}
          onChange={handleCategoryChange}
          getLabel={(key) => incomeCategoryMeta[key].label}
        />
      </div>

      <div className="section-shell">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h2 className="font-display text-[1.75rem] font-semibold leading-tight text-white">{activeCategory.label}</h2>
            <div>
              <p className="font-display text-[2rem] font-semibold leading-tight text-white sm:text-[2.3rem]">
                {formatUsdt(activeCategory.total)}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-400">{formatTodayIncome(activeCategory.today)}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-gainix-400/20 bg-gainix-500/10 px-4 py-3 text-sm text-gainix-100">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gainix-200/80">Last credited date</p>
            <p className="mt-2 font-medium text-white">{activeCategory.lastCreditedDate}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="glass-card rounded-3xl p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Total earned</p>
            <p className="mt-3 font-display text-2xl font-semibold text-white">{formatUsdt(activeCategory.total)}</p>
          </div>
          <div className="glass-card rounded-3xl p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pending amount</p>
            <p className="mt-3 font-display text-2xl font-semibold text-white">{formatUsdt(activeCategory.pending)}</p>
          </div>
          <div className="glass-card rounded-3xl p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">This week</p>
            <p className="mt-3 font-display text-2xl font-semibold text-white">{formatUsdt(activeCategory.weekly)}</p>
          </div>
          <div className="glass-card rounded-3xl p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">This month</p>
            <p className="mt-3 font-display text-2xl font-semibold text-white">{formatUsdt(activeCategory.monthly)}</p>
          </div>
        </div>
      </div>

      <div className="section-shell">
        <SectionHeader title="Credit History" />
        <div className="space-y-3">
          {activeCategory.history.map((item) => (
            <IncomeHistoryItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </AnimatedPage>
  );
}
