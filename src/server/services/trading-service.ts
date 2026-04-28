import { ApiError } from "@/server/api/errors";
import {
  applyPercentIncrease,
  randomDecimalInRange,
  randomIntegerInRange,
  roundAmount,
} from "@/server/nft-sim/math";
import {
  ensureStoreInitialized,
  readState,
  withStoreTransaction,
} from "@/server/services/db-state";
import {
  AdminSettingsRecord,
  BotActivityRecord,
  BotSubscriptionRecord,
  IncomeLedgerRecord,
  MlmTreeRecord,
  NftRecord,
  NftSimState,
  NftTradeRecord,
  SafetyLogRecord,
  SystemReserveRecord,
  UserRecord,
  WalletLedgerRecord,
  WalletRecord,
  WithdrawalRecord,
} from "@/server/nft-sim/types";
import { verifyUsdtDepositTransaction } from "@/server/services/usdt-payment";

const MLM_LEVEL_PERCENTAGES = [20, 15, 10, 8, 5] as const;
const VIP_LEVELS = [
  { level: 1, selfPackageAmount: 100, payoutAmount: 20 },
  { level: 2, selfPackageAmount: 200, payoutAmount: 50 },
  { level: 3, selfPackageAmount: 400, payoutAmount: 100 },
  { level: 4, selfPackageAmount: 700, payoutAmount: 200 },
  { level: 5, selfPackageAmount: 1000, payoutAmount: 200 },
  { level: 6, selfPackageAmount: 1300, payoutAmount: 400 },
  { level: 7, selfPackageAmount: 1600, payoutAmount: 800 },
  { level: 8, selfPackageAmount: 1900, payoutAmount: 1600 },
  { level: 9, selfPackageAmount: 2200, payoutAmount: 3200 },
  { level: 10, selfPackageAmount: 5000, payoutAmount: 6400 },
] as const;

const BOT_PLANS = {
  bot_10: {
    planId: "bot_10",
    planName: "Gainix Bot $10",
    price: 10,
    buyTrades: 240,
    sellTrades: 240,
  },
  bot_20: {
    planId: "bot_20",
    planName: "Gainix Bot $20",
    price: 20,
    buyTrades: 500,
    sellTrades: 500,
  },
  bot_50: {
    planId: "bot_50",
    planName: "Gainix Bot $50",
    price: 50,
    buyTrades: 1000,
    sellTrades: 1000,
  },
  bot_100: {
    planId: "bot_100",
    planName: "Gainix Bot $100",
    price: 100,
    buyTrades: 2000,
    sellTrades: 2000,
  },
  bot_500: {
    planId: "bot_500",
    planName: "Gainix Bot $500",
    price: 500,
    buyTrades: 10000,
    sellTrades: 10000,
  },
} as const;

const BASE_DAILY_TRADE_LIMIT = 6;
const TRADE_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

type BotPlanId = keyof typeof BOT_PLANS;
type BotPlan = (typeof BOT_PLANS)[BotPlanId];

interface UserSelector {
  userId?: string;
  walletAddress?: string;
}

interface RegisterUserInput {
  walletAddress: string;
  sponsorWalletAddress?: string;
}

interface DepositInput extends UserSelector {
  amount: number;
}

interface VerifyDepositInput {
  walletAddress: string;
  txHash: string;
  expectedAmount: number;
}

interface WithdrawInput extends UserSelector {
  amount: number;
}

interface BuyNftInput extends UserSelector {
  nftId: string;
  source?: "manual" | "bot";
  botSubscriptionId?: string | null;
}

interface ListNftInput extends UserSelector {
  nftId: string;
  debugAutoSellInMinutes?: number;
}

interface TransferCapitalInput extends UserSelector {}

interface BuyBotInput extends UserSelector {
  planId: BotPlanId;
}

interface UpdateAdminSettingsInput {
  nftPriceIncreaseMinPercent?: number;
  nftPriceIncreaseMaxPercent?: number;
  autoSellDelayMinMinutes?: number;
  autoSellDelayMaxMinutes?: number;
  botProfitMinPercent?: number;
  botProfitMaxPercent?: number;
  withdrawalMinimumAmount?: number;
  withdrawalFeePercent?: number;
  vipFirstPayoutDay?: number;
  vipSecondPayoutDay?: number;
  vipRecurringEnabled?: boolean;
  payoutsPaused?: boolean;
  systemStopped?: boolean;
  globalDailyPayoutCap?: number;
  perUserDailyPayoutCap?: number;
  maxDailyWithdrawalAmountPerUser?: number;
  minimumTradeAmount?: number;
}

interface UpdateReserveInput {
  balance: number;
}

interface ApproveWithdrawalInput {
  withdrawalId: string;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

function validatePositiveAmount(amount: number, label: string) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, `${label} must be greater than 0.`);
  }
}

function validateNonNegativeAmount(amount: number, label: string) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, `${label} must be 0 or greater.`);
  }
}

function requireNft(state: NftSimState, nftId: string) {
  const nft = state.nfts.find((item) => item.id === nftId);
  if (!nft) {
    throw new ApiError(404, "NFT not found.");
  }

  return nft;
}

function requireWallet(state: NftSimState, userId: string) {
  const wallet = state.wallets.find((item) => item.userId === userId);
  if (!wallet) {
    throw new ApiError(404, "Wallet not found for user.");
  }

  return wallet;
}

function requireUser(state: NftSimState, selector: UserSelector) {
  if (selector.userId) {
    const user = state.users.find((item) => item.id === selector.userId);
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    return { user, wallet: requireWallet(state, user.id) };
  }

  if (!selector.walletAddress) {
    throw new ApiError(400, "Provide either userId or walletAddress.");
  }

  const walletAddress = normalizeWalletAddress(selector.walletAddress);
  const user = state.users.find(
    (item) => normalizeWalletAddress(item.walletAddress) === walletAddress,
  );

  if (!user) {
    throw new ApiError(404, "User not registered.");
  }

  return { user, wallet: requireWallet(state, user.id) };
}

function createUserWallet(now: string, userId: string): WalletRecord {
  return {
    id: makeId("wallet"),
    userId,
    tradingWallet: 0,
    withdrawalWallet: 0,
    totalDeposited: 0,
    buyCount: 0,
    sellCount: 0,
    isCapitalUnlocked: false,
    createdAt: now,
    updatedAt: now,
  };
}

function vipTradeBonus(currentVipLevel: number) {
  if (currentVipLevel >= 2) {
    return 4;
  }

  if (currentVipLevel === 1) {
    return 2;
  }

  return 0;
}

function tradeLimitsForUser(user: UserRecord) {
  const bonusTrades = vipTradeBonus(user.currentVipLevel);

  return {
    dailyBuyLimit: BASE_DAILY_TRADE_LIMIT + bonusTrades,
    dailySellLimit: BASE_DAILY_TRADE_LIMIT + bonusTrades,
    bonusTrades,
  };
}

function resetDailyTradeCountsIfDue(user: UserRecord, currentTime = new Date()) {
  const lastReset = new Date(user.lastTradeResetAt);
  if (
    !Number.isFinite(lastReset.getTime()) ||
    currentTime.getTime() - lastReset.getTime() >= TRADE_RESET_INTERVAL_MS
  ) {
    user.dailyBuyCount = 0;
    user.dailySellCount = 0;
    user.lastTradeResetAt = currentTime.toISOString();
  }
}

function dailyTradeSnapshot(user: UserRecord) {
  resetDailyTradeCountsIfDue(user);
  const limits = tradeLimitsForUser(user);

  return {
    dailyBuyCount: user.dailyBuyCount,
    dailySellCount: user.dailySellCount,
    ...limits,
    currentVipLevel: user.currentVipLevel,
  };
}

function canUseDailyTrade(user: UserRecord, side: "buy" | "sell") {
  resetDailyTradeCountsIfDue(user);
  const limits = tradeLimitsForUser(user);
  const currentCount = side === "buy" ? user.dailyBuyCount : user.dailySellCount;
  const limit = side === "buy" ? limits.dailyBuyLimit : limits.dailySellLimit;

  return currentCount < limit;
}

function assertDailyTradeLimit(user: UserRecord, side: "buy" | "sell") {
  if (!canUseDailyTrade(user, side)) {
    throw new ApiError(429, "Daily trading limit reached");
  }
}

function refreshCapitalUnlock(user: UserRecord, wallet?: WalletRecord) {
  const unlocked = user.totalBuyCount >= 300 && user.totalSellCount >= 300;
  user.capitalUnlocked = unlocked;

  if (unlocked && !user.capitalUnlockedAt) {
    user.capitalUnlockedAt = nowIso();
  }

  if (wallet) {
    wallet.buyCount = user.totalBuyCount;
    wallet.sellCount = user.totalSellCount;
    wallet.isCapitalUnlocked = unlocked;
  }
}

function capitalTransferProgress(user: UserRecord) {
  const requiredBuyCount = 300;
  const requiredSellCount = 300;
  const buyCount = Math.min(user.totalBuyCount, requiredBuyCount);
  const sellCount = Math.min(user.totalSellCount, requiredSellCount);

  return {
    buyCount,
    sellCount,
    requiredBuyCount,
    requiredSellCount,
    remainingBuyCount: Math.max(requiredBuyCount - buyCount, 0),
    remainingSellCount: Math.max(requiredSellCount - sellCount, 0),
  };
}

function pushWalletLedger(
  state: NftSimState,
  payload: Omit<WalletLedgerRecord, "id" | "createdAt">,
) {
  state.wallet_ledger.push({
    id: makeId("wallet_ledger"),
    createdAt: nowIso(),
    ...payload,
  });
}

function pushIncomeLedger(
  state: NftSimState,
  payload: Omit<IncomeLedgerRecord, "id" | "createdAt" | "vipLevel" | "payoutDate"> &
    Partial<Pick<IncomeLedgerRecord, "vipLevel" | "payoutDate">>,
) {
  state.income_ledger.push({
    id: makeId("income"),
    createdAt: nowIso(),
    ...payload,
    vipLevel: payload.vipLevel ?? null,
    payoutDate: payload.payoutDate ?? null,
  });
}

function pushBotActivity(
  state: NftSimState,
  payload: Omit<BotActivityRecord, "id" | "createdAt">,
) {
  state.bot_activity.push({
    id: makeId("bot_activity"),
    createdAt: nowIso(),
    ...payload,
  });
}

