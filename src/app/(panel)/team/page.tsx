"use client";

import { Crown, Share2, Users } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useTeam } from "@/hooks/useTeam";
import { formatUsdt } from "@/utils/format";
import { formatWallet } from "@/utils/format";

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
  const { data, isLoading, error } = useTeam();
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

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          Loading team overview.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {teamSummaryCards.map(({ title, value, icon: Icon }) => (
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
        <p className="muted-label">Members</p>
        <div className="mt-5 space-y-3">
          {(data?.directs ?? []).map((member) => (
            <div key={member.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">Direct Referral</p>
                  <p className="mt-1 text-sm text-zinc-500">{formatWallet(member.walletAddress)}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  Active
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Joined {new Date(member.createdAt).toLocaleDateString()} | 1 wallet connection
              </p>
            </div>
          ))}
          {!isLoading && (data?.directs.length ?? 0) === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              No direct team members yet.
            </div>
          ) : null}
        </div>
      </div>
    </AnimatedPage>
  );
}
