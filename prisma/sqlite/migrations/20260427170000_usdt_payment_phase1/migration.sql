-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "expectedAmount" REAL NOT NULL,
    "creditedAmount" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "deposits_txHash_key" ON "deposits"("txHash");

-- CreateIndex
CREATE INDEX "deposits_userId_createdAt_idx" ON "deposits"("userId", "createdAt");

-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN "payoutTxHash" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN "payoutStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
