-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WalletLedgerType" AS ENUM ('DEPOSIT_TO_TRADING', 'NFT_BUY_DEBIT', 'NFT_SELL_PRINCIPAL_RETURN', 'NFT_TRADING_PROFIT', 'LEVEL_INCOME', 'BOT_PURCHASE_UPLINE_INCOME', 'BOT_TRADING_PROFIT', 'ROYALTY_INCOME', 'CAPITAL_TRANSFER_TO_WITHDRAWAL', 'CAPITAL_TRANSFER', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_FEE', 'BOT_PURCHASE_DEBIT');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('BOUGHT', 'LISTED', 'AUTO_SOLD');

-- CreateEnum
CREATE TYPE "TradeSource" AS ENUM ('MANUAL', 'BOT');

-- CreateEnum
CREATE TYPE "IncomeLedgerType" AS ENUM ('NFT_TRADING_INCOME', 'LEVEL_INCOME', 'BOT_PURCHASE_UPLINE_INCOME', 'BOT_TRADING_INCOME', 'ROYALTY_INCOME');

-- CreateEnum
CREATE TYPE "BotSubscriptionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BotActivityAction" AS ENUM ('AUTO_BUY', 'AUTO_LIST', 'AUTO_SELL');

-- CreateEnum
CREATE TYPE "BotActivityStatus" AS ENUM ('SUCCESS', 'WAITING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'APPROVED_PENDING_TX');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "selfPackageAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentVipLevel" INTEGER NOT NULL DEFAULT 0,
    "vipAchievedAt" TIMESTAMP(3),
    "totalBuyCount" INTEGER NOT NULL DEFAULT 0,
    "totalSellCount" INTEGER NOT NULL DEFAULT 0,
    "dailyBuyCount" INTEGER NOT NULL DEFAULT 0,
    "dailySellCount" INTEGER NOT NULL DEFAULT 0,
    "lastTradeResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capitalUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "capitalUnlockedAt" TIMESTAMP(3),
    "capitalTransferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradingWallet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawalWallet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposited" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "isCapitalUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfts" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "lastBuyPrice" DOUBLE PRECISION,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "lastPriceIncreasePercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nft_trades" (
    "id" TEXT NOT NULL,
    "nftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "status" "TradeStatus" NOT NULL,
    "listedAt" TIMESTAMP(3),
    "autoSellAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "saleJobId" TEXT,
    "source" "TradeSource" NOT NULL DEFAULT 'MANUAL',
    "botSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "creditedAmount" DOUBLE PRECISION,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IncomeLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sourceTradeId" TEXT NOT NULL,
    "level" INTEGER,
    "sourceUserId" TEXT,
    "vipLevel" INTEGER,
    "payoutDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mlm_tree" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ancestorUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mlm_tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalBuyTrades" INTEGER NOT NULL,
    "totalSellTrades" INTEGER NOT NULL,
    "completedBuyTrades" INTEGER NOT NULL DEFAULT 0,
    "completedSellTrades" INTEGER NOT NULL DEFAULT 0,
    "remainingBuyTrades" INTEGER NOT NULL,
    "remainingSellTrades" INTEGER NOT NULL,
    "status" "BotSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastExecutedAt" TIMESTAMP(3),
    "uplineIncomePaidAt" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botSubscriptionId" TEXT NOT NULL,
    "nftId" TEXT,
    "action" "BotActivityAction" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION,
    "status" "BotActivityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "approvedAt" TIMESTAMP(3),
    "payoutTxHash" TEXT,
    "payoutStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "nftPriceIncreaseMinPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "nftPriceIncreaseMaxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "autoSellDelayMinMinutes" INTEGER NOT NULL DEFAULT 10,
    "autoSellDelayMaxMinutes" INTEGER NOT NULL DEFAULT 30,
    "botProfitMinPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "botProfitMaxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "withdrawalMinimumAmount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "withdrawalFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "vipMinimumTeamPackageAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "vipFirstPayoutDay" INTEGER NOT NULL DEFAULT 10,
    "vipSecondPayoutDay" INTEGER NOT NULL DEFAULT 20,
    "vipRecurringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payoutsPaused" BOOLEAN NOT NULL DEFAULT false,
    "systemStopped" BOOLEAN NOT NULL DEFAULT false,
    "globalDailyPayoutCap" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "perUserDailyPayoutCap" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "maxDailyWithdrawalAmountPerUser" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "minimumTradeAmount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_reserve" (
    "id" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "totalMlmPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRoyaltyPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNftTradingPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBotTradingPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBotPurchaseUplinePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_reserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_logs" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "amount" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "walletAddress" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "nfts_tokenId_key" ON "nfts"("tokenId");

-- CreateIndex
CREATE INDEX "nft_trades_userId_createdAt_idx" ON "nft_trades"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "nft_trades_nftId_createdAt_idx" ON "nft_trades"("nftId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledger_userId_createdAt_idx" ON "wallet_ledger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_txHash_key" ON "deposits"("txHash");

-- CreateIndex
CREATE INDEX "deposits_userId_createdAt_idx" ON "deposits"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "income_ledger_userId_createdAt_idx" ON "income_ledger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "income_ledger_userId_vipLevel_payoutDate_key" ON "income_ledger"("userId", "vipLevel", "payoutDate");

-- CreateIndex
CREATE INDEX "mlm_tree_ancestorUserId_level_idx" ON "mlm_tree"("ancestorUserId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "mlm_tree_userId_ancestorUserId_key" ON "mlm_tree"("userId", "ancestorUserId");

-- CreateIndex
CREATE INDEX "bot_subscriptions_userId_createdAt_idx" ON "bot_subscriptions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bot_activity_userId_createdAt_idx" ON "bot_activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "withdrawals_userId_createdAt_idx" ON "withdrawals"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "safety_logs_eventType_createdAt_idx" ON "safety_logs"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "safety_logs_userId_createdAt_idx" ON "safety_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_walletAddress_createdAt_idx" ON "audit_logs"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfts" ADD CONSTRAINT "nfts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_trades" ADD CONSTRAINT "nft_trades_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nfts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_trades" ADD CONSTRAINT "nft_trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nft_trades" ADD CONSTRAINT "nft_trades_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "bot_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_ledger" ADD CONSTRAINT "income_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlm_tree" ADD CONSTRAINT "mlm_tree_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlm_tree" ADD CONSTRAINT "mlm_tree_ancestorUserId_fkey" FOREIGN KEY ("ancestorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_subscriptions" ADD CONSTRAINT "bot_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_activity" ADD CONSTRAINT "bot_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_activity" ADD CONSTRAINT "bot_activity_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "bot_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_activity" ADD CONSTRAINT "bot_activity_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nfts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
