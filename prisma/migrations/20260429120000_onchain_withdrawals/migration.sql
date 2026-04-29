ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "withdrawalTxHash" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "onChainStatus" TEXT NOT NULL DEFAULT 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_withdrawalTxHash_key" ON "withdrawals"("withdrawalTxHash");
