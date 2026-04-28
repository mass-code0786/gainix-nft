-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_admin_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nftPriceIncreaseMinPercent" REAL NOT NULL DEFAULT 0.25,
    "nftPriceIncreaseMaxPercent" REAL NOT NULL DEFAULT 0.35,
    "autoSellDelayMinMinutes" INTEGER NOT NULL DEFAULT 10,
    "autoSellDelayMaxMinutes" INTEGER NOT NULL DEFAULT 30,
    "botProfitMinPercent" REAL NOT NULL DEFAULT 0.25,
    "botProfitMaxPercent" REAL NOT NULL DEFAULT 0.35,
    "withdrawalMinimumAmount" REAL NOT NULL DEFAULT 10,
    "withdrawalFeePercent" REAL NOT NULL DEFAULT 10,
    "vipMinimumTeamPackageAmount" REAL NOT NULL DEFAULT 100,
    "vipFirstPayoutDay" INTEGER NOT NULL DEFAULT 10,
    "vipSecondPayoutDay" INTEGER NOT NULL DEFAULT 20,
    "vipRecurringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payoutsPaused" BOOLEAN NOT NULL DEFAULT false,
    "systemStopped" BOOLEAN NOT NULL DEFAULT false,
    "globalDailyPayoutCap" REAL NOT NULL DEFAULT 10000,
    "perUserDailyPayoutCap" REAL NOT NULL DEFAULT 1000,
    "maxDailyWithdrawalAmountPerUser" REAL NOT NULL DEFAULT 500,
    "minimumTradeAmount" REAL NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_admin_settings" ("autoSellDelayMaxMinutes", "autoSellDelayMinMinutes", "botProfitMaxPercent", "botProfitMinPercent", "createdAt", "id", "nftPriceIncreaseMaxPercent", "nftPriceIncreaseMinPercent", "payoutsPaused", "updatedAt", "vipFirstPayoutDay", "vipMinimumTeamPackageAmount", "vipRecurringEnabled", "vipSecondPayoutDay", "withdrawalFeePercent", "withdrawalMinimumAmount") SELECT "autoSellDelayMaxMinutes", "autoSellDelayMinMinutes", "botProfitMaxPercent", "botProfitMinPercent", "createdAt", "id", "nftPriceIncreaseMaxPercent", "nftPriceIncreaseMinPercent", "payoutsPaused", "updatedAt", "vipFirstPayoutDay", "vipMinimumTeamPackageAmount", "vipRecurringEnabled", "vipSecondPayoutDay", "withdrawalFeePercent", "withdrawalMinimumAmount" FROM "admin_settings";
DROP TABLE "admin_settings";
ALTER TABLE "new_admin_settings" RENAME TO "admin_settings";
CREATE TABLE "new_bot_activity" (
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
INSERT INTO "new_bot_activity" ("action", "amount", "botSubscriptionId", "createdAt", "id", "nftId", "profit", "status", "userId") SELECT "action", "amount", "botSubscriptionId", "createdAt", "id", "nftId", "profit", "status", "userId" FROM "bot_activity";
DROP TABLE "bot_activity";
ALTER TABLE "new_bot_activity" RENAME TO "bot_activity";
CREATE INDEX "bot_activity_userId_createdAt_idx" ON "bot_activity"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "safety_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "amount" REAL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "safety_logs_eventType_createdAt_idx" ON "safety_logs"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "safety_logs_userId_createdAt_idx" ON "safety_logs"("userId", "createdAt");

-- AlterTable
ALTER TABLE "system_reserve" ADD COLUMN "totalRoyaltyPaid" REAL NOT NULL DEFAULT 0;
ALTER TABLE "system_reserve" ADD COLUMN "totalNftTradingPaid" REAL NOT NULL DEFAULT 0;
ALTER TABLE "withdrawals" ADD COLUMN "approvedAt" DATETIME;
