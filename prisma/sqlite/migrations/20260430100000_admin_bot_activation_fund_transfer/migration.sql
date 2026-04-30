-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bot_subscriptions" (
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
    "activatedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bot_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_bot_subscriptions" ("completedAt", "completedBuyTrades", "completedSellTrades", "createdAt", "id", "lastExecutedAt", "planId", "planName", "price", "purchasedAt", "remainingBuyTrades", "remainingSellTrades", "status", "totalBuyTrades", "totalSellTrades", "updatedAt", "uplineIncomePaidAt", "userId")
SELECT "completedAt", "completedBuyTrades", "completedSellTrades", "createdAt", "id", "lastExecutedAt", "planId", "planName", "price", "purchasedAt", "remainingBuyTrades", "remainingSellTrades", "status", "totalBuyTrades", "totalSellTrades", "updatedAt", "uplineIncomePaidAt", "userId" FROM "bot_subscriptions";
DROP TABLE "bot_subscriptions";
ALTER TABLE "new_bot_subscriptions" RENAME TO "bot_subscriptions";
CREATE INDEX "bot_subscriptions_userId_createdAt_idx" ON "bot_subscriptions"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
