import { ApiError } from "@/server/nft-sim/errors";
import {
  applyPercentIncrease,
  randomDecimalInRange,
  randomIntegerInRange,
  roundAmount,
} from "@/server/nft-sim/math";
import { ensureStoreInitialized, readState, withStoreTransaction } from "@/server/nft-sim/store";
import {
  AdminSettingsRecord,
  BotActivityRecord,
  BotSubscriptionRecord,
  IncomeLedgerRecord,
  MlmTreeRecord,
  NftRecord,
  NftSimState,
  NftTradeRecord,
  SystemReserveRecord,
  UserRecord,
  WalletLedgerRecord,
  WalletRecord,
  WithdrawalRecord,
} from "@/server/nft-sim/types";

const MLM_LEVEL_PERCENTAGES = [20, 15, 10, 8, 5] as const;
const GXN_TOKEN_VALUE_USD = 0.05;
const GXN_WITHDRAWAL_DEDUCTION_PERCENT = 20;
const MANUAL_AUTO_SELL_DELAY_MIN_MINUTES = 60;
const MANUAL_AUTO_SELL_DELAY_MAX_MINUTES = 120;
const BOT_AUTO_SELL_DELAY_MIN_MINUTES = 15;
const BOT_AUTO_SELL_DELAY_MAX_MINUTES = 40;
const NO_AFFORDABLE_NFT_MESSAGE = "No affordable NFT available for your wallet balance.";

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

interface TransferCapitalInput extends UserSelector {
  amount: number;
}