function pushSafetyLog(
  state: NftSimState,
  payload: Omit<SafetyLogRecord, "id" | "createdAt">,
) {
  state.safety_logs.push({
    id: makeId("safety"),
    createdAt: nowIso(),
    ...payload,
    metadata: payload.metadata ?? {},
  });
}

function directReferralCount(state: NftSimState, userId: string) {
  return state.mlm_tree.filter(
    (item) => item.ancestorUserId === userId && item.level === 1,
  ).length;
}

function unlockedLevels(state: NftSimState, userId: string) {
  return Math.min(5, directReferralCount(state, userId));
}

function sponsorUserForUser(state: NftSimState, userId: string) {
  const directSponsor = state.mlm_tree.find(
    (item) => item.userId === userId && item.level === 1,
  );

  if (!directSponsor) {
    return null;
  }

  return state.users.find((item) => item.id === directSponsor.ancestorUserId) ?? null;
}

function createMlmRelations(
  state: NftSimState,
  userId: string,
  sponsorUserId: string | null,
  createdAt: string,
) {
  if (!sponsorUserId) {
    return;
  }

  if (sponsorUserId === userId) {
    throw new ApiError(409, "Self-referral is not allowed.");
  }

  const circularRelation = state.mlm_tree.some(
    (item) => item.userId === sponsorUserId && item.ancestorUserId === userId,
  );
  if (circularRelation) {
    throw new ApiError(409, "Circular referral chains are not allowed.");
  }

  const relations: MlmTreeRecord[] = [
    {
      id: makeId("mlm"),
      userId,
      ancestorUserId: sponsorUserId,
      level: 1,
      createdAt,
    },
  ];

  const sponsorAncestors = state.mlm_tree
    .filter((item) => item.userId === sponsorUserId)
    .sort((a, b) => a.level - b.level)
    .slice(0, 4);

  for (const ancestor of sponsorAncestors) {
    relations.push({
      id: makeId("mlm"),
      userId,
      ancestorUserId: ancestor.ancestorUserId,
      level: ancestor.level + 1,
      createdAt,
    });
  }

  state.mlm_tree.push(...relations);
}

function requireActiveTrade(state: NftSimState, nftId: string, userId: string) {
  const trade = [...state.nft_trades]
    .reverse()
    .find(
      (item) =>
        item.nftId === nftId &&
        item.userId === userId &&
        item.status !== "auto_sold",
    );

  if (!trade) {
    throw new ApiError(404, "Trade record not found for this NFT.");
  }

  return trade;
}

function activeTradeForBotSubscription(state: NftSimState, botSubscriptionId: string) {
  return state.nft_trades.find(
    (item) =>
      item.botSubscriptionId === botSubscriptionId &&
      item.status !== "auto_sold",
  );
}

function toPublicTrade(state: NftSimState, trade: NftTradeRecord) {
  const nft = state.nfts.find((item) => item.id === trade.nftId) ?? null;
  const user = state.users.find((item) => item.id === trade.userId) ?? null;

  return {
    ...trade,
    nft,
    user,
  };
}

function toPublicNft(state: NftSimState, nft: NftRecord) {
  const owner = nft.ownerUserId
    ? state.users.find((item) => item.id === nft.ownerUserId) ?? null
    : null;

  return {
    ...nft,
    owner,
  };
}

function toPublicWallet(wallet: WalletRecord, user?: UserRecord) {
  const totalBuyCount = user?.totalBuyCount ?? wallet.buyCount;
  const totalSellCount = user?.totalSellCount ?? wallet.sellCount;
  const capitalUnlocked = user?.capitalUnlocked ?? wallet.isCapitalUnlocked;

  return {
    tradingWallet: wallet.tradingWallet,
    withdrawalWallet: wallet.withdrawalWallet,
    totalDeposited: wallet.totalDeposited,
    buyCount: totalBuyCount,
    sellCount: totalSellCount,
    totalBuyCount,
    totalSellCount,
    dailyBuyCount: user?.dailyBuyCount ?? 0,
    dailySellCount: user?.dailySellCount ?? 0,
    lastTradeResetAt: user?.lastTradeResetAt ?? null,
    tradeLimits: user
      ? dailyTradeSnapshot(user)
      : {
          dailyBuyCount: 0,
          dailySellCount: 0,
          dailyBuyLimit: BASE_DAILY_TRADE_LIMIT,
          dailySellLimit: BASE_DAILY_TRADE_LIMIT,
          bonusTrades: 0,
          currentVipLevel: 0,
        },
    isCapitalUnlocked: capitalUnlocked,
    capitalUnlocked,
    capitalUnlockedAt: user?.capitalUnlockedAt ?? null,
    capitalTransferredAt: user?.capitalTransferredAt ?? null,
    updatedAt: wallet.updatedAt,
  };
}

function toPublicReserve(reserve: SystemReserveRecord) {
  return {
    balance: reserve.balance,
    totalMlmPaid: reserve.totalMlmPaid,
    totalRoyaltyPaid: reserve.totalRoyaltyPaid,
    totalNftTradingPaid: reserve.totalNftTradingPaid,
    totalBotTradingPaid: reserve.totalBotTradingPaid,
    totalBotPurchaseUplinePaid: reserve.totalBotPurchaseUplinePaid,
    updatedAt: reserve.updatedAt,
  };
}

function toPublicSettings(settings: AdminSettingsRecord) {
  return {
    nftPriceIncreaseMinPercent: settings.nftPriceIncreaseMinPercent,
    nftPriceIncreaseMaxPercent: settings.nftPriceIncreaseMaxPercent,
    autoSellDelayMinMinutes: settings.autoSellDelayMinMinutes,
    autoSellDelayMaxMinutes: settings.autoSellDelayMaxMinutes,
    botProfitMinPercent: settings.botProfitMinPercent,
    botProfitMaxPercent: settings.botProfitMaxPercent,
    withdrawalMinimumAmount: settings.withdrawalMinimumAmount,
    withdrawalFeePercent: settings.withdrawalFeePercent,
    vipFirstPayoutDay: settings.vipFirstPayoutDay,
    vipSecondPayoutDay: settings.vipSecondPayoutDay,
    vipRecurringEnabled: settings.vipRecurringEnabled,
    payoutsPaused: settings.payoutsPaused,
    systemStopped: settings.systemStopped,
    globalDailyPayoutCap: settings.globalDailyPayoutCap,
    perUserDailyPayoutCap: settings.perUserDailyPayoutCap,
    maxDailyWithdrawalAmountPerUser: settings.maxDailyWithdrawalAmountPerUser,
    minimumTradeAmount: settings.minimumTradeAmount,
    updatedAt: settings.updatedAt,
  };
}

function toPublicBotSubscription(subscription: BotSubscriptionRecord) {
  const totalCycles = Math.min(subscription.totalBuyTrades, subscription.totalSellTrades);
  const completedCycles = Math.min(
    subscription.completedBuyTrades,
    subscription.completedSellTrades,
  );

  return {
    ...subscription,
    totalCycles,
    completedCycles,
  };
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isMonthEnd(date: Date) {
  return date.getDate() === endOfMonth(date).getDate();
}

function sumAmounts(records: IncomeLedgerRecord[]) {
  return roundAmount(records.reduce((total, record) => total + record.amount, 0));
}

function summarizeIncome(records: IncomeLedgerRecord[], todayStart: Date, weeklyStart: Date, monthStart: Date) {
  return {
    total: sumAmounts(records),
    today: sumAmounts(records.filter((item) => new Date(item.createdAt) >= todayStart)),
    weekly: sumAmounts(records.filter((item) => new Date(item.createdAt) >= weeklyStart)),
    monthly: sumAmounts(records.filter((item) => new Date(item.createdAt) >= monthStart)),
  };
}

function vipConfig(level: number) {
  return VIP_LEVELS.find((item) => item.level === level) ?? null;
}

function qualifiedPackageUsersAtLevel(
  state: NftSimState,
  ancestorUserId: string,
  level: number,
  minimumPackageAmount: number,
) {
  const qualifiedUserIds = new Set(
    state.users
      .filter((user) => user.selfPackageAmount >= minimumPackageAmount)
      .map((user) => user.id),
  );

  return state.mlm_tree.filter(
    (item) =>
      item.ancestorUserId === ancestorUserId &&
      item.level === level &&
      qualifiedUserIds.has(item.userId),
  ).length;
}

function directUsersWithVipLevel(
  state: NftSimState,
  ancestorUserId: string,
  minimumVipLevel: number,
) {
  const directIds = state.mlm_tree
    .filter((item) => item.ancestorUserId === ancestorUserId && item.level === 1)
    .map((item) => item.userId);

  return state.users.filter(
    (user) => directIds.includes(user.id) && user.currentVipLevel >= minimumVipLevel,
  ).length;
}

function calculateImmediateVipLevel(state: NftSimState, userId: string) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    return 0;
  }

  const minimumPackageAmount = state.admin_settings.vipMinimumTeamPackageAmount;
  let level = 0;

  if (
    user.selfPackageAmount >= 100 &&
    qualifiedPackageUsersAtLevel(state, user.id, 1, minimumPackageAmount) >= 5 &&
    qualifiedPackageUsersAtLevel(state, user.id, 2, minimumPackageAmount) >= 10
  ) {
    level = 1;
  }

  for (const item of VIP_LEVELS.slice(1)) {
    if (user.selfPackageAmount < item.selfPackageAmount) {
      break;
    }

    if (directUsersWithVipLevel(state, user.id, item.level - 1) >= 2) {
      level = item.level;
      continue;
    }

    break;
  }

  return level;
}

function refreshVipLevels(state: NftSimState) {
  const now = nowIso();

  for (const target of VIP_LEVELS) {
    for (const user of state.users) {
      const computedLevel = calculateImmediateVipLevel(state, user.id);
      const nextLevel = Math.max(user.currentVipLevel, computedLevel);

      if (nextLevel > user.currentVipLevel) {
        user.currentVipLevel = nextLevel;
        user.vipAchievedAt = now;
      }
    }

    if (target.level === VIP_LEVELS[VIP_LEVELS.length - 1].level) {
      break;
    }
  }
}

