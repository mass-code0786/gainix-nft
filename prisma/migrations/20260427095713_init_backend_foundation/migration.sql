-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Wallet" (
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
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NFT" (
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
    CONSTRAINT "NFT_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NFTTrade" (
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
    CONSTRAINT "NFTTrade_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NFTTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NFTTrade_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "BotSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "sourceTradeId" TEXT NOT NULL,
    "level" INTEGER,
    "sourceUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MLMTree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ancestorUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MLMTree_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MLMTree_ancestorUserId_fkey" FOREIGN KEY ("ancestorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotSubscription" (
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
    CONSTRAINT "BotSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "botSubscriptionId" TEXT NOT NULL,
    "nftId" TEXT,
    "action" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "profit" REAL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BotActivity_botSubscriptionId_fkey" FOREIGN KEY ("botSubscriptionId") REFERENCES "BotSubscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BotActivity_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grossAmount" REAL NOT NULL,
    "feeAmount" REAL NOT NULL,
    "netAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminSetting" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NFT_tokenId_key" ON "NFT"("tokenId");

-- CreateIndex
CREATE INDEX "NFTTrade_userId_createdAt_idx" ON "NFTTrade"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NFTTrade_nftId_createdAt_idx" ON "NFTTrade"("nftId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedger_userId_createdAt_idx" ON "WalletLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "IncomeLedger_userId_createdAt_idx" ON "IncomeLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MLMTree_ancestorUserId_level_idx" ON "MLMTree"("ancestorUserId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "MLMTree_userId_ancestorUserId_key" ON "MLMTree"("userId", "ancestorUserId");

-- CreateIndex
CREATE INDEX "BotSubscription_userId_createdAt_idx" ON "BotSubscription"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BotActivity_userId_createdAt_idx" ON "BotActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_createdAt_idx" ON "Withdrawal"("userId", "createdAt");
