-- AlterEnum
ALTER TYPE "WalletLedgerType" ADD VALUE 'ADMIN_CREDIT';

-- AlterEnum
ALTER TYPE "IncomeLedgerType" ADD VALUE 'ADMIN_CREDIT';

-- AlterTable
ALTER TABLE "bot_subscriptions" ADD COLUMN "activatedByAdmin" BOOLEAN NOT NULL DEFAULT false;
