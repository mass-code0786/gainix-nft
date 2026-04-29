-- AlterTable
ALTER TABLE "income_ledger" ADD COLUMN "payoutDate" DATETIME;
ALTER TABLE "income_ledger" ADD COLUMN "vipLevel" INTEGER;

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_admin_settings" ("autoSellDelayMaxMinutes", "autoSellDelayMinMinutes", "botProfitMaxPercent", "botProfitMinPercent", "createdAt", "id", "nftPriceIncreaseMaxPercent", "nftPriceIncreaseMinPercent", "updatedAt", "withdrawalFeePercent", "withdrawalMinimumAmount") SELECT "autoSellDelayMaxMinutes", "autoSellDelayMinMinutes", "botProfitMaxPercent", "botProfitMinPercent", "createdAt", "id", "nftPriceIncreaseMaxPercent", "nftPriceIncreaseMinPercent", "updatedAt", "withdrawalFeePercent", "withdrawalMinimumAmount" FROM "admin_settings";
DROP TABLE "admin_settings";
ALTER TABLE "new_admin_settings" RENAME TO "admin_settings";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "selfPackageAmount" REAL NOT NULL DEFAULT 0,
    "currentVipLevel" INTEGER NOT NULL DEFAULT 0,
    "vipAchievedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "id", "updatedAt", "walletAddress") SELECT "createdAt", "id", "updatedAt", "walletAddress" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
