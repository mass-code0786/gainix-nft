import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NftSimState, UserRecord, WalletRecord } from "@/server/nft-sim/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, "nft-sim-db.json");
const DEFAULT_TRADING_BALANCE = 0;

let transactionQueue = Promise.resolve();

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function createSeedState(): NftSimState {
  const now = nowIso();
  const demoUser: UserRecord = {
    id: "user-demo",
    walletAddress: "0x1111111111111111111111111111111111111111",
    selfPackageAmount: 0,
    currentVipLevel: 0,
    vipAchievedAt: null,
    totalBuyCount: 0,
    totalSellCount: 0,
    dailyBuyCount: 0,
    dailySellCount: 0,
    lastTradeResetAt: now,
    capitalUnlocked: false,
    capitalUnlockedAt: null,
    capitalTransferredAt: null,
    createdAt: now,
  };
  const demoWallet: WalletRecord = {
    id: "wallet-demo",
    userId: demoUser.id,
    tradingWallet: DEFAULT_TRADING_BALANCE,
    withdrawalWallet: 0,
    totalDeposited: 0,
    buyCount: 0,
    sellCount: 0,
    isCapitalUnlocked: false,
    createdAt: now,
    updatedAt: now,
  };

  return {
    users: [demoUser],
    wallets: [demoWallet],
    nfts: [],
    nft_trades: [],
    wallet_ledger: [],
    income_ledger: [],
    mlm_tree: [],
    bot_subscriptions: [],
    bot_activity: [],
    withdrawals: [],
    deposits: [],
    system_reserve: {
      id: "system-reserve",
      balance: 5000,
      totalMlmPaid: 0,
      totalRoyaltyPaid: 0,
      totalNftTradingPaid: 0,
      totalBotTradingPaid: 0,
      totalBotPurchaseUplinePaid: 0,
      createdAt: now,
      updatedAt: now,
    },
    admin_settings: {
      nftPriceIncreaseMinPercent: 0.25,
      nftPriceIncreaseMaxPercent: 0.35,
      autoSellDelayMinMinutes: 10,
      autoSellDelayMaxMinutes: 30,
      botProfitMinPercent: 0.25,
      botProfitMaxPercent: 0.35,
      withdrawalMinimumAmount: 10,
      withdrawalFeePercent: 10,
      vipMinimumTeamPackageAmount: 100,
      vipFirstPayoutDay: 10,
      vipSecondPayoutDay: 20,
      vipRecurringEnabled: true,
      payoutsPaused: false,
      systemStopped: false,
      globalDailyPayoutCap: 10000,
      perUserDailyPayoutCap: 1000,
      maxDailyWithdrawalAmountPerUser: 500,
      minimumTradeAmount: 10,
      updatedAt: now,
    },
    safety_logs: [],
  };
}

