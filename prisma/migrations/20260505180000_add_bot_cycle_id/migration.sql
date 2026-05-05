ALTER TABLE "nft_trades" ADD COLUMN IF NOT EXISTS "cycleId" TEXT;
ALTER TABLE "bot_activity" ADD COLUMN IF NOT EXISTS "cycleId" TEXT;

CREATE INDEX IF NOT EXISTS "nft_trades_cycleId_idx" ON "nft_trades"("cycleId");
CREATE INDEX IF NOT EXISTS "bot_activity_cycleId_idx" ON "bot_activity"("cycleId");
