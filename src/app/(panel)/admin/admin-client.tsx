"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  ImagePlus,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Users,
  Vault,
  Wallet,
} from "lucide-react";
import { AreaChartBlock } from "@/components/charts/area-chart-block";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useAdminPanel } from "@/hooks/useAdminPanel";
import { useNftAdminAccess } from "@/hooks/useNftAdminAccess";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/web3/wallet-utils";
import { formatUsdt } from "@/utils/format";

type ReserveMode = "add" | "deduct";

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminPage() {
  const { isConnected, address, chainName } = useWallet();
  const {
    isOwner,
    isOwnerCheckReady,
    isLoading: isCheckingOwner,
    owner,
    error: ownerError,
  } = useNftAdminAccess();
  const admin = useAdminPanel(isConnected && isOwnerCheckReady && isOwner);
  const [settingsForm, setSettingsForm] = useState({
    nftPriceIncreaseMinPercent: "0",
    nftPriceIncreaseMaxPercent: "0",
    autoSellDelayMinMinutes: "0",
    autoSellDelayMaxMinutes: "0",
    botProfitMinPercent: "0",
    botProfitMaxPercent: "0",
    withdrawalMinimumAmount: "0",
    withdrawalFeePercent: "0",
    vipFirstPayoutDay: "10",
    vipSecondPayoutDay: "20",
    vipRecurringEnabled: true,
    globalDailyPayoutCap: "10000",
    perUserDailyPayoutCap: "1000",
    maxDailyWithdrawalAmountPerUser: "500",
    minimumTradeAmount: "10",
  });
  const [reserveAdjustment, setReserveAdjustment] = useState("0");
  const [reserveMode, setReserveMode] = useState<ReserveMode>("add");
  const [nftForm, setNftForm] = useState({
    tokenId: "",
    name: "",
    imageUrl: "",
    basePrice: "",
    category: "",
    description: "",
    status: "live" as "draft" | "live",
  });
  const [nftEdits, setNftEdits] = useState<Record<string, { price: string; status: "draft" | "live" }>>({});

  useEffect(() => {
    if (!admin.data) {
      return;
    }

    setSettingsForm({
      nftPriceIncreaseMinPercent: String(admin.data.settings.nftPriceIncreaseMinPercent),
      nftPriceIncreaseMaxPercent: String(admin.data.settings.nftPriceIncreaseMaxPercent),
      autoSellDelayMinMinutes: String(admin.data.settings.autoSellDelayMinMinutes),
      autoSellDelayMaxMinutes: String(admin.data.settings.autoSellDelayMaxMinutes),
      botProfitMinPercent: String(admin.data.settings.botProfitMinPercent),
      botProfitMaxPercent: String(admin.data.settings.botProfitMaxPercent),
      withdrawalMinimumAmount: String(admin.data.settings.withdrawalMinimumAmount),
      withdrawalFeePercent: String(admin.data.settings.withdrawalFeePercent),
      vipFirstPayoutDay: String(admin.data.settings.vipFirstPayoutDay),
      vipSecondPayoutDay: String(admin.data.settings.vipSecondPayoutDay),
      vipRecurringEnabled: admin.data.settings.vipRecurringEnabled,
      globalDailyPayoutCap: String(admin.data.settings.globalDailyPayoutCap),
      perUserDailyPayoutCap: String(admin.data.settings.perUserDailyPayoutCap),
      maxDailyWithdrawalAmountPerUser: String(admin.data.settings.maxDailyWithdrawalAmountPerUser),
      minimumTradeAmount: String(admin.data.settings.minimumTradeAmount),
    });
  }, [admin.data]);

  const settings = admin.data?.settings;
  const reserve = admin.data?.systemReserve;
  const summary = admin.data?.summary;
  const analytics = admin.analytics;
  const pendingWithdrawals = admin.data?.pendingWithdrawals ?? [];
  const blockedPayoutLogs = admin.data?.blockedPayoutLogs ?? [];
  const payoutSeries = useMemo(
    () =>
      (analytics?.series ?? []).map((item) => ({
        label: item.label,
        value: item.deposits,
        volume: item.payouts,
      })),
    [analytics?.series],
  );
  const profitSeries = useMemo(
    () =>
      (analytics?.series ?? []).map((item) => ({
        label: item.label,
        value: item.profitLoss,
      })),
    [analytics?.series],
  );
  const nextReserveBalance = useMemo(() => {
    const currentBalance = reserve?.balance ?? 0;
    const adjustment = parseAmount(reserveAdjustment);
    if (reserveMode === "add") {
      return currentBalance + adjustment;
    }

    return Math.max(0, currentBalance - adjustment);
  }, [reserve?.balance, reserveAdjustment, reserveMode]);
  const createdNfts = admin.nfts ?? [];

  async function createMarketplaceNft() {
    await admin.createNft({
      tokenId: nftForm.tokenId,
      name: nftForm.name,
      imageUrl: nftForm.imageUrl,
      basePrice: parseAmount(nftForm.basePrice),
      category: nftForm.category,
      description: nftForm.description,
      status: nftForm.status,
    });
    setNftForm({
      tokenId: "",
      name: "",
      imageUrl: "",
      basePrice: "",
      category: "",
      description: "",
      status: "live",
    });
  }

  if (!isConnected) {
    return (
      <AnimatedPage>
        <PageHeader
          title="Admin"
        />
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
          Wallet connection required.
        </div>
      </AnimatedPage>
    );
  }

  if (isCheckingOwner || !isOwnerCheckReady) {
    return (
      <AnimatedPage>
        <PageHeader title="Admin" />
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
          Verifying the connected wallet against the NFT owner wallet.
        </div>
      </AnimatedPage>
    );
  }

  if (!isOwner) {
    return (
      <AnimatedPage>
        <PageHeader title="Admin" />
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
          Connected wallet {address ? shortenAddress(address) : "Unavailable"} does not match
          contract owner {owner ? shortenAddress(owner) : "Unavailable"}.
        </div>
        {ownerError ? (
          <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {ownerError}
          </div>
        ) : null}
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="Admin Panel"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="System Reserve"
          value={formatUsdt(reserve?.balance ?? 0)}
          detail="Live reserve balance"
          icon={Vault}
          tone="positive"
        />
        <StatCard
          label="Total Users"
          value={`${summary?.totalUsers ?? 0}`}
          detail="Registered wallets"
          icon={Users}
        />
        <StatCard
          label="Pending Withdrawals"
          value={`${summary?.totalWithdrawalsPending ?? 0}`}
          detail="Approval queue"
          icon={Wallet}
        />
        <StatCard
          label="Total Payouts"
          value={formatUsdt(summary?.totalPayouts ?? 0)}
          detail="All payout volume"
          icon={Settings2}
          tone="positive"
        />
        <StatCard
          label="Payout Status"
          value={settings?.systemStopped ? "Stopped" : settings?.payoutsPaused ? "Paused" : "Running"}
          detail={settings?.vipRecurringEnabled ? "Royalty enabled" : "Royalty disabled"}
          icon={settings?.systemStopped ? ShieldOff : settings?.payoutsPaused ? PauseCircle : PlayCircle}
          tone={settings?.systemStopped || settings?.payoutsPaused ? "negative" : "positive"}
        />
      </div>

      {summary?.reserveWarning ? (
        <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Reserve warning
          </div>
          <p className="mt-2 text-amber-100/80">
            System reserve is below the configured per-user daily payout cap.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="muted-label">Charts</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Deposit vs payout trend
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              7 days
            </span>
          </div>
          <div className="mt-5">
            <AreaChartBlock data={payoutSeries} />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="muted-label">Daily Profit/Loss</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                {formatUsdt(analytics?.today.profitLoss ?? 0)}
              </h2>
            </div>
            <BarChart3 className="h-5 w-5 text-red-200" />
          </div>
          <div className="mt-5">
            <AreaChartBlock
              data={profitSeries}
              color={(analytics?.today.profitLoss ?? 0) >= 0 ? "#10b981" : "#f43f5e"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today Deposits"
          value={formatUsdt(analytics?.today.deposits ?? 0)}
          detail={`${analytics?.today.activeUsers ?? 0} active users`}
          icon={ArrowUpCircle}
          tone="positive"
        />
        <StatCard
          label="Today Withdrawals"
          value={formatUsdt(analytics?.today.withdrawals ?? 0)}
          detail={`${analytics?.today.nftTrades ?? 0} NFT trades`}
          icon={ArrowDownCircle}
        />
        <StatCard
          label="Today Payouts"
          value={formatUsdt(analytics?.today.payouts ?? 0)}
          detail={`${analytics?.today.botTrades ?? 0} bot trades`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Today Active"
          value={`${analytics?.today.activeUsers ?? 0}`}
          detail="Last 24 hours"
          icon={Activity}
        />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
        <p className="muted-label">Total Stats</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Deposits"
            value={formatUsdt(analytics?.totals.totalDeposits ?? 0)}
            detail="All deposit volume"
            tone="positive"
          />
          <StatCard
            label="Total Withdrawals"
            value={formatUsdt(analytics?.totals.totalWithdrawals ?? 0)}
            detail="All withdrawal requests"
          />
          <StatCard
            label="Total NFT Trades"
            value={`${analytics?.totals.totalNftTrades ?? 0}`}
            detail="Manual trades"
          />
          <StatCard
            label="Total Bot Trades"
            value={`${analytics?.totals.totalBotTrades ?? 0}`}
            detail="Bot trade records"
          />
          <StatCard
            label="Total MLM Payout"
            value={formatUsdt(analytics?.totals.totalMlmPayout ?? 0)}
            detail="Level income paid"
            tone="positive"
          />
          <StatCard
            label="Total Royalty Payout"
            value={formatUsdt(analytics?.totals.totalRoyaltyPayout ?? 0)}
            detail="Royalty income paid"
            tone="positive"
          />
          <StatCard
            label="Reserve Balance"
            value={formatUsdt(analytics?.totals.systemReserveBalance ?? 0)}
            detail="Current reserve"
            tone="positive"
          />
          <StatCard
            label="Active Users"
            value={`${analytics?.totals.activeUsers ?? 0}`}
            detail="Past 24 hours"
          />
        </div>
      </section>

      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_28%),linear-gradient(160deg,rgba(19,7,9,0.96),rgba(8,8,12,0.98))] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Owner access active
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
            {address ? shortenAddress(address) : "Unavailable"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-400">
            {chainName}
          </span>
        </div>

        {admin.error ? (
          <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {admin.error}
          </div>
        ) : null}
        {admin.notice ? (
          <div className="mt-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {admin.notice}
          </div>
        ) : null}
        {admin.isLoading ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            {admin.signPrompt ?? "Loading admin overview."}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="muted-label">Marketplace NFTs</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                Admin mint and list
              </h2>
            </div>
            <ImagePlus className="h-5 w-5 text-red-200" />
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Live marketplace NFTs are created only from this admin flow.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Token ID</span>
              <input
                className="input-shell"
                inputMode="numeric"
                value={nftForm.tokenId}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, tokenId: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Starting price</span>
              <input
                className="input-shell"
                inputMode="decimal"
                value={nftForm.basePrice}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, basePrice: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Category</span>
              <input
                className="input-shell"
                value={nftForm.category}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, category: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Status</span>
              <select
                className="input-shell"
                value={nftForm.status}
                onChange={(event) =>
                  setNftForm((current) => ({
                    ...current,
                    status: event.target.value === "draft" ? "draft" : "live",
                  }))
                }
              >
                <option value="live">Live</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm text-zinc-400">Name</span>
              <input
                className="input-shell"
                value={nftForm.name}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm text-zinc-400">Image URL</span>
              <input
                className="input-shell"
                value={nftForm.imageUrl}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm text-zinc-400">Description</span>
              <textarea
                className="input-shell min-h-24 resize-y"
                value={nftForm.description}
                onChange={(event) =>
                  setNftForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void createMarketplaceNft()}
            disabled={admin.isSaving || admin.isSigning}
            className="premium-button mt-5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {admin.isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Mint and list NFT
          </button>

          <div className="mt-5 space-y-3">
            {createdNfts.slice(0, 12).map((nft) => {
              const edit = nftEdits[nft.id] ?? {
                price: String(nft.currentPrice),
                status: nft.status === "draft" ? "draft" : "live",
              };
              const hasTradeHistory = nft.totalTrades > 0;

              return (
              <div
                key={nft.id}
                className="rounded-[22px] border border-white/10 bg-black/25 p-4 text-sm"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{nft.name}</p>
                    <p className="mt-1 text-zinc-400">
                      Token #{nft.tokenId} | {nft.category} | {nft.status === "marketplace" ? "live" : nft.status}
                    </p>
                    <p className="mt-1 line-clamp-2 text-zinc-500">{nft.description || "No description"}</p>
                  </div>
                  <span className="text-emerald-200">{formatUsdt(nft.currentPrice)}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.8fr_auto_auto]">
                  <input
                    className="input-shell"
                    inputMode="decimal"
                    value={edit.price}
                    onChange={(event) =>
                      setNftEdits((current) => ({
                        ...current,
                        [nft.id]: { ...edit, price: event.target.value },
                      }))
                    }
                  />
                  <select
                    className="input-shell"
                    value={edit.status}
                    onChange={(event) =>
                      setNftEdits((current) => ({
                        ...current,
                        [nft.id]: {
                          ...edit,
                          status: event.target.value === "draft" ? "draft" : "live",
                        },
                      }))
                    }
                  >
                    <option value="live">Live</option>
                    <option value="draft">Draft</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      void admin.updateNft({
                        nftId: nft.id,
                        currentPrice: parseAmount(edit.price),
                        status: edit.status,
                      })
                    }
                    disabled={admin.isSaving || admin.isSigning}
                    className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void admin.deleteNft(nft.id)}
                    disabled={admin.isSaving || admin.isSigning || hasTradeHistory}
                    className="secondary-button border-rose-500/30 text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
              );
            })}

            {!admin.isLoading && createdNfts.length === 0 ? (
              <div className="rounded-[22px] border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                No NFTs created yet. Marketplace will stay empty until an admin mints and lists one.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <p className="muted-label">Settings</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["NFT price increase min", "nftPriceIncreaseMinPercent"],
              ["NFT price increase max", "nftPriceIncreaseMaxPercent"],
              ["Auto sell delay min", "autoSellDelayMinMinutes"],
              ["Auto sell delay max", "autoSellDelayMaxMinutes"],
              ["Bot profit min", "botProfitMinPercent"],
              ["Bot profit max", "botProfitMaxPercent"],
              ["Withdrawal minimum", "withdrawalMinimumAmount"],
              ["Withdrawal fee %", "withdrawalFeePercent"],
              ["Royalty payout date 1", "vipFirstPayoutDay"],
              ["Royalty payout date 2", "vipSecondPayoutDay"],
              ["Global daily payout cap", "globalDailyPayoutCap"],
              ["Per-user daily payout cap", "perUserDailyPayoutCap"],
              ["Max daily withdrawal/user", "maxDailyWithdrawalAmountPerUser"],
              ["Minimum trade amount", "minimumTradeAmount"],
            ].map(([label, key]) => (
              <label key={key} className="block">
                <span className="mb-2 block text-sm text-zinc-400">{label}</span>
                <input
                  className="input-shell"
                  value={settingsForm[key as keyof typeof settingsForm] as string}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void admin.saveSettings({
                  nftPriceIncreaseMinPercent: parseAmount(settingsForm.nftPriceIncreaseMinPercent),
                  nftPriceIncreaseMaxPercent: parseAmount(settingsForm.nftPriceIncreaseMaxPercent),
                  autoSellDelayMinMinutes: parseAmount(settingsForm.autoSellDelayMinMinutes),
                  autoSellDelayMaxMinutes: parseAmount(settingsForm.autoSellDelayMaxMinutes),
                  botProfitMinPercent: parseAmount(settingsForm.botProfitMinPercent),
                  botProfitMaxPercent: parseAmount(settingsForm.botProfitMaxPercent),
                  withdrawalMinimumAmount: parseAmount(settingsForm.withdrawalMinimumAmount),
                  withdrawalFeePercent: parseAmount(settingsForm.withdrawalFeePercent),
                  vipFirstPayoutDay: parseAmount(settingsForm.vipFirstPayoutDay),
                  vipSecondPayoutDay: parseAmount(settingsForm.vipSecondPayoutDay),
                  vipRecurringEnabled: settingsForm.vipRecurringEnabled,
                  globalDailyPayoutCap: parseAmount(settingsForm.globalDailyPayoutCap),
                  perUserDailyPayoutCap: parseAmount(settingsForm.perUserDailyPayoutCap),
                  maxDailyWithdrawalAmountPerUser: parseAmount(settingsForm.maxDailyWithdrawalAmountPerUser),
                  minimumTradeAmount: parseAmount(settingsForm.minimumTradeAmount),
                })
              }
              disabled={admin.isSaving || admin.isSigning}
              className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              {admin.isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save settings
            </button>
            <button
              type="button"
              onClick={() =>
                setSettingsForm((current) => ({
                  ...current,
                  vipRecurringEnabled: !current.vipRecurringEnabled,
                }))
              }
              className={`secondary-button ${
                settingsForm.vipRecurringEnabled
                  ? "border-emerald-500/30 text-emerald-200"
                  : "border-amber-500/30 text-amber-200"
              }`}
            >
              Royalty {settingsForm.vipRecurringEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <p className="muted-label">System Reserve</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              {formatUsdt(reserve?.balance ?? 0)}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Use add or deduct to adjust the live reserve without entering raw final totals.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setReserveMode("add")}
                className={`secondary-button ${reserveMode === "add" ? "border-emerald-500/30 text-emerald-200" : ""}`}
              >
                Add reserve
              </button>
              <button
                type="button"
                onClick={() => setReserveMode("deduct")}
                className={`secondary-button ${reserveMode === "deduct" ? "border-rose-500/30 text-rose-200" : ""}`}
              >
                Deduct reserve
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-zinc-400">Adjustment amount</span>
              <input
                className="input-shell"
                value={reserveAdjustment}
                onChange={(event) => setReserveAdjustment(event.target.value)}
              />
            </label>

            <div className="mt-4 rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              <p>Next reserve balance: {formatUsdt(nextReserveBalance)}</p>
              <p className="mt-2">Royalty paid: {formatUsdt(summary?.royaltyPaid ?? 0)}</p>
              <p className="mt-2">Approved withdrawals: {formatUsdt(summary?.approvedWithdrawalTotal ?? 0)}</p>
            </div>

            <button
              type="button"
              onClick={() => void admin.saveReserve(nextReserveBalance)}
              disabled={admin.isSaving || admin.isSigning}
              className="premium-button mt-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {admin.isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply reserve change
            </button>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
            <p className="muted-label">Safety Control</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              {settings?.systemStopped ? "System stopped" : settings?.payoutsPaused ? "Payouts paused" : "System running"}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Emergency stop blocks bot engine, royalty payout, MLM payout, and withdrawals.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void admin.saveSettings({ systemStopped: true })}
                disabled={admin.isSaving || admin.isSigning || Boolean(settings?.systemStopped)}
                className="secondary-button border-rose-500/30 text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Emergency stop
              </button>
              <button
                type="button"
                onClick={() => void admin.saveSettings({ systemStopped: false })}
                disabled={admin.isSaving || admin.isSigning || !settings?.systemStopped}
                className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resume system
              </button>
              <button
                type="button"
                onClick={() => void admin.togglePayouts(true)}
                disabled={admin.isSaving || admin.isSigning || Boolean(settings?.payoutsPaused) || Boolean(settings?.systemStopped)}
                className="secondary-button disabled:cursor-not-allowed disabled:opacity-60"
              >
                Pause payouts
              </button>
              <button
                type="button"
                onClick={() => void admin.togglePayouts(false)}
                disabled={admin.isSaving || admin.isSigning || !settings?.payoutsPaused || Boolean(settings?.systemStopped)}
                className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resume payouts
              </button>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="muted-label">Blocked Payout Logs</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Safety Events
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
            {blockedPayoutLogs.length} blocked
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {blockedPayoutLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="rounded-[24px] border border-rose-500/15 bg-rose-500/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-rose-100">{log.reason}</p>
                  <p className="mt-1 text-sm text-rose-100/70">
                    {log.amount ? formatUsdt(log.amount) : "No amount"} | {log.userId ?? "System"}
                  </p>
                </div>
                <p className="text-xs text-rose-100/60">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}

          {!admin.isLoading && blockedPayoutLogs.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              No blocked payout logs.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="muted-label">Withdrawal Approval List</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">
              Pending Withdrawals
            </h2>
          </div>
          <button type="button" onClick={() => void admin.refresh()} className="secondary-button">
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {pendingWithdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(23,10,12,0.92),rgba(11,11,15,0.96))] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {withdrawal.user?.walletAddress
                      ? shortenAddress(withdrawal.user.walletAddress)
                      : withdrawal.userId}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Amount {formatUsdt(withdrawal.grossAmount)} | Fee {formatUsdt(withdrawal.feeAmount)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {new Date(withdrawal.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void admin.approve(withdrawal.id)}
                  disabled={admin.isSaving || admin.isSigning || Boolean(settings?.payoutsPaused) || Boolean(settings?.systemStopped)}
                  className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}

          {!admin.isLoading && pendingWithdrawals.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              No pending withdrawals.
            </div>
          ) : null}
        </div>
      </section>
    </AnimatedPage>
  );
}
