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
  calculateRegistrationBonusTokens,
  getCurrentGxnTokenPriceUsd,
  GXN_TOKEN_VALUE_USD,
  REGISTRATION_BONUS_USD,
} from "@/server/services/gxn-token";
import { MIN_WITHDRAWAL_AMOUNT } from "@/config/withdrawal";
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
import { authorizeUsdtWithdrawalOnChain } from "@/server/services/withdrawal-chain";

const MLM_LEVEL_PERCENTAGES = [20, 15, 10, 8, 5] as const;
const GXN_WITHDRAWAL_DEDUCTION_PERCENT = 20;
const DAILY_WITHDRAWAL_LIMIT = 3;
const VIP_LEVELS = [
  { level: 1, selfPackageAmount: 100, payoutAmount: 30 },
  { level: 2, selfPackageAmount: 200, payoutAmount: 60 },
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
const MANUAL_AUTO_SELL_DELAY_MIN_MINUTES = 60;
const MANUAL_AUTO_SELL_DELAY_MAX_MINUTES = 120;
const BOT_AUTO_SELL_DELAY_MIN_MINUTES = 20;
const BOT_AUTO_SELL_DELAY_MAX_MINUTES = 30;
const BOT_LIST_DELAY_MS = 300_000;
const NO_SUITABLE_NFT_MESSAGE = "No suitable NFT available";
const LEGACY_DEMO_MARKETPLACE_PRICES_BY_TOKEN_ID = new Map([
  ["1001", 120],
  ["1002", 175],
  ["1003", 235],
  ["1004", 310],
]);

let botExecutionRunning = false;
const scheduledBotListTradeIds = new Set<string>();
const activeBotBuyUserIds = new Set<string>();
const isReferralRequired = true;

type BotPlanId = keyof typeof BOT_PLANS;
type BotPlan = (typeof BOT_PLANS)[BotPlanId];

interface UserSelector {
  userId?: string;
  walletAddress?: string;
}

interface RegisterUserInput {
  walletAddress: string;
  sponsorWalletAddress?: string;
  ref?: string;
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
  cycleId?: string | null;
}

interface ListNftInput extends UserSelector {
  nftId: string;
  debugAutoSellInMinutes?: number;
}

interface TransferCapitalInput extends UserSelector {}

interface BuyBotInput extends UserSelector {
  packageId?: string;
  planId?: string;
  amount?: number | string;
  price?: number | string;
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

interface AdminTransferFundInput {
  userId: string;
  amount: number;
}

interface AdminActivateBotInput {
  userId: string;
}

interface AdminCreateNftInput {
  tokenId: string;
  name: string;
  imageUrl: string;
  basePrice: number;
  category: string;
  description: string;
  status: "draft" | "live";
}

interface AdminUpdateNftInput {
  nftId: string;
  currentPrice?: number;
  status?: "draft" | "live";
}

interface AdminDeleteNftInput {
  nftId: string;
}

interface ApproveWithdrawalInput {
  withdrawalId: string;
}

interface ConfirmWithdrawalInput {
  withdrawalId: string;
  walletAddress: string;
  txHash: string;
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

function formatShortWalletAddress(walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function isWalletAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function normalizeReferralCode(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function createReferralCode(walletAddress: string) {
  return walletAddress;
}

function findReferralUser(state: NftSimState, referralCode: string) {
  const normalizedReferral = normalizeReferralCode(referralCode);
  const normalizedReferralLower = normalizedReferral.toLowerCase();

  return state.users.find((item) => {
    const itemReferralCode = normalizeReferralCode(item.referralCode).toLowerCase();
    const itemWalletAddress = normalizeWalletAddress(item.walletAddress);

    return (
      itemReferralCode === normalizedReferralLower ||
      item.id === normalizedReferral ||
      itemWalletAddress === normalizedReferralLower
    );
  }) ?? null;
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

function isFailedWithdrawal(withdrawal: WithdrawalRecord) {
  const payoutStatus = withdrawal.payoutStatus.toUpperCase();
  const onChainStatus = withdrawal.onChainStatus.toUpperCase();
  const status = withdrawal.status.toUpperCase();

  return (
    payoutStatus === "FAILED" ||
    payoutStatus.endsWith("_FAILED") ||
    payoutStatus.includes("REFUNDED") ||
    payoutStatus.includes("FAILED_REFUNDED") ||
    onChainStatus === "FAILED" ||
    onChainStatus.includes("REFUNDED") ||
    status === "FAILED" ||
    status.includes("REFUNDED") ||
    status.includes("FAILED_REFUNDED")
  );
}

function requireNft(state: NftSimState, nftId: string) {
  const nft = state.nfts.find((item) => item.id === nftId);
  if (!nft) {
    throw new ApiError(404, "NFT not found.");
  }

  return nft;
}

function isLegacyDemoMarketplaceNft(nft: NftRecord) {
  const seedPrice = LEGACY_DEMO_MARKETPLACE_PRICES_BY_TOKEN_ID.get(nft.tokenId);

  return (
    typeof seedPrice === "number" &&
    nft.ownerUserId === null &&
    nft.totalTrades === 0 &&
    nft.basePrice === seedPrice &&
    nft.currentPrice === seedPrice
  );
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
    gxnTokenBalance: 0,
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

function dailyTradeCountsFromTrades(state: NftSimState, userId: string, currentTime = new Date()) {
  const todayStart = startOfToday(currentTime);

  return {
    dailyBuyCount: state.nft_trades.filter(
      (trade) => trade.userId === userId && new Date(trade.createdAt) >= todayStart,
    ).length,
    dailySellCount: state.nft_trades.filter(
      (trade) =>
        trade.userId === userId &&
        trade.status === "auto_sold" &&
        Boolean(trade.soldAt) &&
        new Date(trade.soldAt as string) >= todayStart,
    ).length,
  };
}

function syncDailyTradeCountsFromTrades(state: NftSimState, user: UserRecord) {
  const counts = dailyTradeCountsFromTrades(state, user.id);
  user.dailyBuyCount = counts.dailyBuyCount;
  user.dailySellCount = counts.dailySellCount;
  user.lastTradeResetAt = startOfToday(new Date()).toISOString();
  return counts;
}

function dailyTradeSnapshot(state: NftSimState, user: UserRecord) {
  resetDailyTradeCountsIfDue(user);
  const limits = tradeLimitsForUser(user);
  const counts = syncDailyTradeCountsFromTrades(state, user);

  return {
    ...counts,
    ...limits,
    currentVipLevel: user.currentVipLevel,
  };
}

function canUseDailyTrade(state: NftSimState, user: UserRecord, side: "buy" | "sell") {
  resetDailyTradeCountsIfDue(user);
  const limits = tradeLimitsForUser(user);
  const counts = syncDailyTradeCountsFromTrades(state, user);
  const currentCount = side === "buy" ? counts.dailyBuyCount : counts.dailySellCount;
  const limit = side === "buy" ? limits.dailyBuyLimit : limits.dailySellLimit;

  return currentCount < limit;
}

function assertDailyTradeLimit(state: NftSimState, user: UserRecord, side: "buy" | "sell") {
  if (!canUseDailyTrade(state, user, side)) {
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

function logBotSchedulerSkip(
  reason: string,
  metadata: Record<string, unknown>,
) {
  console.info("[bot.scheduler] skipped", {
    reason,
    ...metadata,
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

function activeBotTradeForUser(state: NftSimState, userId: string) {
  return state.nft_trades
    .filter(
      (item) =>
        item.userId === userId &&
        item.source === "bot" &&
        item.status !== "auto_sold",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
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

function tradeForBotActivity(state: NftSimState, activity: BotActivityRecord) {
  if (activity.cycleId) {
    const tradeByCycle = state.nft_trades.find((trade) => trade.cycleId === activity.cycleId);
    if (tradeByCycle) {
      return tradeByCycle;
    }
  }

  if (!activity.nftId) {
    return null;
  }

  return state.nft_trades
    .filter(
      (trade) =>
        trade.botSubscriptionId === activity.botSubscriptionId &&
        trade.nftId === activity.nftId,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function toPublicBotActivity(state: NftSimState, activity: BotActivityRecord) {
  const trade = tradeForBotActivity(state, activity);

  return {
    ...activity,
    cycleId: activity.cycleId ?? trade?.cycleId ?? null,
    tradeCreatedAt: trade?.createdAt ?? null,
    listedAt: trade?.listedAt ?? null,
    autoSellAt: trade?.autoSellAt ?? null,
    soldAt: trade?.soldAt ?? null,
    nft: activity.nftId ? state.nfts.find((entry) => entry.id === activity.nftId) ?? null : null,
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

function toPublicWallet(wallet: WalletRecord, user?: UserRecord, state?: NftSimState) {
  const totalBuyCount = user?.totalBuyCount ?? wallet.buyCount;
  const totalSellCount = user?.totalSellCount ?? wallet.sellCount;
  const capitalUnlocked = user?.capitalUnlocked ?? wallet.isCapitalUnlocked;
  const dailySnapshot = user && state ? dailyTradeSnapshot(state, user) : null;

  return {
    tradingWallet: wallet.tradingWallet,
    withdrawalWallet: wallet.withdrawalWallet,
    gxnTokenBalance: wallet.gxnTokenBalance,
    gxnTokenValueUsd: GXN_TOKEN_VALUE_USD,
    gxnTokenUsdValue: roundAmount(wallet.gxnTokenBalance * GXN_TOKEN_VALUE_USD),
    totalDeposited: wallet.totalDeposited,
    buyCount: totalBuyCount,
    sellCount: totalSellCount,
    totalBuyCount,
    totalSellCount,
    dailyBuyCount: dailySnapshot?.dailyBuyCount ?? user?.dailyBuyCount ?? 0,
    dailySellCount: dailySnapshot?.dailySellCount ?? user?.dailySellCount ?? 0,
    lastTradeResetAt: user?.lastTradeResetAt ?? null,
    tradeLimits: user && dailySnapshot
      ? dailySnapshot
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

function safeProgressCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

function botSubscriptionProgress(state: NftSimState | null, subscription: BotSubscriptionRecord) {
  const buyLimit = safeProgressCount(subscription.totalBuyTrades);
  const sellLimit = safeProgressCount(subscription.totalSellTrades);
  const linkedBotTrades = state
    ? state.nft_trades.filter(
        (item) =>
          item.userId === subscription.userId &&
          item.source === "bot" &&
          item.botSubscriptionId === subscription.id,
      )
    : [];
  const lifetimeBotTrades = state
    ? state.nft_trades.filter(
        (item) =>
          item.userId === subscription.userId &&
          item.source === "bot",
      )
    : [];
  const tradeSource = linkedBotTrades.length > 1 ? linkedBotTrades : lifetimeBotTrades;
  const tradeBuyCount = tradeSource.length;
  const tradeSellCount = tradeSource.filter((item) => item.status === "auto_sold").length;
  const completedActivities = state
    ? state.bot_activity.filter(
        (item) =>
          item.userId === subscription.userId &&
          item.botSubscriptionId === subscription.id &&
          (item.status === "SUCCESS" || item.status === "COMPLETED"),
      )
    : [];
  const activityBuyCount = completedActivities.filter((item) => item.action === "AUTO_BUY").length;
  const activitySellCount = completedActivities.filter((item) => item.action === "AUTO_SELL").length;
  const storedBuyCount = safeProgressCount(subscription.completedBuyTrades);
  const storedSellCount = safeProgressCount(subscription.completedSellTrades);
  const totalBuyTradesCompleted = Math.max(tradeBuyCount, activityBuyCount, storedBuyCount);
  const totalSellTradesCompleted = Math.max(tradeSellCount, activitySellCount, storedSellCount);
  const remainingTrades =
    Math.max(0, buyLimit - totalBuyTradesCompleted) +
    Math.max(0, sellLimit - totalSellTradesCompleted);
  const totalLimit = buyLimit + sellLimit;
  const progressPercent =
    totalLimit > 0
      ? Math.min(
          100,
          Math.floor(((totalBuyTradesCompleted + totalSellTradesCompleted) / totalLimit) * 100),
        )
      : 0;

  return {
    totalBuyTradesCompleted,
    totalSellTradesCompleted,
    buyLimit,
    sellLimit,
    remainingTrades,
    progressPercent,
  };
}

function logBotProgress(subscription: BotSubscriptionRecord, progress: ReturnType<typeof botSubscriptionProgress>) {
  console.info("[bot.progress.api]", {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    completedBuys: progress.totalBuyTradesCompleted,
    completedSells: progress.totalSellTradesCompleted,
    buyLimit: progress.buyLimit,
    sellLimit: progress.sellLimit,
    remainingTrades: progress.remainingTrades,
    progressPercent: progress.progressPercent,
  });
}

function toPublicBotSubscription(subscription: BotSubscriptionRecord, state: NftSimState | null = null, shouldLogProgress = false) {
  const progress = botSubscriptionProgress(state, subscription);
  const totalCycles = Math.min(progress.buyLimit, progress.sellLimit);
  const completedCycles = Math.min(
    progress.totalBuyTradesCompleted,
    progress.totalSellTradesCompleted,
  );

  if (shouldLogProgress) {
    logBotProgress(subscription, progress);
  }

  return {
    ...subscription,
    completedBuyTrades: progress.totalBuyTradesCompleted,
    completedSellTrades: progress.totalSellTradesCompleted,
    remainingBuyTrades: Math.max(0, progress.buyLimit - progress.totalBuyTradesCompleted),
    remainingSellTrades: Math.max(0, progress.sellLimit - progress.totalSellTradesCompleted),
    totalCycles,
    completedCycles,
    ...progress,
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

function sourceTradeIsBot(state: NftSimState, entry: IncomeLedgerRecord) {
  const trade = state.nft_trades.find((item) => item.id === entry.sourceTradeId);
  return trade?.source === "bot";
}

function isNftTradingIncomeEntry(entry: IncomeLedgerRecord) {
  return entry.type === "NFT_TRADING_INCOME" || entry.type === "BOT_TRADING_INCOME";
}

function vipConfig(level: number) {
  return VIP_LEVELS.find((item) => item.level === level) ?? null;
}

function confirmedDepositAmountForUser(state: NftSimState, userId: string) {
  return roundAmount(
    state.deposits
      .filter(
        (deposit) =>
          deposit.userId === userId &&
          deposit.status === "confirmed" &&
          typeof deposit.creditedAmount === "number",
      )
      .reduce((total, deposit) => total + (deposit.creditedAmount ?? 0), 0),
  );
}

function qualifiedPackageAmountForUser(state: NftSimState, userId: string) {
  const user = state.users.find((item) => item.id === userId);
  const wallet = state.wallets.find((item) => item.userId === userId);
  const selfPackageAmount = user?.selfPackageAmount ?? 0;
  const totalDeposited = wallet?.totalDeposited ?? 0;
  const tradingWalletFundedAmount = wallet?.tradingWallet ?? 0;

  return roundAmount(
    Math.max(
      selfPackageAmount,
      totalDeposited,
      confirmedDepositAmountForUser(state, userId),
      tradingWalletFundedAmount,
    ),
  );
}

function qualifiedPackageUsersAtLevel(
  state: NftSimState,
  ancestorUserId: string,
  level: number,
  minimumPackageAmount: number,
) {
  const qualifiedUserIds = new Set(
    state.users
      .filter((user) => qualifiedPackageAmountForUser(state, user.id) >= minimumPackageAmount)
      .map((user) => user.id),
  );

  return state.mlm_tree.filter(
    (item) =>
      item.ancestorUserId === ancestorUserId &&
      item.level === level &&
      qualifiedUserIds.has(item.userId),
  ).length;
}

function qualifiedPackageSalesAtLevel(
  state: NftSimState,
  ancestorUserId: string,
  level: number,
  minimumPackageAmount: number,
) {
  return roundAmount(
    state.mlm_tree
      .filter((item) => item.ancestorUserId === ancestorUserId && item.level === level)
      .reduce((total, item) => {
        const qualifiedAmount = qualifiedPackageAmountForUser(state, item.userId);
        return qualifiedAmount >= minimumPackageAmount ? total + qualifiedAmount : total;
      }, 0),
  );
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
  const userQualifiedAmount = qualifiedPackageAmountForUser(state, user.id);
  let level = 0;

  if (
    userQualifiedAmount >= 100 &&
    qualifiedPackageUsersAtLevel(state, user.id, 1, minimumPackageAmount) >= 5 &&
    qualifiedPackageUsersAtLevel(state, user.id, 2, minimumPackageAmount) >= 10
  ) {
    level = 1;
  }

  for (const item of VIP_LEVELS.slice(1)) {
    if (userQualifiedAmount < item.selfPackageAmount) {
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
  const userQualifiedAmount = qualifiedPackageAmountForUser(state, user.id);

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
        selfPackageAmount: userQualifiedAmount,
        selfPackageRequired: config.selfPackageAmount,
        qualifiedLevel1Users: qualifiedPackageUsersAtLevel(state, user.id, 1, minimumPackageAmount),
        qualifiedLevel1Required: 5,
        qualifiedLevel2Users: qualifiedPackageUsersAtLevel(state, user.id, 2, minimumPackageAmount),
        qualifiedLevel2Required: 10,
        minimumTeamPackageAmount: minimumPackageAmount,
        teamSalesAmount: roundAmount(
          qualifiedPackageSalesAtLevel(state, user.id, 1, minimumPackageAmount) +
            qualifiedPackageSalesAtLevel(state, user.id, 2, minimumPackageAmount),
        ),
      },
    };
  }

  return {
    currentVipLevel: user.currentVipLevel,
    nextVipLevel,
    payoutAmount: config.payoutAmount,
    currentRequirementProgress: {
      selfPackageAmount: userQualifiedAmount,
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

function randomAutoSellDelay(tradeSource: NftTradeRecord["source"]) {
  return tradeSource === "bot"
    ? randomIntegerInRange(
        BOT_AUTO_SELL_DELAY_MIN_MINUTES,
        BOT_AUTO_SELL_DELAY_MAX_MINUTES,
      )
    : randomIntegerInRange(
        MANUAL_AUTO_SELL_DELAY_MIN_MINUTES,
        MANUAL_AUTO_SELL_DELAY_MAX_MINUTES,
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
  return status === "approved" || status === "approved_pending_tx" || status === "completed";
}

function isFinalizedWithdrawal(withdrawal: WithdrawalRecord) {
  return (
    withdrawal.status === "completed" ||
    (withdrawal.payoutStatus === "PAID" && withdrawal.onChainStatus === "CONFIRMED")
  );
}

function isSuccessfulWithdrawal(withdrawal: WithdrawalRecord) {
  return (
    withdrawal.status === "completed" ||
    withdrawal.payoutStatus === "PAID" ||
    withdrawal.onChainStatus === "CONFIRMED"
  );
}

function isAlreadyProcessedPayoutError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("already processed");
}

function finalizePaidWithdrawal(
  state: NftSimState,
  withdrawal: WithdrawalRecord,
  txHash?: string | null,
) {
  const wasFinalized = isFinalizedWithdrawal(withdrawal);
  const normalizedTxHash = txHash?.toLowerCase() ?? withdrawal.payoutTxHash ?? withdrawal.withdrawalTxHash ?? null;

  if (!wasFinalized) {
    state.system_reserve.balance = roundAmount(
      state.system_reserve.balance - withdrawal.netAmount,
    );
    state.system_reserve.updatedAt = nowIso();
  }

  withdrawal.status = "completed";
  withdrawal.approvedAt = withdrawal.approvedAt ?? nowIso();
  withdrawal.payoutStatus = "PAID";
  withdrawal.onChainStatus = "CONFIRMED";
  withdrawal.payoutTxHash = normalizedTxHash;
  withdrawal.withdrawalTxHash = normalizedTxHash;

  return {
    message: "Withdrawal approved and paid on-chain.",
    withdrawal,
    authorizationTxHash: normalizedTxHash,
    payoutTxHash: normalizedTxHash,
  };
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

function parseBotPackageAmount(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const amount = Number(value.trim());
    return Number.isFinite(amount) ? amount : null;
  }

  return null;
}

function normalizeBotPackageIdentifier(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function botPlanFromIdentifier(identifier: string | undefined) {
  if (!identifier) {
    return null;
  }

  const normalized = normalizeBotPackageIdentifier(identifier);
  return (
    Object.values(BOT_PLANS).find((plan) => {
      const normalizedPlanId = normalizeBotPackageIdentifier(plan.planId);
      const normalizedPlanName = normalizeBotPackageIdentifier(plan.planName);
      const normalizedPrice = String(plan.price);

      return (
        normalized === normalizedPlanId ||
        normalized === normalizedPlanName ||
        normalized === normalizedPrice ||
        normalized === `$${normalizedPrice}` ||
        normalized === `gainix bot $${normalizedPrice}`
      );
    }) ?? null
  );
}

function resolveBotPlan(input: BuyBotInput) {
  const identifierPlan = botPlanFromIdentifier(input.planId) ?? botPlanFromIdentifier(input.packageId);
  const amount = parseBotPackageAmount(input.amount);
  const price = parseBotPackageAmount(input.price);
  const amountPlan =
    typeof amount === "number"
      ? botPlanFromAmount(amount)
      : typeof price === "number"
        ? botPlanFromAmount(price)
        : null;

  if (identifierPlan && amountPlan && identifierPlan.planId !== amountPlan.planId) {
    return null;
  }

  return identifierPlan ?? amountPlan;
}

function botPackageInputValue(input: BuyBotInput) {
  return input.planId ?? input.packageId ?? input.price ?? input.amount ?? "missing";
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

  if (activeBotTradeForUser(state, subscription.userId)) {
    return false;
  }

  return combinedWalletBalance(wallet) > 0;
}

function combinedWalletBalance(wallet: WalletRecord) {
  return roundAmount(Math.max(wallet.tradingWallet, 0) + Math.max(wallet.withdrawalWallet, 0));
}

function calculateNftPaymentSplit(wallet: WalletRecord, price: number) {
  const purchaseTotal = roundAmount(price);
  const tradingBalance = roundAmount(Math.max(wallet.tradingWallet, 0));
  const incomeBalance = roundAmount(Math.max(wallet.withdrawalWallet, 0));
  const combinedBalance = roundAmount(tradingBalance + incomeBalance);
  const tradingDebit = roundAmount(Math.min(tradingBalance, purchaseTotal));
  const incomeDebit = roundAmount(Math.max(purchaseTotal - tradingDebit, 0));

  return {
    purchaseTotal,
    tradingDebit,
    incomeDebit,
    combinedBalance,
  };
}

function logNftPaymentSplit(split: ReturnType<typeof calculateNftPaymentSplit>) {
  console.info(`[payment.split] price=${split.purchaseTotal}`);
  console.info(`[payment.split] tradingDebit=${split.tradingDebit}`);
  console.info(`[payment.split] incomeDebit=${split.incomeDebit}`);
  console.info(`[payment.split] combinedBalance=${split.combinedBalance}`);
}

function buyNft(
  state: NftSimState,
  user: UserRecord,
  wallet: WalletRecord,
  input: BuyNftInput,
) {
  const nft = requireNft(state, input.nftId);
  assertDailyTradeLimit(state, user, "buy");

  if (nft.status !== "marketplace") {
    throw new ApiError(409, "NFT is not available in the marketplace.");
  }

  const paymentSplit = calculateNftPaymentSplit(wallet, nft.currentPrice);
  logNftPaymentSplit(paymentSplit);

  if (paymentSplit.combinedBalance < paymentSplit.purchaseTotal) {
    throw new ApiError(409, "Insufficient balance");
  }

  if (input.source === "bot" && input.botSubscriptionId) {
    const existingBotTrade = activeBotTradeForUser(state, user.id);
    if (existingBotTrade) {
      console.info(`[bot.buy] skipped existing pending trade userId=${user.id}`);
      throw new ApiError(409, "Bot already has a pending NFT trade.");
    }

    const subscription = state.bot_subscriptions.find(
      (item) => item.id === input.botSubscriptionId,
    );
    if (!subscription || subscription.status !== "active" || subscription.remainingBuyTrades <= 0) {
      throw new ApiError(409, "Bot buy capacity exhausted.");
    }
  }

  const now = nowIso();
  const buyPrice = paymentSplit.purchaseTotal;
  const priceUpdate = priceAfterMarketBuy(state, buyPrice);

  wallet.tradingWallet = roundAmount(wallet.tradingWallet - paymentSplit.tradingDebit);
  wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet - paymentSplit.incomeDebit);
  if (wallet.tradingWallet < 0 || wallet.withdrawalWallet < 0) {
    throw new ApiError(409, "Insufficient balance");
  }
  user.totalBuyCount += 1;
  user.dailyBuyCount += 1;
  wallet.updatedAt = now;
  refreshCapitalUnlock(user, wallet);

  const sharedDebitMetadata = {
    nftId: nft.id,
    tradeSource: input.source ?? "manual",
    nftPurchaseTotal: buyPrice,
    tradingDebit: paymentSplit.tradingDebit,
    incomeDebit: paymentSplit.incomeDebit,
    combinedBalanceBefore: paymentSplit.combinedBalance,
    buyCount: user.totalBuyCount,
    dailyBuyCount: user.dailyBuyCount,
    dailyBuyLimit: tradeLimitsForUser(user).dailyBuyLimit,
    tradingWalletAfter: wallet.tradingWallet,
    incomeWalletAfter: wallet.withdrawalWallet,
  };

  if (paymentSplit.tradingDebit > 0) {
    pushWalletLedger(state, {
      userId: user.id,
      type: "NFT_BUY_DEBIT",
      amount: paymentSplit.tradingDebit,
      referenceId: nft.id,
      metadata: {
        ...sharedDebitMetadata,
        title: "NFT Purchase Trading Wallet Debit",
        description: `Trading Wallet debit $${paymentSplit.tradingDebit} of $${buyPrice} NFT purchase`,
        sourceWallet: "TRADING",
        walletAffected: "Trading Wallet",
      },
    });
  }

  if (paymentSplit.incomeDebit > 0) {
    pushWalletLedger(state, {
      userId: user.id,
      type: "NFT_BUY_DEBIT",
      amount: paymentSplit.incomeDebit,
      referenceId: nft.id,
      metadata: {
        ...sharedDebitMetadata,
        title: "NFT Purchase Income Wallet Debit",
        description: `Income Wallet debit $${paymentSplit.incomeDebit} of $${buyPrice} NFT purchase`,
        sourceWallet: "INCOME",
        walletAffected: "Income Wallet",
      },
    });
  }

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
    cycleId: input.cycleId ?? null,
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
  syncDailyTradeCountsFromTrades(state, user);

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
  assertDailyTradeLimit(state, user, "sell");

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
      : randomAutoSellDelay(trade.source);

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
  cycleId: string | null,
) {
  pushBotActivity(state, {
    userId,
    botSubscriptionId,
    nftId,
    action: "AUTO_LIST",
    amount,
    profit: null,
    status: "WAITING",
    cycleId,
  });
  console.info("[bot.cycle] list", {
    userId,
    subscriptionId: botSubscriptionId,
    nftId,
    cycleId,
  });
  console.info("[bot.timeline] listed", {
    userId,
    subscriptionId: botSubscriptionId,
    nftId,
    amount,
  });
}

function triggerDelayedBotList(state: NftSimState, trade: NftTradeRecord) {
  if (trade.source !== "bot" || !trade.botSubscriptionId || trade.status !== "bought") {
    return false;
  }

  const nft = state.nfts.find((item) => item.id === trade.nftId);
  if (!nft || nft.status !== "owned" || nft.ownerUserId !== trade.userId) {
    return false;
  }

  listNft(state, nft, trade);
  recordBotListActivity(
    state,
    trade.userId,
    trade.botSubscriptionId,
    nft.id,
    nft.currentPrice,
    trade.cycleId,
  );
  console.info("[bot.timeline] sell scheduled for", {
    userId: trade.userId,
    subscriptionId: trade.botSubscriptionId,
    tradeId: trade.id,
    nftId: nft.id,
    autoSellAt: trade.autoSellAt,
  });
  return true;
}

function checkWithdrawalApprovalSafety(
  state: NftSimState,
  payload: {
    userId: string;
    amount: number;
    payoutType: string;
    referenceId: string;
  },
) {
  const amount = roundAmount(payload.amount);

  if (amount <= 0) {
    return false;
  }

  if (state.system_reserve.balance < amount) {
    pushSafetyLog(state, {
      eventType: "BLOCKED_PAYOUT",
      userId: payload.userId,
      amount,
      reason: "Insufficient system reserve.",
      metadata: {
        payoutType: payload.payoutType,
        referenceId: payload.referenceId,
        reserveBalance: state.system_reserve.balance,
        requiredReserve: amount,
        availableReserve: state.system_reserve.balance,
      },
    });
    return false;
  }

  return true;
}

function processDueBotListings(state: NftSimState, currentTime: Date) {
  const listedTradeIds: string[] = [];

  for (const trade of state.nft_trades) {
    if (trade.source !== "bot" || trade.status !== "bought") {
      continue;
    }

    if (currentTime.getTime() - new Date(trade.createdAt).getTime() < BOT_LIST_DELAY_MS) {
      continue;
    }

    if (triggerDelayedBotList(state, trade)) {
      listedTradeIds.push(trade.id);
      scheduledBotListTradeIds.delete(trade.id);
    }
  }

  return listedTradeIds;
}

function scheduleBotListAfterDelay(tradeId: string) {
  if (scheduledBotListTradeIds.has(tradeId)) {
    return;
  }

  scheduledBotListTradeIds.add(tradeId);
  setTimeout(() => {
    withStoreTransaction((state) => {
      const trade = state.nft_trades.find((item) => item.id === tradeId);
      if (!trade) {
        scheduledBotListTradeIds.delete(tradeId);
        return { listed: false };
      }

      const listed = triggerDelayedBotList(state, trade);
      scheduledBotListTradeIds.delete(tradeId);
      return { listed };
    }).catch(() => {
      scheduledBotListTradeIds.delete(tradeId);
    });
  }, BOT_LIST_DELAY_MS);
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

  if (!canUseDailyTrade(state, user, "sell")) {
    logBotSchedulerSkip("Daily limit reached. Bot will resume after reset.", {
      userId: trade.userId,
      subscriptionId: trade.botSubscriptionId,
      tradeId: trade.id,
      nftId: trade.nftId,
      tradeSource: trade.source,
      side: "sell",
      dailySellCount: user.dailySellCount,
      dailySellLimit: tradeLimitsForUser(user).dailySellLimit,
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
    ? reserveFundedAmount(state, rawProfit, "totalNftTradingPaid", {
        userId: trade.userId,
        payoutType: "NFT_TRADING_INCOME",
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
      type: "NFT_TRADING_INCOME",
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
  syncDailyTradeCountsFromTrades(state, user);

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
        cycleId: trade.cycleId,
      });
      console.info("[bot.cycle] sell", {
        userId: trade.userId,
        subscriptionId: subscription.id,
        tradeId: trade.id,
        nftId: trade.nftId,
        cycleId: trade.cycleId,
      });
      console.info("[bot.timeline] sold completed", {
        userId: trade.userId,
        subscriptionId: subscription.id,
        tradeId: trade.id,
        nftId: trade.nftId,
        profit,
        soldAt: now,
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
  if (subscription.activatedByAdmin) {
    subscription.uplineIncomePaidAt = nowIso();
    subscription.updatedAt = nowIso();
    return null;
  }

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
  const selectionMessages: string[] = [];

  if (state.admin_settings.systemStopped) {
    for (const subscription of state.bot_subscriptions.filter((item) => item.status === "active")) {
      logBotSchedulerSkip("System emergency stop is active.", {
        userId: subscription.userId,
        subscriptionId: subscription.id,
      });
    }
    return { executions, selectionMessages };
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

    const existingSubscriptionTrade = activeTradeForBotSubscription(state, subscription.id);
    const existingUserBotTrade = activeBotTradeForUser(state, subscription.userId);
    const existingPendingTrade = existingUserBotTrade ?? existingSubscriptionTrade ?? null;
    if (existingPendingTrade) {
      console.info(`[bot.buy] skipped existing pending trade userId=${subscription.userId}`);
      logBotSchedulerSkip("Bot cycle cooldown: active trade is still open.", {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        tradeId: existingPendingTrade.id,
        nftId: existingPendingTrade.nftId,
        tradeStatus: existingPendingTrade.status,
        autoSellAt: existingPendingTrade.autoSellAt,
      });
      continue;
    }

    const combinedBalance = combinedWalletBalance(wallet);
    if (combinedBalance < state.admin_settings.minimumTradeAmount) {
      logBotSchedulerSkip("Combined wallet balance is below minimum trade amount.", {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        tradingWallet: wallet.tradingWallet,
        incomeWallet: wallet.withdrawalWallet,
        combinedBalance,
        minimumTradeAmount: state.admin_settings.minimumTradeAmount,
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

    if (activeBotBuyUserIds.has(user.id)) {
      logBotSchedulerSkip("Bot buy already running for user.", {
        userId: user.id,
        subscriptionId: subscription.id,
      });
      continue;
    }

    const cycleSequence = `${subscription.id}:${subscription.completedBuyTrades + 1}`;
    const cycleId = makeId("cycle");
    const idempotencyKey = `bot_buy:${user.id}:${cycleSequence}`;
    const duplicateBuy = state.safety_logs.some(
      (item) =>
        item.eventType === "BOT_BUY_IDEMPOTENCY" &&
        item.userId === user.id &&
        item.metadata.idempotencyKey === idempotencyKey,
    );
    if (duplicateBuy) {
      logBotSchedulerSkip("Duplicate bot buy cycle skipped.", {
        userId: user.id,
        subscriptionId: subscription.id,
        idempotencyKey,
      });
      continue;
    }

    if (!canUseDailyTrade(state, user, "buy") || !canUseDailyTrade(state, user, "sell")) {
      logBotSchedulerSkip("Daily limit reached. Bot will resume after reset.", {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        dailyBuyCount: user.dailyBuyCount,
        dailySellCount: user.dailySellCount,
        ...tradeLimitsForUser(user),
      });
      if (!selectionMessages.includes("Daily limit reached. Bot will resume after reset.")) {
        selectionMessages.push("Daily limit reached. Bot will resume after reset.");
      }
      continue;
    }

    const nft = state.nfts
      .filter(
        (item) =>
          item.status === "marketplace" &&
          !isLegacyDemoMarketplaceNft(item) &&
          item.currentPrice <= combinedBalance,
      )
      .sort((a, b) => b.currentPrice - a.currentPrice)[0];

    if (!nft) {
      selectionMessages.push(NO_SUITABLE_NFT_MESSAGE);
      logBotSchedulerSkip(NO_SUITABLE_NFT_MESSAGE, {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        tradingWallet: wallet.tradingWallet,
        incomeWallet: wallet.withdrawalWallet,
        combinedBalance,
      });
      continue;
    }

    activeBotBuyUserIds.add(user.id);
    console.info(`[bot.buy] locked user=${user.id} subscription=${subscription.id}`);
    let buyResult: ReturnType<typeof buyNft>;
    try {
      const existingTradeInsideLock = activeBotTradeForUser(state, user.id);
      if (existingTradeInsideLock) {
        console.info(`[bot.buy] skipped existing pending trade userId=${user.id}`);
        logBotSchedulerSkip("Bot cycle cooldown: active trade is still open.", {
          userId: user.id,
          subscriptionId: subscription.id,
          tradeId: existingTradeInsideLock.id,
          nftId: existingTradeInsideLock.nftId,
          tradeStatus: existingTradeInsideLock.status,
          autoSellAt: existingTradeInsideLock.autoSellAt,
        });
        continue;
      }

      console.info(`[bot.buy] balance=${combinedBalance} selected=${nft.currentPrice} nftId=${nft.id}`);
      buyResult = buyNft(state, user, wallet, {
        nftId: nft.id,
        userId: user.id,
        source: "bot",
        botSubscriptionId: subscription.id,
        cycleId,
      });
    } finally {
      activeBotBuyUserIds.delete(user.id);
    }
    subscription.remainingBuyTrades -= 1;
    subscription.completedBuyTrades += 1;
    subscription.lastExecutedAt = nowIso();
    subscription.updatedAt = nowIso();
    markBotSubscriptionCompleteIfDone(state, subscription);

    pushBotActivity(state, {
      userId: user.id,
      botSubscriptionId: subscription.id,
      nftId: buyResult.nft.id,
      action: "AUTO_BUY",
      amount: buyResult.trade.buyPrice,
      profit: null,
      status: "SUCCESS",
      cycleId,
    });
    console.info("[bot.timeline] buy", {
      userId: user.id,
      subscriptionId: subscription.id,
      tradeId: buyResult.trade.id,
      nftId: buyResult.nft.id,
      cycleId,
      amount: buyResult.trade.buyPrice,
    });
    console.info("[bot.cycle] created", {
      userId: user.id,
      subscriptionId: subscription.id,
      tradeId: buyResult.trade.id,
      nftId: buyResult.nft.id,
      cycleId,
    });
    pushSafetyLog(state, {
      eventType: "BOT_BUY_IDEMPOTENCY",
      userId: user.id,
      amount: buyResult.trade.buyPrice,
      reason: "Bot buy cycle completed.",
      metadata: {
        idempotencyKey,
        cycleId,
        subscriptionId: subscription.id,
        tradeId: buyResult.trade.id,
        nftId: buyResult.nft.id,
      },
    });
    console.info(`[bot.buy] purchased one nft=${buyResult.nft.id} userId=${user.id} tradeId=${buyResult.trade.id} idempotencyKey=${idempotencyKey}`);

    executions.push({
      subscriptionId: subscription.id,
      tradeId: buyResult.trade.id,
      nftId: buyResult.nft.id,
    });
    scheduleBotListAfterDelay(buyResult.trade.id);
    return { executions, selectionMessages };
  }

  return { executions, selectionMessages };
}

export async function registerUser(input: RegisterUserInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    if (!walletAddress) {
      throw new ApiError(400, "walletAddress is required.");
    }

    const referralCodeUsed = normalizeReferralCode(input.ref);
    if (isReferralRequired && !referralCodeUsed) {
      throw new ApiError(400, "Invalid or missing referral code");
    }

    const existingUser = state.users.find(
      (item) => normalizeWalletAddress(item.walletAddress) === walletAddress,
    );
    if (existingUser) {
      throw new ApiError(409, "Wallet is already registered.");
    }

    const sponsor = referralCodeUsed ? findReferralUser(state, referralCodeUsed) : null;
    if (isReferralRequired && !sponsor) {
      throw new ApiError(400, "Invalid or missing referral code");
    }

    if (sponsor && normalizeWalletAddress(sponsor.walletAddress) === walletAddress) {
      throw new ApiError(409, "Self-referral is not allowed.");
    }

    const sponsorUserId = sponsor?.id ?? null;

    const now = nowIso();
    const userId = makeId("user");
    const user: UserRecord = {
      id: userId,
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
      registrationBonusGiven: false,
      referralCode: createReferralCode(walletAddress),
      referredBy: sponsorUserId,
      referralCodeUsed,
      createdAt: now,
    };
    const wallet = createUserWallet(now, user.id);

    state.users.push(user);
    state.wallets.push(wallet);
    createMlmRelations(state, user.id, sponsorUserId, now);
    applyRegistrationBonus(state, user, wallet);

    return {
      message: "User registered successfully.",
      user,
      sponsorUserId,
      wallet: toPublicWallet(wallet, user, state),
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
      wallet: toPublicWallet(wallet, user, state),
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
      wallet: toPublicWallet(wallet, user, state),
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
      wallet: toPublicWallet(result.wallet, user, state),
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
    console.info(`[bot.buy] user = ${user.id}`);
    console.info(`[bot.buy] balance = ${wallet.tradingWallet}`);

    const plan = resolveBotPlan(input);
    if (!plan) {
      const packageValue = botPackageInputValue(input);
      console.warn(`[bot.buy] failed reason = Invalid bot package: ${packageValue}`);
      throw new ApiError(400, `Invalid bot package: ${packageValue}`);
    }
    console.info(`[bot.buy] package resolved=${plan.planId}`);

    const matchedPlan = botPlanFromAmount(plan.price);
    if (!matchedPlan || matchedPlan.planId !== plan.planId) {
      const packageValue = botPackageInputValue(input);
      console.warn(`[bot.buy] failed reason = Invalid bot package: ${packageValue}`);
      throw new ApiError(400, `Invalid bot package: ${packageValue}`);
    }

    const activeSamePlanSubscription = state.bot_subscriptions.find(
      (item) => item.userId === user.id && item.planId === plan.planId && item.status === "active",
    );
    if (activeSamePlanSubscription) {
      console.warn("[bot.buy] failed reason = You already have an active bot subscription.");
      throw new ApiError(409, "You already have an active bot subscription.", {
        subscriptionId: activeSamePlanSubscription.id,
      });
    }

    if (wallet.tradingWallet < plan.price) {
      console.warn("[bot.buy] failed reason = Insufficient balance");
      throw new ApiError(400, "Insufficient balance");
    }

    wallet.tradingWallet = roundAmount(wallet.tradingWallet - plan.price);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: user.id,
      type: "BOT_PURCHASE_DEBIT",
      amount: plan.price,
      referenceId: plan.planId,
      metadata: {
        historyType: "BOT_PURCHASE",
        title: "Bot Subscription Purchased",
        description: `${formatShortWalletAddress(user.walletAddress)} bought ${plan.planName} for $${plan.price}`,
        displayStatus: "Active",
        walletShortAddress: formatShortWalletAddress(user.walletAddress),
        planName: plan.planName,
        buyLimit: plan.buyTrades,
        sellLimit: plan.sellTrades,
        tradingWalletAfter: wallet.tradingWallet,
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
      activatedByAdmin: false,
      purchasedAt: nowIso(),
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    state.bot_subscriptions.push(subscription);
    user.selfPackageAmount = roundAmount(user.selfPackageAmount + plan.price);
    refreshVipLevels(state);
    const uplineIncome = processBotPurchaseUplineIncome(state, user.id, subscription);
    console.info(`[bot.buy] success=${subscription.id}`);

    return {
      message: "Bot subscription activated.",
      user,
      wallet: toPublicWallet(wallet, user, state),
      subscription: toPublicBotSubscription(subscription, state),
      uplineIncome,
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function assertRegisteredWalletForBotBuy(walletAddress: string) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, { walletAddress });
    return {
      id: user.id,
      walletAddress: user.walletAddress,
    };
  });
}

export async function processTradingEngineTick() {
  if (botExecutionRunning) {
    return {
      serverTime: nowIso(),
      settledSales: [],
      botExecutions: [],
      botSelectionMessages: ["Bot execution already running."],
      dueBotListTradeIds: [],
      royaltyPayouts: [],
    };
  }

  botExecutionRunning = true;
  await ensureStoreInitialized();

  try {
    return await withStoreTransaction(async (state) => {
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
          botSelectionMessages: [],
          dueBotListTradeIds: [],
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

      const dueBotListTradeIds = processDueBotListings(state, currentTime);
      const botCycle = executeBotCycleInternal(state);
      refreshVipLevels(state);
      const royaltyPayouts = processRoyaltyPayouts(state, currentTime);

      return {
        serverTime: currentTime.toISOString(),
        settledSales,
        botExecutions: botCycle.executions,
        botSelectionMessages: botCycle.selectionMessages,
        dueBotListTradeIds,
        royaltyPayouts,
      };
    }, { lockActiveBotRows: true });
  } finally {
    botExecutionRunning = false;
  }
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
      wallet: toPublicWallet(wallet, user, state),
    };
  });
}

export async function requestWithdrawal(input: WithdrawInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.amount, "Withdrawal amount");

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const amount = roundAmount(input.amount);
    const minimum = MIN_WITHDRAWAL_AMOUNT;
    const feePercent = state.admin_settings.withdrawalFeePercent;

    console.info("[withdraw.request] wallet=", user.walletAddress, "amount=", amount, "userId=", user.id);

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
      throw new ApiError(400, `Minimum withdrawal amount is $${minimum}`);
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
    const activeTodaysWithdrawals = todaysWithdrawals.filter(
      (item) => !isFailedWithdrawal(item),
    );

    if (activeTodaysWithdrawals.length >= DAILY_WITHDRAWAL_LIMIT) {
      pushSafetyLog(state, {
        eventType: "BLOCKED_WITHDRAWAL",
        userId: user.id,
        amount,
        reason: "Maximum 3 withdrawals per day allowed.",
        metadata: {
          dailyWithdrawalLimit: DAILY_WITHDRAWAL_LIMIT,
          withdrawalCountToday: activeTodaysWithdrawals.length,
          existingWithdrawalIds: activeTodaysWithdrawals.map((item) => item.id).join(","),
        },
      });
      throw new ApiError(409, "Maximum 3 withdrawals per day allowed.");
    }

    const withdrawnToday = roundAmount(
      activeTodaysWithdrawals.reduce((total, item) => total + item.grossAmount, 0),
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
    const gxnDeductionAmount = roundAmount(amount * (GXN_WITHDRAWAL_DEDUCTION_PERCENT / 100));
    const gxnTokens = roundAmount(gxnDeductionAmount / GXN_TOKEN_VALUE_USD);
    const netAmount = roundAmount(amount - feeAmount - gxnDeductionAmount);
    const withdrawal: WithdrawalRecord = {
      id: makeId("withdrawal"),
      userId: user.id,
      grossAmount: amount,
      feeAmount,
      gxnDeductionAmount,
      gxnTokens,
      netAmount,
      status: "requested",
      approvedAt: null,
      payoutTxHash: null,
      payoutStatus: "NOT_STARTED",
      withdrawalTxHash: null,
      onChainStatus: "PENDING",
      createdAt: nowIso(),
    };

    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet - amount);
    wallet.gxnTokenBalance = roundAmount(wallet.gxnTokenBalance + gxnTokens);
    wallet.updatedAt = nowIso();
    state.withdrawals.push(withdrawal);

    pushWalletLedger(state, {
      userId: user.id,
      type: "WITHDRAWAL_REQUEST",
      amount: netAmount,
      referenceId: withdrawal.id,
      metadata: {
        grossAmount: amount,
        feeAmount,
        gxnDeductionAmount,
        gxnTokens,
        netAmount,
        withdrawalWalletAfter: wallet.withdrawalWallet,
        gxnTokenBalanceAfter: wallet.gxnTokenBalance,
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

    pushWalletLedger(state, {
      userId: user.id,
      type: "GXN_TOKEN_DEDUCTION",
      amount: gxnDeductionAmount,
      referenceId: withdrawal.id,
      metadata: {
        deductionPercent: GXN_WITHDRAWAL_DEDUCTION_PERCENT,
        gxnTokenValueUsd: GXN_TOKEN_VALUE_USD,
        gxnTokens,
      },
    });

    pushWalletLedger(state, {
      userId: user.id,
      type: "GXN_TOKEN_REWARD",
      amount: gxnTokens,
      referenceId: withdrawal.id,
      metadata: {
        gxnDeductionAmount,
        gxnTokenValueUsd: GXN_TOKEN_VALUE_USD,
        gxnTokenBalanceAfter: wallet.gxnTokenBalance,
      },
    });

    return {
      message: "Withdrawal request created.",
      user,
      wallet: toPublicWallet(wallet, user, state),
      withdrawal,
      settings: toPublicSettings(state.admin_settings),
    };
  });
}

export async function getMarketplaceNfts() {
  await ensureStoreInitialized();
  await processTradingEngineTick();
  const state = await readState();
  const marketplaceNfts = state.nfts.filter(
    (item) => item.status === "marketplace" && !isLegacyDemoMarketplaceNft(item),
  );

  return {
    marketplace: marketplaceNfts.map((item) => toPublicNft(state, item)),
    total: marketplaceNfts.length,
    settings: toPublicSettings(state.admin_settings),
    serverTime: nowIso(),
  };
}

export async function getLatestMarketplaceNfts(limit = 5) {
  await ensureStoreInitialized();
  await processTradingEngineTick();
  const state = await readState();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 20);
  const activeStatuses = new Set(["listed", "marketplace", "live", "active"]);
  const latestListings = state.nfts
    .filter(
      (item) =>
        activeStatuses.has(item.status) &&
        Boolean(item.imageUrl) &&
        !isLegacyDemoMarketplaceNft(item),
    )
    .map((nft) => {
      const latestTrade = state.nft_trades
        .filter((trade) => trade.nftId === nft.id && trade.status === "listed")
        .sort((left, right) =>
          (right.listedAt ?? right.createdAt).localeCompare(left.listedAt ?? left.createdAt),
        )[0];

      return {
        imageUrl: nft.imageUrl,
        sortDate: latestTrade?.listedAt ?? latestTrade?.createdAt ?? nft.createdAt,
      };
    })
    .sort((left, right) => right.sortDate.localeCompare(left.sortDate))
    .slice(0, safeLimit)
    .map(({ imageUrl }) => ({ imageUrl }));

  return {
    nfts: latestListings,
    total: latestListings.length,
  };
}

export async function getAdminNfts() {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const nfts = state.nfts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicNft(state, item));

    return {
      nfts,
      total: nfts.length,
    };
  });
}

export async function createAdminMarketplaceNft(input: AdminCreateNftInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.basePrice, "NFT base price");

  return withStoreTransaction(async (state) => {
    const tokenId = input.tokenId.trim();
    const existing = state.nfts.find((item) => item.tokenId === tokenId);
    if (existing) {
      throw new ApiError(409, "NFT tokenId already exists.");
    }

    const now = nowIso();
    const price = roundAmount(input.basePrice);
    const nft: NftRecord = {
      id: makeId("nft"),
      tokenId,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      imageUrl: input.imageUrl.trim(),
      basePrice: price,
      currentPrice: price,
      lastBuyPrice: null,
      totalTrades: 0,
      status: input.status === "draft" ? "draft" : "marketplace",
      ownerUserId: null,
      lastPriceIncreasePercent: null,
      createdAt: now,
      updatedAt: now,
    };

    state.nfts.push(nft);

    return {
      message:
        input.status === "draft"
          ? "NFT created as draft."
          : "NFT created and listed on marketplace.",
      nft: toPublicNft(state, nft),
    };
  });
}

export async function updateAdminNft(input: AdminUpdateNftInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const nft = requireNft(state, input.nftId);
    if (nft.status !== "draft" && nft.status !== "marketplace") {
      throw new ApiError(409, "Only draft or live marketplace NFTs can be edited.");
    }

    if (typeof input.currentPrice === "number") {
      validatePositiveAmount(input.currentPrice, "NFT price");
      const nextPrice = roundAmount(input.currentPrice);
      nft.currentPrice = nextPrice;
      if (nft.totalTrades === 0) {
        nft.basePrice = nextPrice;
      }
    }

    if (input.status) {
      nft.status = input.status === "draft" ? "draft" : "marketplace";
    }

    nft.updatedAt = nowIso();

    return {
      message: "NFT updated.",
      nft: toPublicNft(state, nft),
    };
  });
}

export async function deleteAdminNft(input: AdminDeleteNftInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const nft = requireNft(state, input.nftId);
    const hasTradeHistory = state.nft_trades.some((trade) => trade.nftId === nft.id);
    if (hasTradeHistory || nft.totalTrades > 0) {
      throw new ApiError(409, "NFT cannot be deleted after trade history exists.");
    }

    state.nfts = state.nfts.filter((item) => item.id !== nft.id);

    return {
      message: "NFT deleted.",
      nftId: nft.id,
    };
  });
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
      wallet: toPublicWallet(wallet, user, state),
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
  "GXN_TOKEN_REWARD",
  "GXN_TOKEN_DEDUCTION",
  "BOT_PURCHASE_DEBIT",
]);

function walletAffectedForLedgerType(type: WalletLedgerRecord["type"]) {
  if (
    type === "DEPOSIT_TO_TRADING" ||
    type === "NFT_BUY_DEBIT" ||
    type === "NFT_SELL_PRINCIPAL_RETURN" ||
    type === "BOT_PURCHASE_DEBIT"
  ) {
    return "Trading Wallet";
  }

  if (type === "GXN_TOKEN_REWARD" || type === "GXN_TOKEN_DEDUCTION") {
    return "GXN Token";
  }

  return "Withdrawal Wallet";
}

function walletAffectedForLedgerEntry(entry: WalletLedgerRecord) {
  if (typeof entry.metadata.walletAffected === "string") {
    return entry.metadata.walletAffected;
  }

  return walletAffectedForLedgerType(entry.type);
}

function statusForLedgerEntry(state: NftSimState, entry: WalletLedgerRecord) {
  if (entry.type === "BOT_PURCHASE_DEBIT") {
    return "Active";
  }

  if (entry.type !== "WITHDRAWAL_REQUEST") {
    return "Completed";
  }

  const withdrawal = state.withdrawals.find((item) => item.id === entry.referenceId);
  if (withdrawal?.status === "approved_pending_tx") {
    return "Approved Pending TX";
  }

  return withdrawal?.status === "approved" ? "Approved" : "Requested";
}

function categoryForLedgerEntry(type: WalletLedgerRecord["type"]) {
  if (
    type === "NFT_BUY_DEBIT" ||
    type === "NFT_SELL_PRINCIPAL_RETURN" ||
    type === "NFT_TRADING_PROFIT"
  ) {
    return "NFT_TRADING";
  }

  if (type === "BOT_PURCHASE_DEBIT" || type === "BOT_TRADING_PROFIT") {
    return "BOT";
  }

  if (type === "BOT_PURCHASE_UPLINE_INCOME" || type === "LEVEL_INCOME") {
    return "REFERRAL";
  }

  if (type === "ROYALTY_INCOME") {
    return "ROYALTY";
  }

  if (type === "DEPOSIT_TO_TRADING") {
    return "DEPOSIT";
  }

  if (
    type === "CAPITAL_TRANSFER" ||
    type === "CAPITAL_TRANSFER_TO_WITHDRAWAL" ||
    type === "WITHDRAWAL_REQUEST" ||
    type === "WITHDRAWAL_FEE"
  ) {
    return "WITHDRAWAL";
  }

  return "BONUS";
}

export async function getWalletHistory(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const entries = state.wallet_ledger
      .filter((item) => item.userId === user.id && WALLET_HISTORY_TYPES.has(item.type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((entry) => {
        const title = typeof entry.metadata.title === "string" ? entry.metadata.title : null;
        const description = typeof entry.metadata.description === "string" ? entry.metadata.description : null;

        return {
          id: entry.id,
          type: entry.type === "BOT_PURCHASE_DEBIT" ? "BOT_PURCHASE" : entry.type,
          title,
          description,
          category: categoryForLedgerEntry(entry.type),
          amount: entry.amount,
          createdAt: entry.createdAt,
          status: statusForLedgerEntry(state, entry),
          walletAffected: walletAffectedForLedgerEntry(entry),
          referenceId: entry.referenceId,
          metadata: entry.metadata,
        };
      });

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

    const nftTradingEntries = entries.filter(isNftTradingIncomeEntry);
    const levelIncomeEntries = entries.filter((item) => item.type === "LEVEL_INCOME");
    const botTradingEntries: IncomeLedgerRecord[] = [];
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
      (item) => item.userId === user.id && isNftTradingIncomeEntry(item),
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
      .map((item) => toPublicBotSubscription(item, state));

    return {
      user,
      wallet: toPublicWallet(wallet, user, state),
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
    const minimumPackageAmount = state.admin_settings.vipMinimumTeamPackageAmount;
    const directs = state.mlm_tree
      .filter((item) => item.ancestorUserId === user.id && item.level === 1)
      .map((item) => state.users.find((entry) => entry.id === item.userId))
      .filter((item): item is UserRecord => Boolean(item));
    const level1Total = directs.length;
    const level1Qualified = qualifiedPackageUsersAtLevel(
      state,
      user.id,
      1,
      minimumPackageAmount,
    );
    const levelBreakdown = MLM_LEVEL_PERCENTAGES.map((_, index) => ({
      level: index + 1,
      downlineCount: state.mlm_tree.filter(
        (item) => item.ancestorUserId === user.id && item.level === index + 1,
      ).length,
      unlocked: unlockedLevels(state, user.id) >= index + 1,
    }));

    console.info(
      `[team.qualified] wallet=${user.walletAddress} level1Total=${level1Total} level1Qualified=${level1Qualified} minPackage=${minimumPackageAmount}`,
    );

    return {
      user,
      sponsor: sponsorUserForUser(state, user.id),
      directs,
      directCount: level1Total,
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

export async function getTeamSummary(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, selector);
    const minimumPackageAmount = state.admin_settings.vipMinimumTeamPackageAmount;
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
    const progress = royaltyProgress(state, user.id);
    const payoutHistory = state.income_ledger
      .filter((item) => item.userId === user.id && item.type === "ROYALTY_INCOME")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      user,
      sponsor: sponsorUserForUser(state, user.id),
      directs,
      directCount: directs.length,
      unlockedLevels: unlockedLevels(state, user.id),
      levelBreakdown,
      vipStatus: progress,
      royalty: {
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
      },
      metrics: {
        minimumPackageAmount,
        level1Qualified: qualifiedPackageUsersAtLevel(
          state,
          user.id,
          1,
          minimumPackageAmount,
        ),
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
      .map((item) => toPublicBotSubscription(item, state, true));
    const todayStart = startOfToday(new Date());
    const botProfitEntries = state.income_ledger.filter(
      (item) =>
        item.userId === user.id &&
        (item.type === "BOT_TRADING_INCOME" ||
          (item.type === "NFT_TRADING_INCOME" && sourceTradeIsBot(state, item))),
    );
    const latestActivity =
      state.bot_activity
        .filter((item) => item.userId === user.id)
        .filter((item) => !(item.status === "SKIPPED" && item.action === "AUTO_BUY" && item.amount === 0 && item.nftId === null))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const currentProgress = subscriptions.find((item) => item.status === "active") ?? subscriptions[0] ?? null;

    return {
      user,
      settings: toPublicSettings(state.admin_settings),
      plans: Object.values(BOT_PLANS).map((plan) => ({
        ...plan,
        totalCycles: Math.min(plan.buyTrades, plan.sellTrades),
      })),
      subscriptions,
      activeSubscriptions: subscriptions.filter((item) => item.status === "active").length,
      totalBuyTradesCompleted: currentProgress?.totalBuyTradesCompleted ?? 0,
      totalSellTradesCompleted: currentProgress?.totalSellTradesCompleted ?? 0,
      buyLimit: currentProgress?.buyLimit ?? 0,
      sellLimit: currentProgress?.sellLimit ?? 0,
      remainingTrades: currentProgress?.remainingTrades ?? 0,
      progressPercent: currentProgress?.progressPercent ?? 0,
      todayBotProfit: sumAmounts(
        botProfitEntries.filter((item) => new Date(item.createdAt) >= todayStart),
      ),
      totalBotProfit: sumAmounts(botProfitEntries),
      latestActivity,
    };
  });
}

export async function getBotSummary(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user } = requireUser(state, selector);
    const subscriptions = state.bot_subscriptions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicBotSubscription(item, state, true));
    const todayStart = startOfToday(new Date());
    const botProfitEntries = state.income_ledger.filter(
      (item) =>
        item.userId === user.id &&
        (item.type === "BOT_TRADING_INCOME" ||
          (item.type === "NFT_TRADING_INCOME" && sourceTradeIsBot(state, item))),
    );
    const activity = state.bot_activity
      .filter((item) => item.userId === user.id)
      .filter((item) => !(item.status === "SKIPPED" && item.action === "AUTO_BUY" && item.amount === 0 && item.nftId === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicBotActivity(state, item));
    const currentProgress = subscriptions.find((item) => item.status === "active") ?? subscriptions[0] ?? null;

    return {
      user,
      settings: toPublicSettings(state.admin_settings),
      plans: Object.values(BOT_PLANS).map((plan) => ({
        ...plan,
        totalCycles: Math.min(plan.buyTrades, plan.sellTrades),
      })),
      subscriptions,
      activeSubscriptions: subscriptions.filter((item) => item.status === "active").length,
      totalBuyTradesCompleted: currentProgress?.totalBuyTradesCompleted ?? 0,
      totalSellTradesCompleted: currentProgress?.totalSellTradesCompleted ?? 0,
      buyLimit: currentProgress?.buyLimit ?? 0,
      sellLimit: currentProgress?.sellLimit ?? 0,
      remainingTrades: currentProgress?.remainingTrades ?? 0,
      progressPercent: currentProgress?.progressPercent ?? 0,
      todayBotProfit: sumAmounts(
        botProfitEntries.filter((item) => new Date(item.createdAt) >= todayStart),
      ),
      totalBotProfit: sumAmounts(botProfitEntries),
      latestActivity: activity[0] ?? null,
      activity,
      totalActivity: activity.length,
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
      .filter((item) => !(item.status === "SKIPPED" && item.action === "AUTO_BUY" && item.amount === 0 && item.nftId === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicBotActivity(state, item));

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

export async function activateBotByAdmin(input: AdminActivateBotInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const selector = isWalletAddressLike(input.userId)
      ? { walletAddress: input.userId }
      : { userId: input.userId };
    const { user } = requireUser(state, selector);
    const now = nowIso();
    const existingSubscription = state.bot_subscriptions
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (existingSubscription) {
      const plan = BOT_PLANS[existingSubscription.planId as BotPlanId] ?? BOT_PLANS.bot_10;
      existingSubscription.status = "active";
      existingSubscription.activatedByAdmin = true;
      existingSubscription.completedAt = null;
      existingSubscription.uplineIncomePaidAt = existingSubscription.uplineIncomePaidAt ?? now;
      existingSubscription.updatedAt = now;

      if (
        existingSubscription.remainingBuyTrades <= 0 &&
        existingSubscription.remainingSellTrades <= 0
      ) {
        existingSubscription.remainingBuyTrades = plan.buyTrades;
        existingSubscription.remainingSellTrades = plan.sellTrades;
      }

      return {
        message: "Bot activated by admin.",
        user,
        subscription: toPublicBotSubscription(existingSubscription, state, true),
      };
    }

    const plan = BOT_PLANS.bot_10;
    const subscription: BotSubscriptionRecord = {
      id: makeId("bot"),
      userId: user.id,
      planId: plan.planId,
      planName: `${plan.planName} (Admin Activated)`,
      price: 0,
      totalBuyTrades: plan.buyTrades,
      totalSellTrades: plan.sellTrades,
      completedBuyTrades: 0,
      completedSellTrades: 0,
      remainingBuyTrades: plan.buyTrades,
      remainingSellTrades: plan.sellTrades,
      status: "active",
      lastExecutedAt: null,
      uplineIncomePaidAt: now,
      activatedByAdmin: true,
      purchasedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    state.bot_subscriptions.push(subscription);

    return {
      message: "Bot activated by admin.",
      user,
      subscription: toPublicBotSubscription(subscription, state, true),
    };
  });
}

export async function getWalletSummary(selector: UserSelector) {
  await ensureStoreInitialized();
  await processTradingEngineTick();

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, selector);
    const now = new Date();
    const todayStart = startOfToday(now);
    const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = startOfMonth(now);
    const incomeEntries = state.income_ledger
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const recentLedger = state.wallet_ledger
      .filter((item) => item.userId === user.id && WALLET_HISTORY_TYPES.has(item.type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 25)
      .map((entry) => ({
        id: entry.id,
        type: entry.type === "BOT_PURCHASE_DEBIT" ? "BOT_PURCHASE" : entry.type,
        title: typeof entry.metadata.title === "string" ? entry.metadata.title : null,
        description: typeof entry.metadata.description === "string" ? entry.metadata.description : null,
        category: categoryForLedgerEntry(entry.type),
        amount: entry.amount,
        createdAt: entry.createdAt,
        status: statusForLedgerEntry(state, entry),
        walletAffected: walletAffectedForLedgerEntry(entry),
        referenceId: entry.referenceId,
        metadata: entry.metadata,
      }));
    const trades = state.nft_trades
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicTrade(state, item));
    const totalWithdrawn = roundAmount(
      state.withdrawals
        .filter((item) => item.userId === user.id && isSuccessfulWithdrawal(item))
        .reduce((total, item) => total + item.netAmount, 0),
    );

    return {
      user,
      wallet: toPublicWallet(wallet, user, state),
      totalWithdrawn,
      incomeOverview: {
        totalIncome: sumAmounts(incomeEntries),
        nftTradingIncome: summarizeIncome(incomeEntries.filter(isNftTradingIncomeEntry), todayStart, weeklyStart, monthStart),
        levelIncome: summarizeIncome(incomeEntries.filter((item) => item.type === "LEVEL_INCOME"), todayStart, weeklyStart, monthStart),
        botTradingIncome: summarizeIncome([], todayStart, weeklyStart, monthStart),
        botPurchaseUplineIncome: summarizeIncome(
          incomeEntries.filter((item) => item.type === "BOT_PURCHASE_UPLINE_INCOME"),
          todayStart,
          weeklyStart,
          monthStart,
        ),
        royaltyIncome: summarizeIncome(incomeEntries.filter((item) => item.type === "ROYALTY_INCOME"), todayStart, weeklyStart, monthStart),
        history: incomeEntries,
      },
      recentLedger,
      trades,
      botSubscriptions: state.bot_subscriptions
        .filter((item) => item.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => toPublicBotSubscription(item, state)),
    };
  });
}

function applyRegistrationBonus(state: NftSimState, user: UserRecord, wallet: WalletRecord) {
  try {
    if (user.registrationBonusGiven) {
      return;
    }

    const tokenPriceUsd = getCurrentGxnTokenPriceUsd();
    const tokensToGive = calculateRegistrationBonusTokens(tokenPriceUsd);
    if (!tokensToGive) {
      console.error("[bonus] registration bonus skipped: invalid GXN token price", tokenPriceUsd);
      return;
    }

    wallet.gxnTokenBalance = roundAmount(wallet.gxnTokenBalance + tokensToGive);
    wallet.updatedAt = nowIso();
    user.registrationBonusGiven = true;

    pushWalletLedger(state, {
      userId: user.id,
      type: "GXN_TOKEN_REWARD",
      amount: tokensToGive,
      referenceId: "registration_bonus",
      metadata: {
        type: "bonus",
        subtype: "registration",
        usd_value: REGISTRATION_BONUS_USD,
        tokenPriceUsd,
        gxnTokenBalanceAfter: wallet.gxnTokenBalance,
        registration_bonus_given: true,
      },
    });

    console.log("[bonus] registration bonus given", user.id, tokensToGive);
  } catch (error) {
    console.error("[bonus] failed", error);
  }
}

export async function transferFundByAdmin(input: AdminTransferFundInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.amount, "Transfer amount");

  return withStoreTransaction(async (state) => {
    const selector = isWalletAddressLike(input.userId)
      ? { walletAddress: input.userId }
      : { userId: input.userId };
    const { user, wallet } = requireUser(state, selector);
    const amount = roundAmount(input.amount);
    const referenceId = makeId("admin_credit");

    wallet.tradingWallet = roundAmount(wallet.tradingWallet + amount);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: user.id,
      type: "ADMIN_CREDIT",
      amount,
      referenceId,
      metadata: {
        tradingWalletAfter: wallet.tradingWallet,
      },
    });

    pushIncomeLedger(state, {
      userId: user.id,
      type: "ADMIN_CREDIT",
      amount,
      sourceTradeId: referenceId,
      level: null,
      sourceUserId: null,
    });

    return {
      message: "Fund transferred by admin.",
      user,
      wallet: toPublicWallet(wallet, user, state),
      incomeLedgerType: "ADMIN_CREDIT",
      referenceId,
    };
  });
}

export async function approveWithdrawal(input: ApproveWithdrawalInput) {
  await ensureStoreInitialized();

  const current = await readState();
  if (current.admin_settings.systemStopped) {
    pushSafetyLog(current, {
      eventType: "BLOCKED_PAYOUT",
      userId: null,
      amount: null,
      reason: "System emergency stop is active.",
      metadata: { payoutType: "WITHDRAWAL_APPROVAL", withdrawalId: input.withdrawalId },
    });
    throw new ApiError(409, "System emergency stop is active.");
  }

  if (current.admin_settings.payoutsPaused) {
    throw new ApiError(409, "Payouts are paused.");
  }

  const pendingWithdrawal = current.withdrawals.find((item) => item.id === input.withdrawalId);
  if (!pendingWithdrawal) {
    throw new ApiError(404, "Withdrawal request not found.");
  }

  if (isFinalizedWithdrawal(pendingWithdrawal)) {
    return {
      message: "Withdrawal already paid on-chain.",
      withdrawal: pendingWithdrawal,
      authorizationTxHash: pendingWithdrawal.payoutTxHash ?? pendingWithdrawal.withdrawalTxHash,
      payoutTxHash: pendingWithdrawal.payoutTxHash ?? pendingWithdrawal.withdrawalTxHash,
    };
  }

  if (pendingWithdrawal.status !== "requested") {
    throw new ApiError(409, "Withdrawal request is already processed.");
  }

  if (
    !checkWithdrawalApprovalSafety(current, {
      userId: pendingWithdrawal.userId,
      amount: pendingWithdrawal.netAmount,
      payoutType: "WITHDRAWAL_APPROVAL",
      referenceId: pendingWithdrawal.id,
    })
  ) {
    throw new ApiError(409, "Withdrawal approval blocked by safety controls.");
  }

  const { user: pendingUser } = requireUser(current, { userId: pendingWithdrawal.userId });
  console.info("[withdraw.approve]", {
    withdrawalId: pendingWithdrawal.id,
    userWallet: pendingUser.walletAddress,
    netAmount: pendingWithdrawal.netAmount,
  });
  let authorization: Awaited<ReturnType<typeof authorizeUsdtWithdrawalOnChain>>;
  try {
    authorization = await authorizeUsdtWithdrawalOnChain({
      walletAddress: pendingUser.walletAddress,
      netAmount: pendingWithdrawal.netAmount,
      withdrawalId: pendingWithdrawal.id,
    });
  } catch (error) {
    if (isAlreadyProcessedPayoutError(error)) {
      return withStoreTransaction(async (state) => {
        const withdrawal = state.withdrawals.find((item) => item.id === input.withdrawalId);
        if (!withdrawal) {
          throw new ApiError(404, "Withdrawal request not found.");
        }

        return finalizePaidWithdrawal(state, withdrawal);
      });
    }

    await withStoreTransaction(async (state) => {
      const withdrawal = state.withdrawals.find((item) => item.id === input.withdrawalId);
      if (withdrawal && withdrawal.status === "requested") {
        withdrawal.payoutStatus = "FAILED";
        withdrawal.onChainStatus = "FAILED";
      }
    });
    throw error;
  }

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

    if (isFinalizedWithdrawal(withdrawal)) {
      return finalizePaidWithdrawal(state, withdrawal, authorization.txHash);
    }

    if (withdrawal.status !== "requested") {
      throw new ApiError(409, "Withdrawal request is already processed.");
    }

    if (
      !checkWithdrawalApprovalSafety(state, {
        userId: withdrawal.userId,
        amount: withdrawal.netAmount,
        payoutType: "WITHDRAWAL_APPROVAL",
        referenceId: withdrawal.id,
      })
    ) {
      throw new ApiError(409, "Withdrawal approval blocked by safety controls.");
    }

    return finalizePaidWithdrawal(state, withdrawal, authorization.txHash);
  });
}

export async function confirmOnChainWithdrawal(input: ConfirmWithdrawalInput) {
  await ensureStoreInitialized();

  return withStoreTransaction(async (state) => {
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    const { user } = requireUser(state, { walletAddress });
    const withdrawal = state.withdrawals.find((item) => item.id === input.withdrawalId);
    if (!withdrawal || withdrawal.userId !== user.id) {
      throw new ApiError(404, "Withdrawal request not found.");
    }

    if (withdrawal.onChainStatus === "CONFIRMED" || withdrawal.withdrawalTxHash) {
      throw new ApiError(409, "Withdrawal transaction is already recorded.");
    }

    const duplicateTx = state.withdrawals.some(
      (item) =>
        item.withdrawalTxHash?.toLowerCase() === input.txHash.toLowerCase() &&
        item.id !== withdrawal.id,
    );
    if (duplicateTx) {
      throw new ApiError(409, "Withdrawal transaction hash is already used.");
    }

    withdrawal.withdrawalTxHash = input.txHash.toLowerCase();
    withdrawal.payoutTxHash = input.txHash.toLowerCase();
    withdrawal.onChainStatus = "CONFIRMED";
    withdrawal.status = "approved";
    withdrawal.approvedAt = nowIso();
    withdrawal.payoutStatus = "CONFIRMED";

    return {
      message: "On-chain withdrawal confirmed.",
      user,
      withdrawal,
    };
  });
}
