DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WalletLedgerType'
  ) THEN
    ALTER TYPE "WalletLedgerType" ADD VALUE IF NOT EXISTS 'GXN_TOKEN_REWARD';
    ALTER TYPE "WalletLedgerType" ADD VALUE IF NOT EXISTS 'GXN_TOKEN_DEDUCTION';
  END IF;
END
$$;

ALTER TABLE "wallets"
  ADD COLUMN IF NOT EXISTS "gxnTokenBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "gxnDeductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "gxnTokens" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "withdrawalTxHash" TEXT;

ALTER TABLE "withdrawals"
  ADD COLUMN IF NOT EXISTS "onChainStatus" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "wallets"
  ALTER COLUMN "gxnTokenBalance" SET DEFAULT 0;

ALTER TABLE "withdrawals"
  ALTER COLUMN "gxnDeductionAmount" SET DEFAULT 0;

ALTER TABLE "withdrawals"
  ALTER COLUMN "gxnTokens" SET DEFAULT 0;

ALTER TABLE "withdrawals"
  ALTER COLUMN "onChainStatus" SET DEFAULT 'PENDING';

UPDATE "wallets"
SET "gxnTokenBalance" = 0
WHERE "gxnTokenBalance" IS NULL;

UPDATE "withdrawals"
SET
  "gxnDeductionAmount" = COALESCE("gxnDeductionAmount", 0),
  "gxnTokens" = COALESCE("gxnTokens", 0),
  "onChainStatus" = COALESCE("onChainStatus", 'PENDING');

CREATE UNIQUE INDEX IF NOT EXISTS "withdrawals_withdrawalTxHash_key"
  ON "withdrawals"("withdrawalTxHash");
