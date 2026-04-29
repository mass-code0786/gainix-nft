import { PrismaClient } from "@prisma/client";
import { prisma } from "@/server/api/prisma";
import type {
  AdminSettingsRecord,
  BotActivityRecord,
  BotSubscriptionRecord,
  DepositRecord,
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

let transactionQueue = Promise.resolve();
type DbClient = PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function normalizeBotStatus(status: string) {
  return status.toLowerCase() as "active" | "completed";
}

function normalizeTradeStatus(status: string) {
  return status.toLowerCase() as "bought" | "listed" | "auto_sold";
}

function normalizeTradeSource(source: string) {
  return source.toLowerCase() as "manual" | "bot";
}

function normalizeDepositStatus(status: string) {
  return status.toLowerCase() as DepositRecord["status"];
}

export async function ensureStoreInitialized() {
  await prisma.$transaction(async (tx) => {
    const [adminSetting, reserve] = await Promise.all([
      tx.adminSetting.findFirst(),
      tx.systemReserve.findFirst(),
    ]);

    if (!adminSetting) {
      await tx.adminSetting.create({
        data: {
          id: "gainix-admin-settings",
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
        },
      });
    }

    if (!reserve) {
      await tx.systemReserve.create({
        data: {
          id: "gainix-system-reserve",
          balance: 5000,
          totalMlmPaid: 0,
          totalRoyaltyPaid: 0,
          totalNftTradingPaid: 0,
          totalBotTradingPaid: 0,
          totalBotPurchaseUplinePaid: 0,
        },
      });
    }
  });
}

async function buildState(db: DbClient) {
  const [
    users,
    nfts,
    nftTrades,
    wallets,
    walletLedger,
    incomeLedger,
    mlmTree,
    botSubscriptions,
    botActivity,
    withdrawals,
    deposits,
    systemReserve,
    adminSetting,
    safetyLogs,
  ] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    db.nFT.findMany({ orderBy: { createdAt: "asc" } }),
    db.nFTTrade.findMany({ orderBy: { createdAt: "asc" } }),
    db.wallet.findMany({ orderBy: { createdAt: "asc" } }),
    db.walletLedger.findMany({ orderBy: { createdAt: "asc" } }),
    db.incomeLedger.findMany({ orderBy: { createdAt: "asc" } }),
    db.mLMTree.findMany({ orderBy: [{ createdAt: "asc" }, { level: "asc" }] }),
    db.botSubscription.findMany({ orderBy: { createdAt: "asc" } }),
    db.botActivity.findMany({ orderBy: { createdAt: "asc" } }),
    db.withdrawal.findMany({ orderBy: { createdAt: "asc" } }),
    db.deposit.findMany({ orderBy: { createdAt: "asc" } }),
    db.systemReserve.findFirstOrThrow(),
    db.adminSetting.findFirstOrThrow(),
    db.safetyLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const state: NftSimState = {
    users: users.map<UserRecord>((item) => ({
      id: item.id,
      walletAddress: item.walletAddress,
      selfPackageAmount: item.selfPackageAmount,
      currentVipLevel: item.currentVipLevel,
      vipAchievedAt: toIso(item.vipAchievedAt),
      totalBuyCount: item.totalBuyCount,
      totalSellCount: item.totalSellCount,
      dailyBuyCount: item.dailyBuyCount,
      dailySellCount: item.dailySellCount,
      lastTradeResetAt: item.lastTradeResetAt.toISOString(),
      capitalUnlocked: item.capitalUnlocked,
      capitalUnlockedAt: toIso(item.capitalUnlockedAt),
      capitalTransferredAt: toIso(item.capitalTransferredAt),
      createdAt: item.createdAt.toISOString(),
    })),
    nfts: nfts.map<NftRecord>((item) => ({
      id: item.id,
      tokenId: item.tokenId,
      name: item.name,
      description: item.description,
      category: item.category,
      imageUrl: item.imageUrl,
      basePrice: item.basePrice,
      currentPrice: item.currentPrice,
      lastBuyPrice: item.lastBuyPrice,
      totalTrades: item.totalTrades,
      status: item.status as NftRecord["status"],
      ownerUserId: item.ownerUserId,
      lastPriceIncreasePercent: item.lastPriceIncreasePercent,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    nft_trades: nftTrades.map<NftTradeRecord>((item) => ({
      id: item.id,
      nftId: item.nftId,
      userId: item.userId,
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      profit: item.profit,
      status: normalizeTradeStatus(item.status),
      listedAt: toIso(item.listedAt),
      autoSellAt: toIso(item.autoSellAt),
      soldAt: toIso(item.soldAt),
      saleJobId: item.saleJobId,
      source: normalizeTradeSource(item.source),
      botSubscriptionId: item.botSubscriptionId,
      createdAt: item.createdAt.toISOString(),
    })),
    wallets: wallets.map<WalletRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      tradingWallet: item.tradingWallet,
      withdrawalWallet: item.withdrawalWallet,
      gxnTokenBalance: item.gxnTokenBalance,
      totalDeposited: item.totalDeposited,
      buyCount: item.buyCount,
      sellCount: item.sellCount,
      isCapitalUnlocked: item.isCapitalUnlocked,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    wallet_ledger: walletLedger.map<WalletLedgerRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      type: item.type as WalletLedgerRecord["type"],
      amount: item.amount,
      referenceId: item.referenceId,
      metadata: (item.metadata as WalletLedgerRecord["metadata"]) ?? {},
      createdAt: item.createdAt.toISOString(),
    })),
    income_ledger: incomeLedger.map<IncomeLedgerRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      type: item.type as IncomeLedgerRecord["type"],
      amount: item.amount,
      sourceTradeId: item.sourceTradeId,
      level: item.level,
      sourceUserId: item.sourceUserId,
      vipLevel: item.vipLevel,
      payoutDate: toIso(item.payoutDate),
      createdAt: item.createdAt.toISOString(),
    })),
    mlm_tree: mlmTree.map<MlmTreeRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      ancestorUserId: item.ancestorUserId,
      level: item.level,
      createdAt: item.createdAt.toISOString(),
    })),
    bot_subscriptions: botSubscriptions.map<BotSubscriptionRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      planId: item.planId,
      planName: item.planName,
      price: item.price,
      totalBuyTrades: item.totalBuyTrades,
      totalSellTrades: item.totalSellTrades,
      completedBuyTrades: item.completedBuyTrades,
      completedSellTrades: item.completedSellTrades,
      remainingBuyTrades: item.remainingBuyTrades,
      remainingSellTrades: item.remainingSellTrades,
      status: normalizeBotStatus(item.status),
      lastExecutedAt: toIso(item.lastExecutedAt),
      uplineIncomePaidAt: toIso(item.uplineIncomePaidAt),
      purchasedAt: item.purchasedAt.toISOString(),
      completedAt: toIso(item.completedAt),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    bot_activity: botActivity.map<BotActivityRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      botSubscriptionId: item.botSubscriptionId,
      nftId: item.nftId,
      action: item.action as BotActivityRecord["action"],
      amount: item.amount,
      profit: item.profit,
      status: item.status as BotActivityRecord["status"],
      createdAt: item.createdAt.toISOString(),
    })),
    withdrawals: withdrawals.map<WithdrawalRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      grossAmount: item.grossAmount,
      feeAmount: item.feeAmount,
      gxnDeductionAmount: item.gxnDeductionAmount,
      gxnTokens: item.gxnTokens,
      netAmount: item.netAmount,
      status: item.status.toLowerCase() as WithdrawalRecord["status"],
      approvedAt: toIso(item.approvedAt),
      payoutTxHash: item.payoutTxHash,
      payoutStatus: item.payoutStatus,
      withdrawalTxHash: item.withdrawalTxHash,
      onChainStatus: item.onChainStatus as WithdrawalRecord["onChainStatus"],
      createdAt: item.createdAt.toISOString(),
    })),
    deposits: deposits.map<DepositRecord>((item) => ({
      id: item.id,
      userId: item.userId,
      txHash: item.txHash,
      chainId: item.chainId,
      tokenAddress: item.tokenAddress,
      expectedAmount: item.expectedAmount,
      creditedAmount: item.creditedAmount,
      status: normalizeDepositStatus(item.status),
      createdAt: item.createdAt.toISOString(),
      confirmedAt: toIso(item.confirmedAt),
      rejectedAt: toIso(item.rejectedAt),
    })),
    system_reserve: {
      id: systemReserve.id,
      balance: systemReserve.balance,
      totalMlmPaid: systemReserve.totalMlmPaid,
      totalRoyaltyPaid: systemReserve.totalRoyaltyPaid,
      totalNftTradingPaid: systemReserve.totalNftTradingPaid,
      totalBotTradingPaid: systemReserve.totalBotTradingPaid,
      totalBotPurchaseUplinePaid: systemReserve.totalBotPurchaseUplinePaid,
      createdAt: systemReserve.createdAt.toISOString(),
      updatedAt: systemReserve.updatedAt.toISOString(),
    },
    admin_settings: {
      nftPriceIncreaseMinPercent: adminSetting.nftPriceIncreaseMinPercent,
      nftPriceIncreaseMaxPercent: adminSetting.nftPriceIncreaseMaxPercent,
      autoSellDelayMinMinutes: adminSetting.autoSellDelayMinMinutes,
      autoSellDelayMaxMinutes: adminSetting.autoSellDelayMaxMinutes,
      botProfitMinPercent: adminSetting.botProfitMinPercent,
      botProfitMaxPercent: adminSetting.botProfitMaxPercent,
      withdrawalMinimumAmount: adminSetting.withdrawalMinimumAmount,
      withdrawalFeePercent: adminSetting.withdrawalFeePercent,
      vipMinimumTeamPackageAmount: adminSetting.vipMinimumTeamPackageAmount,
      vipFirstPayoutDay: adminSetting.vipFirstPayoutDay,
      vipSecondPayoutDay: adminSetting.vipSecondPayoutDay,
      vipRecurringEnabled: adminSetting.vipRecurringEnabled,
      payoutsPaused: adminSetting.payoutsPaused,
      systemStopped: adminSetting.systemStopped,
      globalDailyPayoutCap: adminSetting.globalDailyPayoutCap,
      perUserDailyPayoutCap: adminSetting.perUserDailyPayoutCap,
      maxDailyWithdrawalAmountPerUser: adminSetting.maxDailyWithdrawalAmountPerUser,
      minimumTradeAmount: adminSetting.minimumTradeAmount,
      updatedAt: adminSetting.updatedAt.toISOString(),
    },
    safety_logs: safetyLogs.map<SafetyLogRecord>((item) => ({
      id: item.id,
      eventType: item.eventType,
      userId: item.userId,
      amount: item.amount,
      reason: item.reason,
      metadata: (item.metadata as SafetyLogRecord["metadata"]) ?? {},
      createdAt: item.createdAt.toISOString(),
    })),
  };

  return state;
}