function isRoyaltyPayoutDate(state: NftSimState, date: Date) {
  if (
    !state.admin_settings.vipRecurringEnabled ||
    state.admin_settings.payoutsPaused ||
    state.admin_settings.systemStopped
  ) {
    return false;
  }

  const day = date.getDate();
  return (
    day === state.admin_settings.vipFirstPayoutDay ||
    day === state.admin_settings.vipSecondPayoutDay ||
    isMonthEnd(date)
  );
}

function processRoyaltyPayouts(state: NftSimState, currentDate: Date) {
  if (!isRoyaltyPayoutDate(state, currentDate)) {
    return [];
  }

  const payoutDate = startOfDay(currentDate).toISOString();
  const payouts: Array<{ userId: string; vipLevel: number; amount: number }> = [];

  for (const user of state.users) {
    if (user.currentVipLevel <= 0) {
      continue;
    }

    const currentVipLevel = user.currentVipLevel;
    const config = vipConfig(currentVipLevel);
    if (!config) {
      continue;
    }

    const alreadyPaid = state.income_ledger.some(
      (item) =>
        item.userId === user.id &&
        item.type === "ROYALTY_INCOME" &&
        item.vipLevel === currentVipLevel &&
        item.payoutDate === payoutDate,
    );

    if (alreadyPaid) {
      continue;
    }

    if (
      !reserveFundedAmount(state, config.payoutAmount, "totalRoyaltyPaid", {
        userId: user.id,
        payoutType: "ROYALTY_INCOME",
        referenceId: `royalty_vip_${currentVipLevel}_${payoutDate}`,
      })
    ) {
      continue;
    }

    const wallet = requireWallet(state, user.id);
    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + config.payoutAmount);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: user.id,
      type: "ROYALTY_INCOME",
      amount: config.payoutAmount,
      referenceId: `royalty_vip_${currentVipLevel}_${payoutDate}`,
      metadata: {
        vipLevel: currentVipLevel,
        payoutDate,
        royaltyIncome: true,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    pushIncomeLedger(state, {
      userId: user.id,
      type: "ROYALTY_INCOME",
      amount: config.payoutAmount,
      sourceTradeId: `royalty_vip_${currentVipLevel}_${payoutDate}`,
      level: null,
      sourceUserId: null,
      vipLevel: currentVipLevel,
      payoutDate,
    });

    payouts.push({
      userId: user.id,
      vipLevel: currentVipLevel,
      amount: config.payoutAmount,
    });
  }

  return payouts;
}

function royaltyProgress(state: NftSimState, userId: string) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  if (user.currentVipLevel >= 10) {
    const currentConfig = vipConfig(user.currentVipLevel);

    return {
      currentVipLevel: user.currentVipLevel,
      nextVipLevel: null,
      payoutAmount: currentConfig?.payoutAmount ?? 0,
      currentRequirementProgress: null,
    };
  }

  const nextVipLevel = user.currentVipLevel + 1;
  const config = vipConfig(nextVipLevel);
  const minimumPackageAmount = state.admin_settings.vipMinimumTeamPackageAmount;

  if (!config) {
    return {
      currentVipLevel: user.currentVipLevel,
      nextVipLevel: null,
      payoutAmount: 0,
      currentRequirementProgress: null,
    };
  }

  if (nextVipLevel === 1) {
    return {
      currentVipLevel: user.currentVipLevel,
      nextVipLevel,
      payoutAmount: config.payoutAmount,
      currentRequirementProgress: {
        selfPackageAmount: user.selfPackageAmount,
        selfPackageRequired: config.selfPackageAmount,
        qualifiedLevel1Users: qualifiedPackageUsersAtLevel(state, user.id, 1, minimumPackageAmount),
        qualifiedLevel1Required: 5,
        qualifiedLevel2Users: qualifiedPackageUsersAtLevel(state, user.id, 2, minimumPackageAmount),
        qualifiedLevel2Required: 10,
        minimumTeamPackageAmount: minimumPackageAmount,
      },
    };
  }

  return {
    currentVipLevel: user.currentVipLevel,
    nextVipLevel,
    payoutAmount: config.payoutAmount,
    currentRequirementProgress: {
      selfPackageAmount: user.selfPackageAmount,
      selfPackageRequired: config.selfPackageAmount,
      directQualifiedUsers: directUsersWithVipLevel(state, user.id, nextVipLevel - 1),
      directQualifiedRequired: 2,
      previousVipLevelRequired: nextVipLevel - 1,
    },
  };
}

function randomConfiguredPercent(min: number, max: number) {
  return randomDecimalInRange(min, max);
}

function priceAfterMarketBuy(state: NftSimState, currentPrice: number) {
  const percent = randomConfiguredPercent(
    state.admin_settings.nftPriceIncreaseMinPercent,
    state.admin_settings.nftPriceIncreaseMaxPercent,
  );

  return {
    percent,
    nextPrice: applyPercentIncrease(currentPrice, percent),
  };
}

function randomAutoSellDelay(state: NftSimState) {
  return randomIntegerInRange(
    state.admin_settings.autoSellDelayMinMinutes,
    state.admin_settings.autoSellDelayMaxMinutes,
  );
}

function randomBotProfitPercent(state: NftSimState) {
  return randomConfiguredPercent(
    state.admin_settings.botProfitMinPercent,
    state.admin_settings.botProfitMaxPercent,
  );
}

function dailyPayoutTotal(state: NftSimState, dayStart: Date, userId?: string) {
  const dayEnd = endOfDay(dayStart);
  const inWindow = (isoDate: string) => {
    const value = new Date(isoDate);
    return value >= dayStart && value < dayEnd;
  };

  const incomeTotal = state.income_ledger
    .filter((item) => inWindow(item.createdAt) && (!userId || item.userId === userId))
    .reduce((total, item) => total + item.amount, 0);
  const withdrawalTotal = state.withdrawals
    .filter((item) => {
      const payoutDate = item.approvedAt ?? item.createdAt;
      return (
        isApprovedWithdrawalStatus(item.status) &&
        inWindow(payoutDate) &&
        (!userId || item.userId === userId)
      );
    })
    .reduce((total, item) => total + item.netAmount, 0);

  return roundAmount(incomeTotal + withdrawalTotal);
}

function isApprovedWithdrawalStatus(status: WithdrawalRecord["status"]) {
  return status === "approved" || status === "approved_pending_tx";
}

function checkPayoutSafety(
  state: NftSimState,
  payload: {
    userId: string;
    amount: number;
    payoutType: string;
    referenceId: string;
  },
) {
  const amount = roundAmount(payload.amount);
  const block = (reason: string, metadata: SafetyLogRecord["metadata"] = {}) => {
    pushSafetyLog(state, {
      eventType: "BLOCKED_PAYOUT",
      userId: payload.userId,
      amount,
      reason,
      metadata: {
        payoutType: payload.payoutType,
        referenceId: payload.referenceId,
        reserveBalance: state.system_reserve.balance,
        ...metadata,
      },
    });
    return false;
  };

  if (amount <= 0) {
    return false;
  }

  if (state.admin_settings.systemStopped) {
    return block("System emergency stop is active.");
  }

  if (state.system_reserve.balance < amount) {
    return block("Insufficient system reserve.", {
      requiredReserve: amount,
      availableReserve: state.system_reserve.balance,
    });
  }

  const dayStart = startOfDay(new Date());
  const globalPaidToday = dailyPayoutTotal(state, dayStart);
  if (roundAmount(globalPaidToday + amount) > state.admin_settings.globalDailyPayoutCap) {
    return block("Global daily payout cap exceeded.", {
      paidToday: globalPaidToday,
      cap: state.admin_settings.globalDailyPayoutCap,
    });
  }

  const userPaidToday = dailyPayoutTotal(state, dayStart, payload.userId);
  if (roundAmount(userPaidToday + amount) > state.admin_settings.perUserDailyPayoutCap) {
    return block("Per-user daily payout cap exceeded.", {
      paidToday: userPaidToday,
      cap: state.admin_settings.perUserDailyPayoutCap,
    });
  }

  return true;
}

function reserveFundedAmount(
  state: NftSimState,
  requestedAmount: number,
  reserveCounter:
    | "totalMlmPaid"
    | "totalRoyaltyPaid"
    | "totalNftTradingPaid"
    | "totalBotTradingPaid"
    | "totalBotPurchaseUplinePaid",
  payload: {
    userId: string;
    payoutType: string;
    referenceId: string;
  },
) {
  const amount = roundAmount(requestedAmount);
  if (!checkPayoutSafety(state, { ...payload, amount })) {
    return 0;
  }

  state.system_reserve.balance = roundAmount(state.system_reserve.balance - amount);
  state.system_reserve[reserveCounter] = roundAmount(
    state.system_reserve[reserveCounter] + amount,
  );
  state.system_reserve.updatedAt = nowIso();

  return amount;
}

function markBotSubscriptionCompleteIfDone(
  state: NftSimState,
  subscription: BotSubscriptionRecord,
) {
  if (subscription.remainingBuyTrades > 0 || subscription.remainingSellTrades > 0) {
    return;
  }

  const hasOpenTrade = Boolean(activeTradeForBotSubscription(state, subscription.id));
  if (!hasOpenTrade) {
    subscription.status = "completed";
    subscription.completedAt = nowIso();
    subscription.updatedAt = nowIso();
  }
}

function botPlanFromAmount(amount: number): BotPlan | null {
  return Object.values(BOT_PLANS).find((plan) => plan.price === amount) ?? null;
}

function botHasRemainingCapacity(subscription: BotSubscriptionRecord) {
  return subscription.remainingBuyTrades > 0 && subscription.remainingSellTrades > 0;
}

function botCanStartNextCycle(
  state: NftSimState,
  subscription: BotSubscriptionRecord,
  wallet: WalletRecord,
) {
  if (subscription.status !== "active" || !botHasRemainingCapacity(subscription)) {
    return false;
  }

  if (activeTradeForBotSubscription(state, subscription.id)) {
    return false;
  }

  return wallet.tradingWallet > 0;
}

