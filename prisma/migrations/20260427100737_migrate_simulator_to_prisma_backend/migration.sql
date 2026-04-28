/*
  Warnings:

  - You are about to drop the `AdminSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BotActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BotSubscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IncomeLedger` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MLMTree` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NFT` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NFTTrade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletLedger` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Withdrawal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminSetting";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BotActivity";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BotSubscription";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "IncomeLedger";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MLMTree";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NFT";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NFTTrade";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Wallet";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WalletLedger";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Withdrawal";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tradingWallet" REAL NOT NULL DEFAULT 0,
    "withdrawalWallet" REAL NOT NULL DEFAULT 0,
    "totalDeposited" REAL NOT NULL DEFAULT 0,
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "isCapitalUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nfts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "basePrice" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "lastBuyPrice" REAL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "lastPriceIncreasePercent" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "nfts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nft_trades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buyPrice" REAL NOT NULL,
    "sellPrice" REAL,
    "profit" REAL,
    "status" TEXT NOT NULL,
    "listedAt" DATETIME,
    "autoSellAt" DATETIME,
    "soldAt" DATETIME,
    "saleJobId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "botSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "nft_trades_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nfts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nft_trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nft_trades_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "bot_subscriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "income_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "sourceTradeId" TEXT NOT NULL,
    "level" INTEGER,
    "sourceUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "income_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mlm_tree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ancestorUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mlm_tree_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mlm_tree_ancestorUserId_fkey" FOREIGN KEY ("ancestorUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bot_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "totalBuyTrades" INTEGER NOT NULL,
    "totalSellTrades" INTEGER NOT NULL,
    "completedBuyTrades" INTEGER NOT NULL DEFAULT 0,
    "completedSellTrades" INTEGER NOT NULL DEFAULT 0,
    "remainingBuyTrades" INTEGER NOT NULL,
    "remainingSellTrades" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastExecutedAt" DATETIME,
    "uplineIncomePaidAt" DATETIME,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bot_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bot_activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "botSubscriptionId" TEXT NOT NULL,
    "nftId" TEXT,
    "action" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "profit" REAL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bot_activity_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "bot_subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bot_activity_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "nfts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grossAmount" REAL NOT NULL,
    "feeAmount" REAL NOT NULL,
    "netAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nftPriceIncreaseMinPercent" REAL NOT NULL DEFAULT 0.25,
    "nftPriceIncreaseMaxPercent" REAL NOT NULL DEFAULT 0.35,
    "autoSellDelayMinMinutes" INTEGER NOT NULL DEFAULT 10,
    "autoSellDelayMaxMinutes" INTEGER NOT NULL DEFAULT 30,
    "botProfitMinPercent" REAL NOT NULL DEFAULT 0.25,
    "botProfitMaxPercent" REAL NOT NULL DEFAULT 0.35,
    "withdrawalMinimumAmount" REAL NOT NULL DEFAULT 10,
    "withdrawalFeePercent" REAL NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "system_reserve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balance" REAL NOT NULL,
    "totalMlmPaid" REAL NOT NULL DEFAULT 0,
    "totalBotTradingPaid" REAL NOT NULL DEFAULT 0,
    "totalBotPurchaseUplinePaid" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
CREATE INDEX "income_ledger_userId_createdAt_idx" ON "income_ledger"("userId", "createdAt");

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