async function replaceState(tx: DbClient, state: NftSimState) {
  await tx.botActivity.deleteMany();
  await tx.walletLedger.deleteMany();
  await tx.incomeLedger.deleteMany();
  await tx.nFTTrade.deleteMany();
  await tx.botSubscription.deleteMany();
  await tx.withdrawal.deleteMany();
  await tx.deposit.deleteMany();
  await tx.mLMTree.deleteMany();
  await tx.wallet.deleteMany();
  await tx.nFT.deleteMany();
  await tx.user.deleteMany();
  await tx.adminSetting.deleteMany();
  await tx.systemReserve.deleteMany();
  await tx.safetyLog.deleteMany();

  if (state.users.length > 0) {
    await tx.user.createMany({
      data: state.users.map((item) => ({
        id: item.id,
        walletAddress: item.walletAddress,
        selfPackageAmount: item.selfPackageAmount,
        currentVipLevel: item.currentVipLevel,
        vipAchievedAt: item.vipAchievedAt ? new Date(item.vipAchievedAt) : null,
        totalBuyCount: item.totalBuyCount,
        totalSellCount: item.totalSellCount,
        dailyBuyCount: item.dailyBuyCount,
        dailySellCount: item.dailySellCount,
        lastTradeResetAt: new Date(item.lastTradeResetAt),
        capitalUnlocked: item.capitalUnlocked,
        capitalUnlockedAt: item.capitalUnlockedAt ? new Date(item.capitalUnlockedAt) : null,
        capitalTransferredAt: item.capitalTransferredAt ? new Date(item.capitalTransferredAt) : null,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.wallets.length > 0) {
    await tx.wallet.createMany({
      data: state.wallets.map((item) => ({
        id: item.id,
        userId: item.userId,
        tradingWallet: item.tradingWallet,
        withdrawalWallet: item.withdrawalWallet,
        gxnTokenBalance: item.gxnTokenBalance,
        totalDeposited: item.totalDeposited,
        buyCount: item.buyCount,
        sellCount: item.sellCount,
        isCapitalUnlocked: item.isCapitalUnlocked,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    });
  }

  if (state.nfts.length > 0) {
    await tx.nFT.createMany({
      data: state.nfts.map((item) => ({
        id: item.id,
        tokenId: item.tokenId,
        name: item.name,
        description: item.description,
        category: item.category,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        currentPrice: item.currentPrice,
        lastBuyPrice: item.lastBuyPrice,
        totalTrades: item.totalTrades,
        status: item.status,
        ownerUserId: item.ownerUserId,
        lastPriceIncreasePercent: item.lastPriceIncreasePercent,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    });
  }

  if (state.mlm_tree.length > 0) {
    await tx.mLMTree.createMany({
      data: state.mlm_tree.map((item) => ({
        id: item.id,
        userId: item.userId,
        ancestorUserId: item.ancestorUserId,
        level: item.level,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.bot_subscriptions.length > 0) {
    await tx.botSubscription.createMany({
      data: state.bot_subscriptions.map((item) => ({
        id: item.id,
        userId: item.userId,
        planId: item.planId,
        planName: item.planName,
        price: item.price,
        totalBuyTrades: item.totalBuyTrades,
        totalSellTrades: item.totalSellTrades,
        completedBuyTrades: item.completedBuyTrades,
        completedSellTrades: item.completedSellTrades,
        remainingBuyTrades: item.remainingBuyTrades,
        remainingSellTrades: item.remainingSellTrades,
        status: item.status.toUpperCase() as "ACTIVE" | "COMPLETED",
        lastExecutedAt: item.lastExecutedAt ? new Date(item.lastExecutedAt) : null,
        uplineIncomePaidAt: item.uplineIncomePaidAt ? new Date(item.uplineIncomePaidAt) : null,
        purchasedAt: new Date(item.purchasedAt),
        completedAt: item.completedAt ? new Date(item.completedAt) : null,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    });
  }

  if (state.nft_trades.length > 0) {
    await tx.nFTTrade.createMany({
      data: state.nft_trades.map((item) => ({
        id: item.id,
        nftId: item.nftId,
        userId: item.userId,
        buyPrice: item.buyPrice,
        sellPrice: item.sellPrice,
        profit: item.profit,
        status: item.status.toUpperCase() as "BOUGHT" | "LISTED" | "AUTO_SOLD",
        listedAt: item.listedAt ? new Date(item.listedAt) : null,
        autoSellAt: item.autoSellAt ? new Date(item.autoSellAt) : null,
        soldAt: item.soldAt ? new Date(item.soldAt) : null,
        saleJobId: item.saleJobId,
        source: item.source.toUpperCase() as "MANUAL" | "BOT",
        botSubscriptionId: item.botSubscriptionId,
        createdAt: new Date(item.createdAt),
        updatedAt: item.soldAt ? new Date(item.soldAt) : new Date(item.createdAt),
      })),
    });
  }

  if (state.wallet_ledger.length > 0) {
    await tx.walletLedger.createMany({
      data: state.wallet_ledger.map((item) => ({
        id: item.id,
        userId: item.userId,
        type: item.type,
        amount: item.amount,
        referenceId: item.referenceId,
        metadata: item.metadata,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.income_ledger.length > 0) {
    await tx.incomeLedger.createMany({
      data: state.income_ledger.map((item) => ({
        id: item.id,
        userId: item.userId,
        type: item.type,
        amount: item.amount,
        sourceTradeId: item.sourceTradeId,
        level: item.level,
        sourceUserId: item.sourceUserId,
        vipLevel: item.vipLevel,
        payoutDate: item.payoutDate ? new Date(item.payoutDate) : null,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.bot_activity.length > 0) {
    await tx.botActivity.createMany({
      data: state.bot_activity.map((item) => ({
        id: item.id,
        userId: item.userId,
        botSubscriptionId: item.botSubscriptionId,
        nftId: item.nftId,
        action: item.action,
        amount: item.amount,
        profit: item.profit,
        status: item.status,
        createdAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.withdrawals.length > 0) {
    await tx.withdrawal.createMany({
      data: state.withdrawals.map((item) => ({
        id: item.id,
        userId: item.userId,
        grossAmount: item.grossAmount,
        feeAmount: item.feeAmount,
        gxnDeductionAmount: item.gxnDeductionAmount,
        gxnTokens: item.gxnTokens,
        netAmount: item.netAmount,
        status: item.status.toUpperCase() as "REQUESTED" | "APPROVED" | "APPROVED_PENDING_TX",
        approvedAt: item.approvedAt ? new Date(item.approvedAt) : null,
        payoutTxHash: item.payoutTxHash,
        payoutStatus: item.payoutStatus,
        withdrawalTxHash: item.withdrawalTxHash,
        onChainStatus: item.onChainStatus,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.createdAt),
      })),
    });
  }

  if (state.deposits.length > 0) {
    await tx.deposit.createMany({
      data: state.deposits.map((item) => ({
        id: item.id,
        userId: item.userId,
        txHash: item.txHash,
        chainId: item.chainId,
        tokenAddress: item.tokenAddress,
        expectedAmount: item.expectedAmount,
        creditedAmount: item.creditedAmount,
        status: item.status.toUpperCase() as "PENDING" | "CONFIRMED" | "REJECTED",
        createdAt: new Date(item.createdAt),
        confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : null,
        rejectedAt: item.rejectedAt ? new Date(item.rejectedAt) : null,
      })),
    });
  }

  await tx.systemReserve.create({
    data: {
      id: state.system_reserve.id,
      balance: state.system_reserve.balance,
      totalMlmPaid: state.system_reserve.totalMlmPaid,
      totalRoyaltyPaid: state.system_reserve.totalRoyaltyPaid,
      totalNftTradingPaid: state.system_reserve.totalNftTradingPaid,
      totalBotTradingPaid: state.system_reserve.totalBotTradingPaid,
      totalBotPurchaseUplinePaid: state.system_reserve.totalBotPurchaseUplinePaid,
      createdAt: new Date(state.system_reserve.createdAt),
      updatedAt: new Date(state.system_reserve.updatedAt),
    },
  });

  await tx.adminSetting.create({
    data: {
      nftPriceIncreaseMinPercent: state.admin_settings.nftPriceIncreaseMinPercent,
      nftPriceIncreaseMaxPercent: state.admin_settings.nftPriceIncreaseMaxPercent,
      autoSellDelayMinMinutes: state.admin_settings.autoSellDelayMinMinutes,
      autoSellDelayMaxMinutes: state.admin_settings.autoSellDelayMaxMinutes,
      botProfitMinPercent: state.admin_settings.botProfitMinPercent,
      botProfitMaxPercent: state.admin_settings.botProfitMaxPercent,
      withdrawalMinimumAmount: state.admin_settings.withdrawalMinimumAmount,
      withdrawalFeePercent: state.admin_settings.withdrawalFeePercent,
      vipMinimumTeamPackageAmount: state.admin_settings.vipMinimumTeamPackageAmount,
      vipFirstPayoutDay: state.admin_settings.vipFirstPayoutDay,
      vipSecondPayoutDay: state.admin_settings.vipSecondPayoutDay,
      vipRecurringEnabled: state.admin_settings.vipRecurringEnabled,
      payoutsPaused: state.admin_settings.payoutsPaused,
      systemStopped: state.admin_settings.systemStopped,
      globalDailyPayoutCap: state.admin_settings.globalDailyPayoutCap,
      perUserDailyPayoutCap: state.admin_settings.perUserDailyPayoutCap,
      maxDailyWithdrawalAmountPerUser: state.admin_settings.maxDailyWithdrawalAmountPerUser,
      minimumTradeAmount: state.admin_settings.minimumTradeAmount,
      createdAt: new Date(state.admin_settings.updatedAt),
      updatedAt: new Date(state.admin_settings.updatedAt),
    },
  });

  if (state.safety_logs.length > 0) {
    await tx.safetyLog.createMany({
      data: state.safety_logs.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        userId: item.userId,
        amount: item.amount,
        reason: item.reason,
        metadata: item.metadata,
        createdAt: new Date(item.createdAt),
      })),
    });
  }
}

export async function readState() {
  await ensureStoreInitialized();
  return buildState(prisma);
}

export async function withStoreTransaction<T>(
  callback: (draft: NftSimState) => Promise<T> | T,
) {
  let result!: T;

  const runTransaction = transactionQueue.catch(() => undefined).then(async () => {
    await ensureStoreInitialized();
    await prisma.$transaction(async (tx) => {
      const current = await buildState(tx);
      const draft = cloneState(current);
      result = await callback(draft);
      await replaceState(tx, draft);
    });
  });

  transactionQueue = runTransaction.then(() => undefined, () => undefined);
  await runTransaction;

  return result;
}

export function getDataFilePath() {
  return "prisma/dev.db";
}