function buyNft(
  state: NftSimState,
  user: UserRecord,
  wallet: WalletRecord,
  input: BuyNftInput,
) {
  const nft = requireNft(state, input.nftId);
  assertDailyTradeLimit(user, "buy");

  if (nft.status !== "marketplace") {
    throw new ApiError(409, "NFT is not available in the marketplace.");
  }

  if (wallet.tradingWallet < nft.currentPrice) {
    throw new ApiError(409, "Insufficient trading wallet balance.");
  }

  if (input.source === "bot" && input.botSubscriptionId) {
    const subscription = state.bot_subscriptions.find(
      (item) => item.id === input.botSubscriptionId,
    );
    if (!subscription || subscription.status !== "active" || subscription.remainingBuyTrades <= 0) {
      throw new ApiError(409, "Bot buy capacity exhausted.");
    }
  }

  const now = nowIso();
  const buyPrice = roundAmount(nft.currentPrice);
  const priceUpdate = priceAfterMarketBuy(state, buyPrice);

  wallet.tradingWallet = roundAmount(wallet.tradingWallet - buyPrice);
  user.totalBuyCount += 1;
  user.dailyBuyCount += 1;
  wallet.updatedAt = now;
  refreshCapitalUnlock(user, wallet);

  pushWalletLedger(state, {
    userId: user.id,
    type: "NFT_BUY_DEBIT",
    amount: buyPrice,
    referenceId: nft.id,
    metadata: {
      nftId: nft.id,
      tradeSource: input.source ?? "manual",
      buyCount: user.totalBuyCount,
      dailyBuyCount: user.dailyBuyCount,
      dailyBuyLimit: tradeLimitsForUser(user).dailyBuyLimit,
      tradingWalletAfter: wallet.tradingWallet,
    },
  });

  const trade: NftTradeRecord = {
    id: makeId("trade"),
    nftId: nft.id,
    userId: user.id,
    buyPrice,
    sellPrice: null,
    profit: null,
    status: "bought",
    listedAt: null,
    autoSellAt: null,
    soldAt: null,
    saleJobId: null,
    source: input.source ?? "manual",
    botSubscriptionId: input.botSubscriptionId ?? null,
    createdAt: now,
  };

  nft.ownerUserId = user.id;
  nft.status = "owned";
  nft.lastBuyPrice = buyPrice;
  nft.totalTrades += 1;
  nft.currentPrice = priceUpdate.nextPrice;
  nft.lastPriceIncreasePercent = priceUpdate.percent;
  nft.updatedAt = now;

  state.nft_trades.push(trade);

  return {
    nft,
    trade,
    wallet,
  };
}

function listNft(
  state: NftSimState,
  nft: NftRecord,
  trade: NftTradeRecord,
  debugAutoSellInMinutes?: number,
) {
  const user = state.users.find((item) => item.id === trade.userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  assertDailyTradeLimit(user, "sell");

  if (trade.status === "listed") {
    throw new ApiError(409, "NFT is already listed.");
  }

  const maxAllowedDebugDelay = state.admin_settings.autoSellDelayMaxMinutes;
  const now = new Date();
  const autoSellDelayMinutes =
    process.env.NODE_ENV !== "production" &&
    typeof debugAutoSellInMinutes === "number" &&
    debugAutoSellInMinutes >= 0 &&
    debugAutoSellInMinutes <= maxAllowedDebugDelay
      ? debugAutoSellInMinutes
      : randomAutoSellDelay(state);

  trade.status = "listed";
  trade.listedAt = now.toISOString();
  trade.autoSellAt = new Date(now.getTime() + autoSellDelayMinutes * 60_000).toISOString();
  trade.saleJobId = makeId("sale_job");

  nft.status = "listed";
  nft.updatedAt = now.toISOString();

  return autoSellDelayMinutes;
}

function recordBotListActivity(
  state: NftSimState,
  userId: string,
  botSubscriptionId: string,
  nftId: string,
  amount: number,
) {
  pushBotActivity(state, {
    userId,
    botSubscriptionId,
    nftId,
    action: "AUTO_LIST",
    amount,
    profit: null,
    status: "WAITING",
  });
}

function distributeLevelIncome(
  state: NftSimState,
  sourceUserId: string,
  tradeId: string,
  profit: number,
) {
  if (profit <= 0) {
    return [];
  }

  const uplines = state.mlm_tree
    .filter((item) => item.userId === sourceUserId)
    .sort((a, b) => a.level - b.level)
    .slice(0, 5);
  const distributions: Array<{
    level: number;
    userId: string;
    amount: number;
  }> = [];

  for (const relation of uplines) {
    const eligibleLevels = unlockedLevels(state, relation.ancestorUserId);
    if (eligibleLevels < relation.level) {
      continue;
    }

    const requestedAmount = roundAmount(
      profit * (MLM_LEVEL_PERCENTAGES[relation.level - 1] / 100),
    );
    const amount = reserveFundedAmount(state, requestedAmount, "totalMlmPaid", {
      userId: relation.ancestorUserId,
      payoutType: "LEVEL_INCOME",
      referenceId: tradeId,
    });
    if (amount <= 0) {
      continue;
    }

    const wallet = requireWallet(state, relation.ancestorUserId);
    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + amount);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: relation.ancestorUserId,
      type: "LEVEL_INCOME",
      amount,
      referenceId: tradeId,
      metadata: {
        level: relation.level,
        sourceUserId,
        reserveBalanceAfter: state.system_reserve.balance,
      },
    });

    pushIncomeLedger(state, {
      userId: relation.ancestorUserId,
      type: "LEVEL_INCOME",
      amount,
      sourceTradeId: tradeId,
      level: relation.level,
      sourceUserId,
    });

    distributions.push({
      level: relation.level,
      userId: relation.ancestorUserId,
      amount,
    });
  }

  return distributions;
}