interface BuyBotInput extends UserSelector {
  planId: BotPlanId;
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

function refreshCapitalUnlock(wallet: WalletRecord) {
  wallet.isCapitalUnlocked = wallet.buyCount >= 300 && wallet.sellCount >= 300;
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

function sumAmounts(records: IncomeLedgerRecord[]) {
  return roundAmount(records.reduce((total, record) => total + record.amount, 0));
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

function reserveFundedAmount(
  state: NftSimState,
  requestedAmount: number,
  reserveCounter:
    | "totalMlmPaid"
    | "totalNftTradingPaid"
    | "totalBotTradingPaid"
    | "totalBotPurchaseUplinePaid",
) {
  const amount = roundAmount(Math.min(requestedAmount, state.system_reserve.balance));
  if (amount <= 0) {
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
  assertDailyTradeLimit(state, user, "buy");

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
  wallet.buyCount += 1;
  user.totalBuyCount += 1;
  user.dailyBuyCount += 1;
  wallet.updatedAt = now;
  refreshCapitalUnlock(wallet);

  pushWalletLedger(state, {
    userId: user.id,
    type: "NFT_BUY_DEBIT",
    amount: buyPrice,
    referenceId: nft.id,
    metadata: {
      nftId: nft.id,
      tradeSource: input.source ?? "manual",
      buyCount: wallet.buyCount,
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
    const amount = reserveFundedAmount(state, requestedAmount, "totalMlmPaid");
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
    ? reserveFundedAmount(state, rawProfit, "totalNftTradingPaid")
    : rawProfit;
  const relistUpdate = priceAfterMarketBuy(state, sellPrice);

  wallet.tradingWallet = roundAmount(wallet.tradingWallet + principalReturn);
  wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + profit);
  wallet.sellCount += 1;
  user.totalSellCount += 1;
  user.dailySellCount += 1;
  wallet.updatedAt = now;
  refreshCapitalUnlock(wallet);

  pushWalletLedger(state, {
    userId: trade.userId,
    type: "NFT_SELL_PRINCIPAL_RETURN",
    amount: principalReturn,
    referenceId: trade.saleJobId,
    metadata: {
      nftId: trade.nftId,
      tradeId: trade.id,
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

  for (const subscription of state.bot_subscriptions) {
    const wallet = requireWallet(state, subscription.userId);

    if (!botHasRemainingCapacity(subscription)) {
      markBotSubscriptionCompleteIfDone(state, subscription);
      continue;
    }

    if (!botCanStartNextCycle(state, subscription, wallet)) {
      continue;
    }
    const user = state.users.find((item) => item.id === subscription.userId);
    if (!user) {
      continue;
    }

    if (!canUseDailyTrade(state, user, "buy") || !canUseDailyTrade(state, user, "sell")) {
      pushBotActivity(state, {
        userId: subscription.userId,
        botSubscriptionId: subscription.id,
        nftId: null,
        action: "AUTO_BUY",
        amount: 0,
        profit: null,
        status: "SKIPPED",
      });
      continue;
    }

    const nft = state.nfts
      .filter((item) => item.status === "marketplace" && item.currentPrice <= wallet.tradingWallet)
      .sort((a, b) => b.currentPrice - a.currentPrice)[0];

    console.info("[bot.selection]", {
      balance: wallet.tradingWallet,
      selectedPrice: nft?.currentPrice ?? null,
      selectedNftId: nft?.id ?? null,
    });

    if (!nft) {
      selectionMessages.push(NO_AFFORDABLE_NFT_MESSAGE);
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

  return { executions, selectionMessages };
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
      return {
        message: "User already registered.",
        user: existingUser,
        wallet: toPublicWallet(requireWallet(state, existingUser.id)),
      };
    }

    let sponsorUserId: string | null = null;
    if (input.sponsorWalletAddress) {
      const sponsorWalletAddress = normalizeWalletAddress(input.sponsorWalletAddress);
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
      wallet: toPublicWallet(wallet),
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
    refreshCapitalUnlock(wallet);

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
      wallet: toPublicWallet(wallet),
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
      wallet: toPublicWallet(result.wallet),
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
      activatedByAdmin: false,
      purchasedAt: nowIso(),
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    state.bot_subscriptions.push(subscription);
    const uplineIncome = processBotPurchaseUplineIncome(state, user.id, subscription);

    return {
      message: "Bot subscription activated.",
      user,
      wallet: toPublicWallet(wallet),
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

    const botCycle = executeBotCycleInternal(state);

    return {
      serverTime: currentTime.toISOString(),
      settledSales,
      botExecutions: botCycle.executions,
      botSelectionMessages: botCycle.selectionMessages,
    };
  });
}

export async function processDueAutoSales() {
  return processTradingEngineTick();
}

export async function transferCapitalToWithdrawal(input: TransferCapitalInput) {
  await ensureStoreInitialized();
  validatePositiveAmount(input.amount, "Transfer amount");

  return withStoreTransaction(async (state) => {
    const { user, wallet } = requireUser(state, input);
    const amount = roundAmount(input.amount);

    if (!wallet.isCapitalUnlocked) {
      throw new ApiError(403, "Capital transfer is locked until 300 buys and 300 sells.");
    }

    if (wallet.tradingWallet < amount) {
      throw new ApiError(409, "Insufficient trading wallet balance.");
    }

    wallet.tradingWallet = roundAmount(wallet.tradingWallet - amount);
    wallet.withdrawalWallet = roundAmount(wallet.withdrawalWallet + amount);
    wallet.updatedAt = nowIso();

    pushWalletLedger(state, {
      userId: user.id,
      type: "CAPITAL_TRANSFER_TO_WITHDRAWAL",
      amount,
      referenceId: null,
      metadata: {
        tradingWalletAfter: wallet.tradingWallet,
        withdrawalWalletAfter: wallet.withdrawalWallet,
      },
    });

    return {
      message: "Capital transferred to withdrawal wallet.",
      user,
      wallet: toPublicWallet(wallet),
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

    if (amount < minimum) {
      throw new ApiError(400, `Minimum withdrawal is $${minimum}.`);
    }

    if (wallet.withdrawalWallet < amount) {
      throw new ApiError(409, "Insufficient withdrawal wallet balance.");
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
      wallet: toPublicWallet(wallet),
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
      wallet: toPublicWallet(wallet),
      systemReserve: toPublicReserve(state.system_reserve),
      settings: toPublicSettings(state.admin_settings),
      withdrawals,
      ledger: walletLedger,
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

    const nftTradingEntries = entries.filter(
      (item) => item.type === "NFT_TRADING_INCOME" || item.type === "BOT_TRADING_INCOME",
    );
    const levelIncomeEntries = entries.filter((item) => item.type === "LEVEL_INCOME");
    const botTradingEntries: IncomeLedgerRecord[] = [];
    const botPurchaseEntries = entries.filter(
      (item) => item.type === "BOT_PURCHASE_UPLINE_INCOME",
    );

    return {
      user,
      totalIncome: sumAmounts(entries),
      nftTradingIncome: {
        total: sumAmounts(nftTradingEntries),
        today: sumAmounts(
          nftTradingEntries.filter((item) => new Date(item.createdAt) >= todayStart),
        ),
        weekly: sumAmounts(
          nftTradingEntries.filter((item) => new Date(item.createdAt) >= weeklyStart),
        ),
        monthly: sumAmounts(
          nftTradingEntries.filter((item) => new Date(item.createdAt) >= monthStart),
        ),
      },
      levelIncome: {
        total: sumAmounts(levelIncomeEntries),
        today: sumAmounts(
          levelIncomeEntries.filter((item) => new Date(item.createdAt) >= todayStart),
        ),
        weekly: sumAmounts(
          levelIncomeEntries.filter((item) => new Date(item.createdAt) >= weeklyStart),
        ),
        monthly: sumAmounts(
          levelIncomeEntries.filter((item) => new Date(item.createdAt) >= monthStart),
        ),
      },
      botTradingIncome: {
        total: sumAmounts(botTradingEntries),
        today: sumAmounts(
          botTradingEntries.filter((item) => new Date(item.createdAt) >= todayStart),
        ),
        weekly: sumAmounts(
          botTradingEntries.filter((item) => new Date(item.createdAt) >= weeklyStart),
        ),
        monthly: sumAmounts(
          botTradingEntries.filter((item) => new Date(item.createdAt) >= monthStart),
        ),
      },
      botPurchaseUplineIncome: {
        total: sumAmounts(botPurchaseEntries),
        today: sumAmounts(
          botPurchaseEntries.filter((item) => new Date(item.createdAt) >= todayStart),
        ),
        weekly: sumAmounts(
          botPurchaseEntries.filter((item) => new Date(item.createdAt) >= weeklyStart),
        ),
        monthly: sumAmounts(
          botPurchaseEntries.filter((item) => new Date(item.createdAt) >= monthStart),
        ),
      },
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
      (item) =>
        item.userId === user.id &&
        (item.type === "NFT_TRADING_INCOME" || item.type === "BOT_TRADING_INCOME"),
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
      wallet: toPublicWallet(wallet),
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
    const botProfitEntries = state.income_ledger.filter((item) => {
      if (item.userId !== user.id) {
        return false;
      }
      if (item.type === "BOT_TRADING_INCOME") {
        return true;
      }
      const trade = state.nft_trades.find((entry) => entry.id === item.sourceTradeId);
      return item.type === "NFT_TRADING_INCOME" && trade?.source === "bot";
    });
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
