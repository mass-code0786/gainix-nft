-- Add VIP-based daily trading counters to users with a server-time reset anchor.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "walletAddress" TEXT NOT NULL,
  "selfPackageAmount" REAL NOT NULL DEFAULT 0,
  "currentVipLevel" INTEGER NOT NULL DEFAULT 0,
  "vipAchievedAt" DATETIME,
  "totalBuyCount" INTEGER NOT NULL DEFAULT 0,
  "totalSellCount" INTEGER NOT NULL DEFAULT 0,
  "dailyBuyCount" INTEGER NOT NULL DEFAULT 0,
  "dailySellCount" INTEGER NOT NULL DEFAULT 0,
  "lastTradeResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capitalUnlocked" BOOLEAN NOT NULL DEFAULT false,
  "capitalUnlockedAt" DATETIME,
  "capitalTransferredAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_users" (
  "id",
  "walletAddress",
  "selfPackageAmount",
  "currentVipLevel",
  "vipAchievedAt",
  "totalBuyCount",
  "totalSellCount",
  "dailyBuyCount",
  "dailySellCount",
  "lastTradeResetAt",
  "capitalUnlocked",
  "capitalUnlockedAt",
  "capitalTransferredAt",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "walletAddress",
  "selfPackageAmount",
  "currentVipLevel",
  "vipAchievedAt",
  "totalBuyCount",
  "totalSellCount",
  0,
  0,
  CURRENT_TIMESTAMP,
  "capitalUnlocked",
  "capitalUnlockedAt",
  "capitalTransferredAt",
  "createdAt",
  "updatedAt"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- Prevent duplicate royalty payouts for the same user, VIP level, and payout date.
CREATE UNIQUE INDEX "income_ledger_userId_vipLevel_payoutDate_key"
ON "income_ledger"("userId", "vipLevel", "payoutDate");