function settleAutoSell(state: NftSimState, trade: NftTradeRecord) {
  if (trade.status !== "listed" || !trade.autoSellAt || !trade.saleJobId || trade.soldAt) {
    return null;
  }

  const nft = state.nfts.find((item) => item.id === trade.nftId);
  const wallet = state.wallets.find((item) => item.userId === trade.userId);
  const user = state.users.find((item) => item.id === trade.userId);

  if (!nft || !wallet || !user || nft.status !== "listed") {
    return null;
  }

  if (!canUseDailyTrade(user, "sell")) {
    if (trade.botSubscriptionId) {
      pushBotActivity(state, {
        userId: trade.userId,
        botSubscriptionId: trade.botSubscriptionId,
        nftId: trade.nftId,
        action: "AUTO_SELL",
        amount: 0,
        profit: null,
        status: "SKIPPED",
      });
    }
    pushSafetyLog(state, {
      eventType: "TRADE_LIMIT_REACHED",
      userId: trade.userId,
      amount: null,
      reason: "Skipped: daily limit reached",
      metadata: {
        tradeId: trade.id,
        nftId: trade.nftId,
        tradeSource: trade.source,
        side: "sell",
        dailySellCount: user.dailySellCount,
        dailySellLimit: tradeLimitsForUser(user).dailySellLimit,
      },
    });
    return null;
  }

  const now = nowIso();
  const principalReturn = roundAmount(trade.buyPrice);
  const isBotTrade = trade.source === "bot";
  const sellPrice = isBotTrade
    ? applyPercentIncrease(trade.buyPrice, randomBotProfitPercent(state))
    : roundAmount(nft.currentPrice);
  const rawProfit = roundAmount(Math.max(sellPrice - trade.buyPrice, 0));
  const profit = isBotTrade
    ? reserveFundedAmount(state, rawProfit, "totalBotTradingPaid", {
        userId: trade.userId,
        payoutType: "BOT_TRADING_INCOME",
        referenceId: trade.id,
      })
    : reserveFundedAmount(state, rawProfit, "totalNftTradingPaid", {
        userId: trade.userId,
        payoutType: "NFT_TRADING_INCOME",
        referenceId: trade.id,
      });
  const relistUpdate = priceAfterMarketBuy(state, sellPrice);

  wallet.tradingWallet = roundAmount(wallet.tradingWallet + principalReturn);
  wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + profit);
  user.totalSellCount += 1;
  user.dailySellCount += 1;
  wallet.updatedAt = now;
  refreshCapitalUnlock(user, wallet);

  pushWalletLedger(state, {
    userId: trade.userId,
    type: "NFT_SELL_PRINCIPAL_RETURN",
    amount: principalReturn,
    referenceId: trade.saleJobId,
    metadata: {
      nftId: trade.nftId,
      tradeId: trade.id,
      sellCount: user.totalSellCount,
      dailySellCount: user.dailySellCount,
      dailySellLimit: tradeLimitsForUser(user).dailySellLimit,
      tradingWalletAfter: wallet.tradingWallet,
      tradeSource: trade.source,
    },
  });

  if (profit > 0) {
    pushWalletLedger(state, {
      userId: trade.userId,
      type: isBotTrade ? "BOT_TRADING_PROFIT" : "NFT_TRADING_PROFIT",
      amount: profit,
      referenceId: trade.saleJobId,
      metadata: {
        nftId: trade.nftId,
        tradeId: trade.id,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    pushIncomeLedger(state, {
      userId: trade.userId,
      type: isBotTrade ? "BOT_TRADING_INCOME" : "NFT_TRADING_INCOME",
      amount: profit,
      sourceTradeId: trade.id,
      level: null,
      sourceUserId: null,
    });
  }

  const levelDistributions = distributeLevelIncome(state, trade.userId, trade.id, profit);

  trade.status = "auto_sold";
  trade.sellPrice = sellPrice;
  trade.profit = profit;
  trade.soldAt = now;

  nft.ownerUserId = null;
  nft.status = "marketplace";
  nft.currentPrice = relistUpdate.nextPrice;
  nft.lastPriceIncreasePercent = relistUpdate.percent;
  nft.updatedAt = now;

  if (trade.botSubscriptionId) {
    const subscription = state.bot_subscriptions.find(
      (item) => item.id === trade.botSubscriptionId,
    );
    if (subscription) {
      if (subscription.remainingSellTrades > 0) {
        subscription.remainingSellTrades -= 1;
        subscription.completedSellTrades += 1;
      }
      subscription.lastExecutedAt = now;
      subscription.updatedAt = now;
      markBotSubscriptionCompleteIfDone(state, subscription);

      pushBotActivity(state, {
        userId: trade.userId,
        botSubscriptionId: subscription.id,
        nftId: trade.nftId,
        action: "AUTO_SELL",
        amount: sellPrice,
        profit,
        status: "COMPLETED",
      });
    }
  }

  return {
    tradeId: trade.id,
    saleJobId: trade.saleJobId,
    principalReturn,
    profit,
    levelDistributions,
    tradeSource: trade.source,
  };
}

function processBotPurchaseUplineIncome(
  state: NftSimState,
  sourceUserId: string,
  subscription: BotSubscriptionRecord,
) {
  if (subscription.uplineIncomePaidAt) {
    return null;
  }

  const sponsor = sponsorUserForUser(state, sourceUserId);
  if (!sponsor) {
    subscription.uplineIncomePaidAt = nowIso();
    subscription.updatedAt = nowIso();
    return null;
  }

  const requestedAmount = roundAmount(subscription.price * 0.2);
  const amount = reserveFundedAmount(
    state,
    requestedAmount,
    "totalBotPurchaseUplinePaid",
    {
      userId: sponsor.id,
      payoutType: "BOT_PURCHASE_UPLINE_INCOME",
      referenceId: subscription.id,
    },
  );
  if (amount <= 0) {
    return null;
  }

  const sponsorWallet = requireWallet(state, sponsor.id);
  sponsorWallet.withdrawalWallet = roundAmount(sponsorWallet.withdrawalWallet + amount);
  sponsorWallet.updatedAt = nowIso();

  pushWalletLedger(state, {
    userId: sponsor.id,
    type: "BOT_PURCHASE_UPLINE_INCOME",
    amount,
    referenceId: subscription.id,
    metadata: {
      sourceUserId,
      reserveBalanceAfter: state.system_reserve.balance,
    },
  });

  pushIncomeLedger(state, {
    userId: sponsor.id,
    type: "BOT_PURCHASE_UPLINE_INCOME",
    amount,
    sourceTradeId: subscription.id,
    level: 1,
    sourceUserId,
  });

  subscription.uplineIncomePaidAt = nowIso();
  subscription.updatedAt = nowIso();

  return {
    sponsorUserId: sponsor.id,
    amount,
  };
}

function executeBotCycleInternal(state: NftSimState) {
  const executions: Array<{
    subscriptionId: string;
    tradeId: string;
    nftId: string;
  }> = [];

  if (state.admin_settings.systemStopped) {
    for (const subscription of state.bot_subscriptions.filter((item) => item.status === "active")) {
      pushSafetyLog(state, {
        eventType: "BOT_CYCLE_SKIPPED",
        userId: subscription.userId,
        amount: null,
        reason: "System emergency stop is active.",
        metadata: { subscriptionId: subscription.id },
      });
    }
    return executions;
  }

  for (const subscription of state.bot_subscriptions) {
    const wallet = requireWallet(state, subscription.userId);

    if (subscription.status !== "active") {
      continue;
    }

    if (!botHasRemainingCapacity(subscription)) {
      markBotSubscriptionCompleteIfDone(state, subscription);
      continue;
    }

    if (activeTradeForBotSubscription(state, subscription.id)) {
      continue;
    }

    if (wallet.tradingWallet < state.admin_settings.minimumTradeAmount) {
      pushBotActivity(state, {
        userId: subscription.userId,
        botSubscriptionId: subscription.id,
        nftId: null,
        action: "AUTO_BUY",
        amount: 0,
        profit: null,
        status: "SKIPPED",
      });
      pushSafetyLog(state, {
        eventType: "BOT_CYCLE_SKIPPED",
        userId: subscription.userId,
        amount: wallet.tradingWallet,
        reason: "Trading wallet is below minimum trade amount.",
        metadata: {
          subscriptionId: subscription.id,
          tradingWallet: wallet.tradingWallet,
          minimumTradeAmount: state.admin_settings.minimumTradeAmount,
        },
      });
      continue;
    }

    if (!botCanStartNextCycle(state, subscription, wallet)) {
      continue;
    }
    const user = state.users.find((item) => item.id === subscription.userId);
    if (!user) {
      continue;
    }

    if (!canUseDailyTrade(user, "buy") || !canUseDailyTrade(user, "sell")) {
      pushBotActivity(state, {
        userId: subscription.userId,
        botSubscriptionId: subscription.id,
        nftId: null,
        action: "AUTO_BUY",
        amount: 0,
        profit: null,
        status: "SKIPPED",
      });
      pushSafetyLog(state, {
        eventType: "BOT_CYCLE_SKIPPED",
        userId: subscription.userId,
        amount: null,
        reason: "Skipped: daily limit reached",
        metadata: {
          subscriptionId: subscription.id,
          dailyBuyCount: user.dailyBuyCount,
          dailySellCount: user.dailySellCount,
          ...tradeLimitsForUser(user),
        },
      });
      continue;
    }

    const nft = state.nfts
      .filter((item) => item.status === "marketplace" && item.currentPrice <= wallet.tradingWallet)
      .sort((a, b) => a.currentPrice - b.currentPrice)[0];

    if (!nft) {
      pushSafetyLog(state, {
        eventType: "BOT_CYCLE_SKIPPED",
        userId: subscription.userId,
        amount: wallet.tradingWallet,
        reason: "No marketplace NFT is affordable for the trading wallet.",
        metadata: {
          subscriptionId: subscription.id,
          tradingWallet: wallet.tradingWallet,
        },
      });
      continue;
    }

    const buyResult = buyNft(state, user, wallet, {
      nftId: nft.id,
      userId: user.id,
      source: "bot",
      botSubscriptionId: subscription.id,
    });
    subscription.remainingBuyTrades -= 1;
    subscription.completedBuyTrades += 1;
    subscription.lastExecutedAt = nowIso();
    subscription.updatedAt = nowIso();
    markBotSubscriptionCompleteIfDone(state, subscription);
    listNft(state, buyResult.nft, buyResult.trade);

    pushBotActivity(state, {
      userId: user.id,
      botSubscriptionId: subscription.id,
      nftId: buyResult.nft.id,
      action: "AUTO_BUY",
      amount: buyResult.trade.buyPrice,
      profit: null,
      status: "SUCCESS",
    });

    recordBotListActivity(
      state,
      user.id,
      subscription.id,
      buyResult.nft.id,
      buyResult.nft.currentPrice,
    );

    executions.push({
      subscriptionId: subscription.id,
      tradeId: buyResult.trade.id,
      nftId: buyResult.nft.id,
    });
  }

  return executions;
}

export async function registerUser(input: RegisterUserInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    if (!walletAddress) {
      throw new ApiError(400, "walletAddress is required.");
    }

    const existingUser = state.users.find(
      (item) => normalizeWalletAddress(item.walletAddress) === walletAddress,
    );
    if (existingUser) {
      throw new ApiError(409, "Wallet is already registered.");
    }

    let sponsorUserId: string | null = null;
    if (input.sponsorWalletAddress) {
      const sponsorWalletAddress = normalizeWalletAddress(input.sponsorWalletAddress);
      if (sponsorWalletAddress === walletAddress) {
        throw new ApiError(409, "Self-referral is not allowed.");
      }

      const sponsor = state.users.find(
        (item) => normalizeWalletAddress(item.walletAddress) === sponsorWalletAddress,
      );
      if (!sponsor) {
        throw new ApiError(404, "Sponsor user not found.");
      }
      sponsorUserId = sponsor.id;
    }

    const now = nowIso();
    const user: UserRecord = {
      id: makeId("user"),
      walletAddress,
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
    const wallet = createUserWallet(now, user.id);

    state.users.push(user);
    state.wallets.push(wallet);
    createMlmRelations(state, user.id, sponsorUserId, now);

    return {
      message: "User registered successfully.",
      user,
      sponsorUserId,
      wallet: toPublicWallet(wallet, user),
    };
  });
}

export async function depositToTradingWallet(input: DepositInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.amount, "Deposit amount");

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const amount = roundAmount(input.amount);

    wallet.tradingWallet = roundAmount(wallet.tradingWallet + amount);
    wallet.totalDeposited = roundAmount(wallet.totalDeposited + amount);
    wallet.updatedAt = nowIso();
    refreshCapitalUnlock(user, wallet);

    pushWalletLedger(state, {
      userId: user.id,
      type: "DEPOSIT_TO_TRADING",
      amount,
      referenceId: null,
      metadata: {
        tradingWalletAfter: wallet.tradingWallet,
      },
    });

    return {
      message: "Deposit credited to trading wallet.",
      user,
      wallet: toPublicWallet(wallet, user),
    };
  });
}

export async function verifyDepositAndCredit(input: VerifyDepositInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.expectedAmount, "Deposit amount");

  const verification = await verifyUsdtDepositTransaction(input);

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, { walletAddress: input.walletAddress });
    const txHash = input.txHash.toLowerCase();
    const existingDeposit = state.deposits.find(
      (item) => item.txHash.toLowerCase() === txHash,
    );

    if (existingDeposit) {
      throw new ApiError(409, "Deposit transaction has already been used.");
    }

    const amount = roundAmount(verification.creditedAmount);
    const now = nowIso();

    state.deposits.push({
      id: makeId("deposit"),
      userId: user.id,
      txHash,
      chainId: verification.chainId,
      tokenAddress: verification.tokenAddress,
      expectedAmount: roundAmount(input.expectedAmount),
      creditedAmount: amount,
      status: "confirmed",
      createdAt: now,
      confirmedAt: now,
      rejectedAt: null,
    });

    wallet.tradingWallet = roundAmount(wallet.tradingWallet + amount);
    wallet.totalDeposited = roundAmount(wallet.totalDeposited + amount);
    wallet.updatedAt = now;
    refreshCapitalUnlock(user, wallet);

    pushWalletLedger(state, {
      userId: user.id,
      type: "DEPOSIT_TO_TRADING",
      amount,
      referenceId: txHash,
      metadata: {
        txHash,
        chainId: verification.chainId,
        tokenAddress: verification.tokenAddress,
        treasuryAddress: verification.treasuryAddress,
        confirmations: verification.confirmations,
        tradingWalletAfter: wallet.tradingWallet,
      },
    });

    return {
      message: "USDT deposit verified and credited.",
      user,
      wallet: toPublicWallet(wallet, user),
      deposit: state.deposits[state.deposits.length - 1],
    };
  });
}