function normalizeState(state: NftSimState): NftSimState {
  const now = nowIso();

  state.users = state.users.map((user) => ({
    ...user,
    selfPackageAmount: user.selfPackageAmount ?? 0,
    currentVipLevel: user.currentVipLevel ?? 0,
    vipAchievedAt: user.vipAchievedAt ?? null,
    dailyBuyCount: user.dailyBuyCount ?? 0,
    dailySellCount: user.dailySellCount ?? 0,
    lastTradeResetAt: user.lastTradeResetAt ?? now,
  }));

  state.admin_settings = {
    ...state.admin_settings,
    vipMinimumTeamPackageAmount: state.admin_settings.vipMinimumTeamPackageAmount ?? 100,
    vipFirstPayoutDay: state.admin_settings.vipFirstPayoutDay ?? 10,
    vipSecondPayoutDay: state.admin_settings.vipSecondPayoutDay ?? 20,
    vipRecurringEnabled: state.admin_settings.vipRecurringEnabled ?? true,
    payoutsPaused: state.admin_settings.payoutsPaused ?? false,
    systemStopped: state.admin_settings.systemStopped ?? false,
    globalDailyPayoutCap: state.admin_settings.globalDailyPayoutCap ?? 10000,
    perUserDailyPayoutCap: state.admin_settings.perUserDailyPayoutCap ?? 1000,
    maxDailyWithdrawalAmountPerUser:
      state.admin_settings.maxDailyWithdrawalAmountPerUser ?? 500,
    minimumTradeAmount: state.admin_settings.minimumTradeAmount ?? 10,
  };

  state.system_reserve = {
    ...state.system_reserve,
    totalRoyaltyPaid: state.system_reserve.totalRoyaltyPaid ?? 0,
    totalNftTradingPaid: state.system_reserve.totalNftTradingPaid ?? 0,
  };

  state.safety_logs = state.safety_logs ?? [];

  state.income_ledger = state.income_ledger.map((entry) => ({
    ...entry,
    vipLevel: entry.vipLevel ?? null,
    payoutDate: entry.payoutDate ?? null,
  }));

  state.nfts = state.nfts.map((nft) => ({
    ...nft,
    description: nft.description ?? "",
    category: nft.category ?? "General",
  }));

  state.withdrawals = state.withdrawals.map((withdrawal) => ({
    ...withdrawal,
    approvedAt: withdrawal.approvedAt ?? null,
    payoutTxHash: withdrawal.payoutTxHash ?? null,
    payoutStatus: withdrawal.payoutStatus ?? "NOT_STARTED",
  }));
  state.deposits = state.deposits ?? [];

  state.bot_subscriptions = state.bot_subscriptions.map((subscription) => {
    const totalBuyTrades = Math.max(
      0,
      Number.isFinite(subscription.totalBuyTrades)
        ? subscription.totalBuyTrades
        : subscription.completedBuyTrades + subscription.remainingBuyTrades,
    );
    const totalSellTrades = Math.max(
      0,
      Number.isFinite(subscription.totalSellTrades)
        ? subscription.totalSellTrades
        : subscription.completedSellTrades + subscription.remainingSellTrades,
    );
    const completedBuyTrades = Math.max(0, subscription.completedBuyTrades ?? 0);
    const completedSellTrades = Math.max(0, subscription.completedSellTrades ?? 0);
    const remainingBuyTrades = Math.max(
      0,
      subscription.remainingBuyTrades ?? Math.max(totalBuyTrades - completedBuyTrades, 0),
    );
    const remainingSellTrades = Math.max(
      0,
      subscription.remainingSellTrades ?? Math.max(totalSellTrades - completedSellTrades, 0),
    );
    const isCompleted = remainingBuyTrades === 0 && remainingSellTrades === 0;

    return {
      ...subscription,
      totalBuyTrades,
      totalSellTrades,
      completedBuyTrades: Math.min(completedBuyTrades, totalBuyTrades),
      completedSellTrades: Math.min(completedSellTrades, totalSellTrades),
      remainingBuyTrades: Math.min(remainingBuyTrades, totalBuyTrades),
      remainingSellTrades: Math.min(remainingSellTrades, totalSellTrades),
      status: isCompleted ? "completed" : subscription.status ?? "active",
      completedAt: isCompleted ? subscription.completedAt ?? now : subscription.completedAt ?? null,
      updatedAt: subscription.updatedAt ?? now,
    };
  });

  return state;
}

async function writeState(state: NftSimState) {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(DATA_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export async function ensureStoreInitialized() {
  try {
    await readFile(DATA_FILE_PATH, "utf8");
  } catch {
    await writeState(createSeedState());
  }
}

export async function readState() {
  await ensureStoreInitialized();
  const raw = await readFile(DATA_FILE_PATH, "utf8");
  return normalizeState(JSON.parse(raw) as NftSimState);
}

export async function withStoreTransaction<T>(
  callback: (draft: NftSimState) => Promise<T> | T,
) {
  let result!: T;
  const runTransaction = transactionQueue.catch(() => undefined).then(async () => {
    const state = await readState();
    const draft = cloneState(state);
    result = await callback(draft);
    await writeState(draft);
  });

  transactionQueue = runTransaction.then(() => undefined, () => undefined);
  await runTransaction;
  return result;
}

export function getDefaultTradingBalance() {
  return DEFAULT_TRADING_BALANCE;
}

export function getDataFilePath() {
  return DATA_FILE_PATH;
}
