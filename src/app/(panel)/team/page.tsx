"use client";

import { ChangeEvent, useCallback, useState } from "react";
import { Crown, Loader2, Share2, Users } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { useTeamLevelMembers } from "@/hooks/useTeamLevelMembers";
import { useTeamSummary } from "@/hooks/useTeamSummary";
import { formatUsdt } from "@/utils/format";
import { formatWallet } from "@/utils/format";

const TEAM_LEVEL_OPTIONS = [
  { value: 1, label: "Level 1" },
  { value: 2, label: "Level 2" },
  { value: 3, label: "Level 3" },
  { value: 4, label: "Level 4" },
  { value: 5, label: "Level 5" },
] as const;

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function TeamMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="h-full rounded-2xl border border-red-400/20 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),linear-gradient(155deg,rgba(25,8,10,0.92),rgba(8,8,12,0.96))] p-3 shadow-[0_0_28px_rgba(239,68,68,0.12)] backdrop-blur-xl sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">{label}</p>
      <p className="mt-3 truncate font-display text-2xl font-semibold text-white sm:text-3xl">{value}</p>
      {detail ? <p className="mt-2 text-xs text-zinc-400">{detail}</p> : null}
    </div>
  );
}

export default function TeamPage() {
  const [selectedLevel, setSelectedLevel] = useState(1);
  const { data, isLoading, error } = useTeamSummary();
  const levelMembers = useTeamLevelMembers(selectedLevel);
  const handleLevelSelect = useCallback((level: number) => {
    console.info("[team.level.select]", { selectedLevel: level });
    setSelectedLevel(level);
  }, []);
  const handleLevelDropdownChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      handleLevelSelect(Number(event.target.value));
    },
    [handleLevelSelect],
  );
  const royalty = data?.royalty ?? null;
  const progress = royalty?.currentRequirementProgress ?? null;
  const teamOverview = {
    totalTeam: data?.levelBreakdown.reduce((total, item) => total + item.downlineCount, 0) ?? 0,
    referralTeam: data?.directCount ?? 0,
    currentRankTarget:
      royalty?.nextVipLevel === 1 ? progress?.qualifiedLevel1Required ?? 5 : progress?.directQualifiedRequired ?? 2,
    currentRankProgress:
      royalty?.nextVipLevel === 1 ? progress?.qualifiedLevel1Users ?? 0 : progress?.directQualifiedUsers ?? 0,
    eligible: (royalty?.currentVipLevel ?? 0) > 0,
  } as const;
  const teamSummaryCards = [
    {
      title: "Total Team",
      value: teamOverview.totalTeam,
      icon: Users,
    },
    {
      title: "Referral Team",
      value: teamOverview.referralTeam,
      icon: Share2,
    },
  ] as const;
  const rankProgressPercent = Math.min(
    100,
    Math.round((teamOverview.currentRankProgress / Math.max(teamOverview.currentRankTarget, 1)) * 100),
  );
  const vipLabel = royalty?.currentVipLevel ? `VIP ${royalty.currentVipLevel}` : "VIP 0";

  return (
    <AnimatedPage>
      <PageHeader title="Team" />

      {error ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {isLoading ? (
          <>
            <SkeletonBlock className="h-32" />
            <SkeletonBlock className="h-32" />
          </>
        ) : teamSummaryCards.map(({ title, value, icon: Icon }) => (
          <div
            key={title}
            className="section-shell lux-card interactive-surface rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_34%),linear-gradient(160deg,rgba(22,8,10,0.96),rgba(10,10,14,0.98))] p-3 sm:p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">{title}</p>
                <p className="mt-3 font-display text-2xl font-semibold leading-none text-white sm:text-3xl">
                  {value}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-400/20 bg-gradient-to-br from-rose-500/18 via-red-500/12 to-amber-400/18 text-amber-100 shadow-[0_0_22px_rgba(249,115,22,0.14)]">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-shell lux-card rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_28%),linear-gradient(160deg,rgba(20,8,10,0.96),rgba(9,9,13,0.98))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="muted-label">Royalty Status</p>
            <div className="flex items-center gap-2 text-white">
              <Crown className="h-4 w-4 text-amber-300" />
              <h2 className="font-display text-2xl font-semibold">{vipLabel}</h2>
            </div>
          </div>

          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              teamOverview.eligible
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {teamOverview.eligible ? "Qualified" : "In Progress"}
          </span>
        </div>

        <ProgressBar
          label={royalty?.nextVipLevel === 1 ? "Level 1 team progress" : "Direct VIP progress"}
          value={rankProgressPercent}
          hint={`${teamOverview.currentRankProgress} / ${teamOverview.currentRankTarget}`}
          className="mt-5"
        />

        {progress ? (
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="glass-card rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Self package</p>
              <p className="mt-3 truncate font-display text-2xl font-semibold text-white sm:text-3xl">
                {formatUsdt(progress.selfPackageAmount)}
              </p>
              <p className="mt-2 text-xs text-zinc-400">Required {formatUsdt(progress.selfPackageRequired)}</p>
            </div>
            {royalty?.nextVipLevel === 1 ? (
              <>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Level 1 qualified</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">{progress.qualifiedLevel1Users ?? 0}</p>
                  <p className="mt-2 text-xs text-zinc-400">Need {progress.qualifiedLevel1Required ?? 5} users</p>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Level 2 qualified</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">{progress.qualifiedLevel2Users ?? 0}</p>
                  <p className="mt-2 text-xs text-zinc-400">Need {progress.qualifiedLevel2Required ?? 10} users</p>
                </div>
                <TeamMetricCard
                  label="Min team package"
                  value={formatUsdt(progress.minimumTeamPackageAmount ?? 100)}
                  detail="Only qualified package users count"
                />
                <div className="col-span-2 grid gap-3 lg:grid-cols-2 xl:col-span-4">
                  <TeamMetricCard
                    label="Team sales"
                    value={formatUsdt(progress.teamSalesAmount ?? 0)}
                    detail="Total qualified team sales"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Qualified directs</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">{progress.directQualifiedUsers ?? 0}</p>
                  <p className="mt-2 text-xs text-zinc-400">Need {progress.directQualifiedRequired ?? 2} directs</p>
                </div>
                <div className="glass-card col-span-2 rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">Previous VIP required</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">
                    VIP {progress.previousVipLevelRequired ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">Direct level 1 users must already hold this VIP level</p>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="section-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Level {selectedLevel} Members ({levelMembers.total})
            </h2>
          </div>

          <select
            value={selectedLevel}
            onChange={handleLevelDropdownChange}
            className="w-full rounded-2xl border border-red-400/20 bg-black/50 px-4 py-3 text-sm font-semibold text-white outline-none ring-0 transition focus:border-amber-300/60 sm:hidden"
            aria-label="Select team level"
          >
            {TEAM_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-zinc-950 text-white">
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-1 backdrop-blur-xl">
            {TEAM_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleLevelSelect(option.value)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  selectedLevel === option.value
                    ? "bg-gradient-to-r from-red-600/80 to-amber-500/80 text-white shadow-[0_0_20px_rgba(239,68,68,0.18)]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {levelMembers.error ? (
          <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {levelMembers.error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {levelMembers.isLoading ? (
            <>
              <SkeletonBlock className="h-40" />
              <SkeletonBlock className="h-40" />
            </>
          ) : levelMembers.members.map((member) => (
            <div
              key={`${member.level}-${member.walletAddress}`}
              className="rounded-3xl border border-red-400/15 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_32%),linear-gradient(155deg,rgba(20,8,10,0.88),rgba(8,8,12,0.94))] p-4 shadow-[0_0_26px_rgba(127,29,29,0.12)] backdrop-blur-xl transition duration-200 hover:border-amber-300/25 hover:bg-black/35"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Wallet</p>
                  <p className="mt-1 truncate font-medium text-white">{formatWallet(member.walletAddress)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                    member.status === "Active"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/5 text-zinc-300"
                  }`}
                >
                  {member.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Package</p>
                  <p className="mt-1 font-semibold text-amber-100">{formatUsdt(member.packageAmount)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Bot Active</p>
                  <p className="mt-1 font-semibold text-white">
                    {member.botAmount > 0 ? "YES" : "NO"}
                    {member.botAmount > 0 ? <span className="text-zinc-500"> / {formatUsdt(member.botAmount)}</span> : null}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Joined</p>
                  <p className="mt-1 font-semibold text-white">{formatJoinedDate(member.joinedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-zinc-500">Trading Wallet</p>
                  <p className="mt-1 font-semibold text-white">{formatUsdt(member.tradingWallet)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!levelMembers.isLoading && levelMembers.members.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            No members found for this level.
          </div>
        ) : null}

        {levelMembers.hasMore ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={levelMembers.loadMore}
              disabled={levelMembers.isLoadingMore}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300/40 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {levelMembers.isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {levelMembers.isLoadingMore ? "Loading" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </AnimatedPage>
  );
}