export async function buyMarketplaceNft(input: BuyNftInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const result = buyNft(state, user, wallet, input);

    return {
      message: "NFT bought successfully.",
      user,
      wallet: toPublicWallet(result.wallet, user),
      nft: toPublicNft(state, result.nft),
      trade: toPublicTrade(state, result.trade),
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function listOwnedNft(input: ListNftInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, input);
    const nft = requireNft(state, input.nftId);

    if (nft.ownerUserId !== user.id) {
      throw new ApiError(403, "User does not own this NFT.");
    }

    if (nft.status !== "owned") {
      throw new ApiError(409, "Only owned NFTs can be listed.");
    }

    const trade = requireActiveTrade(state, nft.id, user.id);
    const autoSellDelayMinutes = listNft(
      state,
      nft,
      trade,
      input.debugAutoSellInMinutes,
    );

    return {
      message: "NFT listed for auto-sell.",
      nft: toPublicNft(state, nft),
      trade: toPublicTrade(state, trade),
      autoSellDelayMinutes,
    };
  });
}

export async function buyBotSubscription(input: BuyBotInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const plan = BOT_PLANS[input.planId];
    if (!plan) {
      throw new ApiError(404, "Bot plan not found.");
    }

    const matchedPlan = botPlanFromAmount(plan.price);
    if (!matchedPlan || matchedPlan.planId !== plan.planId) {
      throw new ApiError(409, "Bot plan configuration is invalid.");
    }

    if (wallet.withdrawalWallet < plan.price) {
      throw new ApiError(409, "Insufficient withdrawal wallet balance.");
    }

    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet - plan.price);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: user.id,
      type: "BOT_PURCHASE_DEBIT",
      amount: plan.price,
      referenceId: plan.planId,
      metadata: {
        planName: plan.planName,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    const subscription: BotSubscriptionRecord = {
      id: makeId("bot"),
      userId: user.id,
      planId: plan.planId,
      planName: plan.planName,
      price: plan.price,
      totalBuyTrades: plan.buyTrades,
      totalSellTrades: plan.sellTrades,
      completedBuyTrades: 0,
      completedSellTrades: 0,
      remainingBuyTrades: plan.buyTrades,
      remainingSellTrades: plan.sellTrades,
      status: "active",
      lastExecutedAt: null,
      uplineIncomePaidAt: null,
      purchasedAt: nowIso(),
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    state.bot_subscriptions.push(subscription);
    user.selfPackageAmount = roundAmount(user.selfPackageAmount + plan.price);
    refreshVipLevels(state);
    const uplineIncome = processBotPurchaseUplineIncome(state, user.id, subscription);

    return {
      message: "Bot subscription activated.",
      user,
      wallet: toPublicWallet(wallet, user),
      subscription: toPublicBotSubscription(subscription),
      uplineIncome,
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function processTradingEngineTick() {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const currentTime = new Date();
    if (state.admin_settings.systemStopped) {
      pushSafetyLog(state, {
        eventType: "ENGINE_BLOCKED",
        userId: null,
        amount: null,
        reason: "System emergency stop is active.",
        metadata: {},
      });

      return {
        serverTime: currentTime.toISOString(),
        settledSales: [],
        botExecutions: [],
        royaltyPayouts: [],
      };
    }

    const settledSales: Array<{
      tradeId: string;
      saleJobId: string | null;
      principalReturn: number;
      profit: number;
      levelDistributions: Array<{ level: number; userId: string; amount: number }>;
      tradeSource: string;
    }> = [];

    for (const trade of state.nft_trades) {
      if (trade.status !== "listed" || !trade.autoSellAt || trade.soldAt) {
        continue;
      }

      if (new Date(trade.autoSellAt) > currentTime) {
        continue;
      }

      const settlement = settleAutoSell(state, trade);
      if (settlement) {
        settledSales.push(settlement);
      }
    }

    const botExecutions = executeBotCycleInternal(state);
    refreshVipLevels(state);
    const royaltyPayouts = processRoyaltyPayouts(state, currentTime);

    return {
      serverTime: currentTime.toISOString(),
      settledSales,
      botExecutions,
      royaltyPayouts,
    };
  });
}

export async function processDueAutoSales() {
  return processTradingEngineTick();
}

export async function transferCapitalToWithdrawal(input: TransferCapitalInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    refreshCapitalUnlock(user, wallet);

    if (!user.capitalUnlocked) {
      const progress = capitalTransferProgress(user);
      throw new ApiError(
        403,
        `Your capital is still locked. You have completed ${progress.buyCount}/300 buys and ${progress.sellCount}/300 sells. Complete the remaining trades to transfer your capital to Withdrawal Wallet.`,
        progress,
      );
    }

    if (user.capitalTransferredAt) {
      throw new ApiError(409, "Capital has already been transferred.");
    }

    const amount = roundAmount(wallet.tradingWallet);
    if (amount <= 0) {
      throw new ApiError(409, "No trading wallet capital available to transfer.");
    }

    const now = nowIso();
    wallet.tradingWallet = 0;
    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + amount);
    wallet.updatedAt = now;
    user.capitalTransferredAt = now;

    pushWalletLedger(state, {
      userId: user.id,
      type: "CAPITAL_TRANSFER",
      amount,
      referenceId: null,
      metadata: {
        fullTransfer: true,
        capitalUnlockedAt: user.capitalUnlockedAt,
        tradingWalletAfter: wallet.tradingWallet,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    return {
      message: "Capital transferred to withdrawal wallet.",
      user,
      wallet: toPublicWallet(wallet, user),
    };
  });
}

export async function requestWithdrawal(input: WithdrawInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.amount, "Withdrawal amount");

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const amount = roundAmount(input.amount);
    const minimum = state.admin_settings.withdrawalMinimumAmount;
    const feePercent = state.admin_settings.withdrawalFeePercent;

    if (state.admin_settings.systemStopped) {
      pushSafetyLog(state, {
        eventType: "BLOCKED_WITHDRAWAL",
        userId: user.id,
        amount,
        reason: "System emergency stop is active.",
        metadata: {},
      });
      throw new ApiError(409, "System emergency stop is active.");
    }

    if (amount < minimum) {
      throw new ApiError(400, `Minimum withdrawal is $${minimum}.`);
    }

    if (wallet.withdrawalWallet < amount) {
      throw new ApiError(409, "Insufficient withdrawal wallet balance.");
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(todayStart);
    const todaysWithdrawals = state.withdrawals.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return item.userId === user.id && createdAt >= todayStart && createdAt < todayEnd;
    });

    if (todaysWithdrawals.length > 0) {
      pushSafetyLog(state, {
        eventType: "BLOCKED_WITHDRAWAL",
        userId: user.id,
        amount,
        reason: "Only one withdrawal per user per day is allowed.",
        metadata: { existingWithdrawalId: todaysWithdrawals[0]?.id ?? null },
      });
      throw new ApiError(409, "Only one withdrawal per user per day is allowed.");
    }

    const withdrawnToday = roundAmount(
      todaysWithdrawals.reduce((total, item) => total + item.grossAmount, 0),
    );
    if (
      roundAmount(withdrawnToday + amount) >
      state.admin_settings.maxDailyWithdrawalAmountPerUser
    ) {
      pushSafetyLog(state, {
        eventType: "BLOCKED_WITHDRAWAL",
        userId: user.id,
        amount,
        reason: "Daily withdrawal amount limit exceeded.",
        metadata: {
          withdrawnToday,
          cap: state.admin_settings.maxDailyWithdrawalAmountPerUser,
        },
      });
      throw new ApiError(409, "Daily withdrawal amount limit exceeded.");
    }

    const feeAmount = roundAmount(amount * (feePercent / 100));
    const netAmount = roundAmount(amount - feeAmount);
    const withdrawal: WithdrawalRecord = {
      id: makeId("withdrawal"),
      userId: user.id,
      grossAmount: amount,
      feeAmount,
      netAmount,
      status: "requested",
      approvedAt: null,
      payoutTxHash: null,
      payoutStatus: "NOT_STARTED",
      createdAt: nowIso(),
    };

    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet - amount);
    wallet.updatedAt = nowIso();
    state.withdrawals.push(withdrawal);

    pushWalletLedger(state, {
      userId: user.id,
      type: "WITHDRAWAL_REQUEST",
      amount: netAmount,
      referenceId: withdrawal.id,
      metadata: {
        grossAmount: amount,
        netAmount,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    pushWalletLedger(state, {
      userId: user.id,
      type: "WITHDRAWAL_FEE",
      amount: feeAmount,
      referenceId: withdrawal.id,
      metadata: {
        feePercent,
      },
    });

    return {
      message: "Withdrawal request created.",
      user,
      wallet: toPublicWallet(wallet, user),
      withdrawal,
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function getMarketplaceNfts() {
  await ensureStoreInitialized();
  await processTradingEngineTick();
  const state = await readState();

  return {
    marketplace: state.nfts
      .filter((item) => item.status === "marketplace")
      .map((item) => toPublicNft(state, item)),
    total: state.nfts.filter((item) => item.status === "marketplace").length,
    settings: toPublicSettings(state.admin_settings),
    serverTime: nowIso(),
  };
}

export async function getWalletBalances(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, selector);
    const walletLedger = state.wallet_ledger
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const withdrawals = state.withdrawals
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      user,
      wallet: toPublicWallet(wallet, user),
      systemReserve: toPublicReserve(state.system_reserve),
      settings: toPublicSettings(state.admin_settings),
      withdrawals,
      ledger: walletLedger,
    };
  });
}

const WALLET_HISTORY_TYPES = new Set<WalletLedgerRecord["type"]>([
  "DEPOSIT_TO_TRADING",
  "NFT_BUY_DEBIT",
  "NFT_SELL_PRINCIPAL_RETURN",
  "NFT_TRADING_PROFIT",
  "BOT_PURCHASE_UPLINE_INCOME",
  "BOT_TRADING_PROFIT",
  "LEVEL_INCOME",
  "ROYALTY_INCOME",
  "CAPITAL_TRANSFER",
  "CAPITAL_TRANSFER_TO_WITHDRAWAL",
  "WITHDRAWAL_REQUEST",
  "WITHDRAWAL_FEE",
]);

function walletAffectedForLedgerType(type: WalletLedgerRecord["type"]) {
  if (
    type === "DEPOSIT_TO_TRADING" ||
    type === "NFT_BUY_DEBIT" ||
    type === "NFT_SELL_PRINCIPAL_RETURN"
  ) {
    return "Trading Wallet";
  }

  return "Withdrawal Wallet";
}

function statusForLedgerEntry(state: NftSimState, entry: WalletLedgerRecord) {
  if (entry.type !== "WITHDRAWAL_REQUEST") {
    return "Completed";
  }

  const withdrawal = state.withdrawals.find((item) => item.id === entry.referenceId);
  if (withdrawal?.status === "approved_pending_tx") {
    return "Approved Pending TX";
  }

  return withdrawal?.status === "approved" ? "Approved" : "Requested";
}

export async function getWalletHistory(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const entries = state.wallet_ledger
      .filter((item) => item.userId === user.id && WALLET_HISTORY_TYPES.has(item.type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: entry.amount,
        createdAt: entry.createdAt,
        status: statusForLedgerEntry(state, entry),
        walletAffected: walletAffectedForLedgerType(entry.type),
        referenceId: entry.referenceId,
        metadata: entry.metadata,
      }));

    return {
      user,
      total: entries.length,
      history: entries,
    };
  });
}

export async function getIncomeOverview(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const now = new Date();
    const todayStart = startOfToday(now);
    const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = startOfMonth(now);
    const entries = state.income_ledger
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const nftTradingEntries = entries.filter((item) => item.type === "NFT_TRADING_INCOME");
    const levelIncomeEntries = entries.filter((item) => item.type === "LEVEL_INCOME");
    const botTradingEntries = entries.filter((item) => item.type === "BOT_TRADING_INCOME");
    const botPurchaseEntries = entries.filter(
      (item) => item.type === "BOT_PURCHASE_UPLINE_INCOME",
    );
    const royaltyEntries = entries.filter((item) => item.type === "ROYALTY_INCOME");

    return {
      user,
      totalIncome: sumAmounts(entries),
      nftTradingIncome: summarizeIncome(nftTradingEntries, todayStart, weeklyStart, monthStart),
      levelIncome: summarizeIncome(levelIncomeEntries, todayStart, weeklyStart, monthStart),
      botTradingIncome: summarizeIncome(botTradingEntries, todayStart, weeklyStart, monthStart),
      botPurchaseUplineIncome: summarizeIncome(
        botPurchaseEntries,
        todayStart,
        weeklyStart,
        monthStart,
      ),
      royaltyIncome: summarizeIncome(royaltyEntries, todayStart, weeklyStart, monthStart),
      history: entries,
    };
  });
}

export async function getNftTradingIncome(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const now = new Date();
    const todayStart = startOfToday(now);
    const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = startOfMonth(now);

    const incomeEntries = state.income_ledger.filter(
      (item) => item.userId === user.id && item.type === "NFT_TRADING_INCOME",
    );
    const pendingListedTrades = state.nft_trades
      .filter((item) => item.userId === user.id && item.status === "listed")
      .map((item) => toPublicTrade(state, item));

    const history = [...incomeEntries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => {
        const trade =
          state.nft_trades.find((item) => item.id === entry.sourceTradeId) ?? null;
        const nft = trade
          ? state.nfts.find((item) => item.id === trade.nftId) ?? null
          : null;

        return {
          ...entry,
          trade,
          nft,
        };
      });

    return {
      user,
      totalNftTradingIncome: sumAmounts(incomeEntries),
      todayIncome: sumAmounts(
        incomeEntries.filter((item) => new Date(item.createdAt) >= todayStart),
      ),
      weeklyIncome: sumAmounts(
        incomeEntries.filter((item) => new Date(item.createdAt) >= weeklyStart),
      ),
      monthlyIncome: sumAmounts(
        incomeEntries.filter((item) => new Date(item.createdAt) >= monthStart),
      ),
      pendingListedTradesCount: pendingListedTrades.length,
      pendingListedTrades,
      history,
    };
  });
}

export async function getTradesHistory(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, selector);
    const trades = state.nft_trades
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicTrade(state, item));
    const subscriptions = state.bot_subscriptions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicBotSubscription(item));

    return {
      user,
      wallet: toPublicWallet(wallet, user),
      total: trades.length,
      pending: trades.filter((item) => item.status === "listed").length,
      completed: trades.filter((item) => item.status === "auto_sold").length,
      trades,
      botSubscriptions: subscriptions,
    };
  });
}

export async function getTeamOverview(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const directs = state.mlm_tree
      .filter((item) => item.ancestorUserId === user.id && item.level === 1)
      .map((item) => state.users.find((entry) => entry.id === item.userId))
      .filter((item): item is UserRecord => Boolean(item));
    const levelBreakdown = MLM_LEVEL_PERCENTAGES.map((_, index) => ({
      level: index + 1,
      downlineCount: state.mlm_tree.filter(
        (item) => item.ancestorUserId === user.id && item.level === index + 1,
      ).length,
      unlocked: unlockedLevels(state, user.id) >= index + 1,
    }));

    return {
      user,
      sponsor: sponsorUserForUser(state, user.id),
      directs,
      directCount: directs.length,
      unlockedLevels: unlockedLevels(state, user.id),
      levelBreakdown,
      vipStatus: royaltyProgress(state, user.id),
    };
  });
}

export async function getRoyaltyStatus(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, selector);
    const progress = royaltyProgress(state, user.id);
    const payoutHistory = state.income_ledger
      .filter((item) => item.userId === user.id && item.type === "ROYALTY_INCOME")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        selfPackageAmount: user.selfPackageAmount,
        currentVipLevel: user.currentVipLevel,
        vipAchievedAt: user.vipAchievedAt,
      },
      currentVipLevel: progress.currentVipLevel,
      nextVipLevel: progress.nextVipLevel,
      currentRequirementProgress: progress.currentRequirementProgress,
      payoutAmount: progress.payoutAmount,
      payoutHistory,
      withdrawalWallet: wallet.withdrawalWallet,
      payoutSchedule: {
        firstDay: state.admin_settings.vipFirstPayoutDay,
        secondDay: state.admin_settings.vipSecondPayoutDay,
        monthEnd: true,
      },
    };
  });
}

export async function getBotStatus(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const subscriptions = state.bot_subscriptions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicBotSubscription(item));
    const todayStart = startOfToday(new Date());
    const botProfitEntries = state.income_ledger.filter(
      (item) => item.userId === user.id && item.type === "BOT_TRADING_INCOME",
    );
    const latestActivity =
      state.bot_activity
        .filter((item) => item.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

    return {
      user,
      settings: toPublicSettings(state.admin_settings),
      plans: Object.values(BOT_PLANS).map((plan) => ({
        ...plan,
        totalCycles: Math.min(plan.buyTrades, plan.sellTrades),
      })),
      subscriptions,
      activeSubscriptions: subscriptions.filter((item) => item.status === "active").length,
      todayBotProfit: sumAmounts(
        botProfitEntries.filter((item) => new Date(item.createdAt) >= todayStart),
      ),
      totalBotProfit: sumAmounts(botProfitEntries),
      latestActivity,
    };
  });
}

export async function getBotActivity(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const activity = state.bot_activity
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({
        ...item,
        nft: item.nftId ? state.nfts.find((entry) => entry.id === item.nftId) ?? null : null,
      }));

    return {
      user,
      total: activity.length,
      activity,
    };
  });
}

export async function getAdminOverview() {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const royaltyPaid = sumAmounts(
      state.income_ledger.filter((item) => item.type === "ROYALTY_INCOME"),
    );
    const approvedWithdrawalTotal = roundAmount(
      state.withdrawals
        .filter((item) => isApprovedWithdrawalStatus(item.status))
        .reduce((total, item) => total + item.netAmount, 0),
    );
    const withdrawals = state.withdrawals
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((withdrawal) => ({
        ...withdrawal,
        user:
          state.users.find((user) => user.id === withdrawal.userId) ?? null,
      }));
    const safetyLogs = state.safety_logs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const blockedPayoutLogs = safetyLogs.filter(
      (item) => item.eventType === "BLOCKED_PAYOUT",
    );

    return {
      settings: toPublicSettings(state.admin_settings),
      systemReserve: toPublicReserve(state.system_reserve),
      summary: {
        totalUsers: state.users.length,
        totalWithdrawalsPending: withdrawals.filter((item) => item.status === "requested").length,
        totalPayouts: roundAmount(
          state.system_reserve.totalMlmPaid +
            state.system_reserve.totalRoyaltyPaid +
            state.system_reserve.totalNftTradingPaid +
            state.system_reserve.totalBotTradingPaid +
            state.system_reserve.totalBotPurchaseUplinePaid +
            approvedWithdrawalTotal,
        ),
        approvedWithdrawalTotal,
        royaltyPaid,
        reserveWarning:
          state.system_reserve.balance < state.admin_settings.perUserDailyPayoutCap,
      },
      withdrawals,
      pendingWithdrawals: withdrawals.filter((item) => item.status === "requested"),
      blockedPayoutLogs,
      safetyLogs,
    };
  });
}

export async function getAdminAnalytics() {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const now = new Date();
    const todayStart = startOfToday(now);
    const oneDayMs = 24 * 60 * 60 * 1000;

    const deposits = state.wallet_ledger.filter((item) => item.type === "DEPOSIT_TO_TRADING");
    const approvedWithdrawals = state.withdrawals.filter((item) =>
      isApprovedWithdrawalStatus(item.status),
    );
    const royaltyEntries = state.income_ledger.filter((item) => item.type === "ROYALTY_INCOME");
    const botTradingEntries = state.income_ledger.filter((item) => item.type === "BOT_TRADING_INCOME");
    const botPurchaseEntries = state.income_ledger.filter(
      (item) => item.type === "BOT_PURCHASE_UPLINE_INCOME",
    );
    const mlmEntries = state.income_ledger.filter((item) => item.type === "LEVEL_INCOME");

    const totalPayouts = roundAmount(
      sumAmounts(royaltyEntries) +
        sumAmounts(botTradingEntries) +
        sumAmounts(botPurchaseEntries) +
        sumAmounts(mlmEntries),
    );

    const activeUsersNow = new Set<string>();
    const activeSince = new Date(now.getTime() - oneDayMs);
    for (const entry of state.wallet_ledger) {
      if (new Date(entry.createdAt) >= activeSince) {
        activeUsersNow.add(entry.userId);
      }
    }
    for (const entry of state.income_ledger) {
      if (new Date(entry.createdAt) >= activeSince) {
        activeUsersNow.add(entry.userId);
      }
    }
    for (const entry of state.nft_trades) {
      if (new Date(entry.createdAt) >= activeSince) {
        activeUsersNow.add(entry.userId);
      }
    }
    for (const entry of state.bot_activity) {
      if (new Date(entry.createdAt) >= activeSince) {
        activeUsersNow.add(entry.userId);
      }
    }

    const series = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(todayStart.getTime() - (6 - index) * oneDayMs);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const inWindow = (isoDate: string) => {
        const value = new Date(isoDate);
        return value >= dayStart && value < dayEnd;
      };

      const dailyDeposits = roundAmount(
        deposits
          .filter((item) => inWindow(item.createdAt))
          .reduce((total, item) => total + item.amount, 0),
      );
      const dailyWithdrawals = roundAmount(
        approvedWithdrawals
          .filter((item) => inWindow(item.createdAt))
          .reduce((total, item) => total + item.grossAmount, 0),
      );
      const dailyPayouts = roundAmount(
        state.income_ledger
          .filter((item) => inWindow(item.createdAt))
          .reduce((total, item) => total + item.amount, 0),
      );

      const dailyActiveUsers = new Set<string>();
      for (const collection of [
        state.wallet_ledger,
        state.income_ledger,
        state.nft_trades,
        state.bot_activity,
      ] as const) {
        for (const entry of collection) {
          if (inWindow(entry.createdAt)) {
            dailyActiveUsers.add(entry.userId);
          }
        }
      }

      return {
        date: dayStart.toISOString(),
        label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        deposits: dailyDeposits,
        withdrawals: dailyWithdrawals,
        payouts: dailyPayouts,
        profitLoss: roundAmount(dailyDeposits - dailyPayouts - dailyWithdrawals),
        activeUsers: dailyActiveUsers.size,
      };
    });

    const todaysDeposits = series[series.length - 1]?.deposits ?? 0;
    const todaysWithdrawals = series[series.length - 1]?.withdrawals ?? 0;
    const todaysPayouts = series[series.length - 1]?.payouts ?? 0;
    const todaysProfitLoss = series[series.length - 1]?.profitLoss ?? 0;
    const todaysActiveUsers = series[series.length - 1]?.activeUsers ?? 0;

    return {
      totals: {
        totalDeposits: roundAmount(
          deposits.reduce((total, item) => total + item.amount, 0),
        ),
        totalWithdrawals: roundAmount(
          state.withdrawals.reduce((total, item) => total + item.grossAmount, 0),
        ),
        totalNftTrades: state.nft_trades.filter((item) => item.source === "manual").length,
        totalBotTrades: state.nft_trades.filter((item) => item.source === "bot").length,
        totalMlmPayout: state.system_reserve.totalMlmPaid,
        totalRoyaltyPayout: sumAmounts(royaltyEntries),
        systemReserveBalance: state.system_reserve.balance,
        activeUsers: activeUsersNow.size,
        totalPayouts,
      },
      today: {
        deposits: todaysDeposits,
        withdrawals: todaysWithdrawals,
        payouts: todaysPayouts,
        profitLoss: todaysProfitLoss,
        activeUsers: todaysActiveUsers,
        nftTrades: state.nft_trades.filter(
          (item) =>
            item.source === "manual" &&
            new Date(item.createdAt) >= todayStart,
        ).length,
        botTrades: state.nft_trades.filter(
          (item) =>
            item.source === "bot" &&
            new Date(item.createdAt) >= todayStart,
        ).length,
      },
      series,
    };
  });
}

export async function updateAdminSettings(input: UpdateAdminSettingsInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const settings = state.admin_settings;
    const nextSettings: AdminSettingsRecord = {
      ...settings,
      nftPriceIncreaseMinPercent:
        input.nftPriceIncreaseMinPercent ?? settings.nftPriceIncreaseMinPercent,
      nftPriceIncreaseMaxPercent:
        input.nftPriceIncreaseMaxPercent ?? settings.nftPriceIncreaseMaxPercent,
      autoSellDelayMinMinutes:
        input.autoSellDelayMinMinutes ?? settings.autoSellDelayMinMinutes,
      autoSellDelayMaxMinutes:
        input.autoSellDelayMaxMinutes ?? settings.autoSellDelayMaxMinutes,
      botProfitMinPercent: input.botProfitMinPercent ?? settings.botProfitMinPercent,
      botProfitMaxPercent: input.botProfitMaxPercent ?? settings.botProfitMaxPercent,
      withdrawalMinimumAmount:
        input.withdrawalMinimumAmount ?? settings.withdrawalMinimumAmount,
      withdrawalFeePercent: input.withdrawalFeePercent ?? settings.withdrawalFeePercent,
      vipFirstPayoutDay: input.vipFirstPayoutDay ?? settings.vipFirstPayoutDay,
      vipSecondPayoutDay: input.vipSecondPayoutDay ?? settings.vipSecondPayoutDay,
      vipRecurringEnabled: input.vipRecurringEnabled ?? settings.vipRecurringEnabled,
      payoutsPaused: input.payoutsPaused ?? settings.payoutsPaused,
      systemStopped: input.systemStopped ?? settings.systemStopped,
      globalDailyPayoutCap:
        input.globalDailyPayoutCap ?? settings.globalDailyPayoutCap,
      perUserDailyPayoutCap:
        input.perUserDailyPayoutCap ?? settings.perUserDailyPayoutCap,
      maxDailyWithdrawalAmountPerUser:
        input.maxDailyWithdrawalAmountPerUser ??
        settings.maxDailyWithdrawalAmountPerUser,
      minimumTradeAmount: input.minimumTradeAmount ?? settings.minimumTradeAmount,
      updatedAt: nowIso(),
    };

    validateNonNegativeAmount(nextSettings.nftPriceIncreaseMinPercent, "NFT price increase min");
    validateNonNegativeAmount(nextSettings.nftPriceIncreaseMaxPercent, "NFT price increase max");
    if (nextSettings.nftPriceIncreaseMinPercent > nextSettings.nftPriceIncreaseMaxPercent) {
      throw new ApiError(400, "NFT price increase min cannot exceed max.");
    }

    validateNonNegativeAmount(nextSettings.autoSellDelayMinMinutes, "Auto-sell delay min");
    validateNonNegativeAmount(nextSettings.autoSellDelayMaxMinutes, "Auto-sell delay max");
    if (nextSettings.autoSellDelayMinMinutes > nextSettings.autoSellDelayMaxMinutes) {
      throw new ApiError(400, "Auto-sell delay min cannot exceed max.");
    }

    validateNonNegativeAmount(nextSettings.botProfitMinPercent, "Bot profit min");
    validateNonNegativeAmount(nextSettings.botProfitMaxPercent, "Bot profit max");
    if (nextSettings.botProfitMinPercent > nextSettings.botProfitMaxPercent) {
      throw new ApiError(400, "Bot profit min cannot exceed max.");
    }

    validatePositiveAmount(nextSettings.withdrawalMinimumAmount, "Withdrawal minimum");
    validateNonNegativeAmount(nextSettings.withdrawalFeePercent, "Withdrawal fee");
    if (nextSettings.withdrawalFeePercent > 100) {
      throw new ApiError(400, "Withdrawal fee percent cannot exceed 100.");
    }

    validatePositiveAmount(nextSettings.globalDailyPayoutCap, "Global daily payout cap");
    validatePositiveAmount(nextSettings.perUserDailyPayoutCap, "Per-user daily payout cap");
    validatePositiveAmount(
      nextSettings.maxDailyWithdrawalAmountPerUser,
      "Max daily withdrawal amount per user",
    );
    validatePositiveAmount(nextSettings.minimumTradeAmount, "Minimum trade amount");

    for (const [label, value] of [
      ["First royalty payout day", nextSettings.vipFirstPayoutDay],
      ["Second royalty payout day", nextSettings.vipSecondPayoutDay],
    ] as const) {
      if (!Number.isInteger(value) || value < 1 || value > 28) {
        throw new ApiError(400, `${label} must be an integer between 1 and 28.`);
      }
    }

    if (nextSettings.vipFirstPayoutDay === nextSettings.vipSecondPayoutDay) {
      throw new ApiError(400, "Royalty payout dates must be different.");
    }

    state.admin_settings = nextSettings;

    return {
      message: "Admin settings updated.",
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function updateSystemReserve(input: UpdateReserveInput) {
  await ensureStoreInitialized();
  validateNonNegativeAmount(input.balance, "System reserve balance");

  return withStoreTransaction(async (state) => {
    state.system_reserve.balance = roundAmount(input.balance);
    state.system_reserve.updatedAt = nowIso();

    return {
      message: "System reserve updated.",
      systemReserve: toPublicReserve(state.system_reserve),
    };
  });
}

export async function approveWithdrawal(input: ApproveWithdrawalInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    if (state.admin_settings.systemStopped) {
      pushSafetyLog(state, {
        eventType: "BLOCKED_PAYOUT",
        userId: null,
        amount: null,
        reason: "System emergency stop is active.",
        metadata: { payoutType: "WITHDRAWAL_APPROVAL", withdrawalId: input.withdrawalId },
      });
      throw new ApiError(409, "System emergency stop is active.");
    }

    if (state.admin_settings.payoutsPaused) {
      throw new ApiError(409, "Payouts are paused.");
    }

    const withdrawal = state.withdrawals.find((item) => item.id === input.withdrawalId);
    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found.");
    }

    if (withdrawal.status !== "requested") {
      throw new ApiError(409, "Withdrawal request is already processed.");
    }

    if (
      !checkPayoutSafety(state, {
        userId: withdrawal.userId,
        amount: withdrawal.netAmount,
        payoutType: "WITHDRAWAL_APPROVAL",
        referenceId: withdrawal.id,
      })
    ) {
      throw new ApiError(409, "Withdrawal approval blocked by safety controls.");
    }

    state.system_reserve.balance = roundAmount(
      state.system_reserve.balance - withdrawal.netAmount,
    );
    state.system_reserve.updatedAt = nowIso();

    withdrawal.status = "approved_pending_tx";
    withdrawal.approvedAt = nowIso();
    withdrawal.payoutStatus = "PENDING_TX";

    return {
      message: "Withdrawal approved and pending on-chain payout transaction.",
      withdrawal,
    };
  });
}
