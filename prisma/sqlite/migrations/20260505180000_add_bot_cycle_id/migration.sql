ALTER TABLE "nft_trades" ADD COLUMN "cycleId" TEXT;
ALTER TABLE "bot_activity" ADD COLUMN "cycleId" TEXT;

CREATE INDEX "nft_trades_cycleId_idx" ON "nft_trades"("cycleId");
CREATE INDEX "bot_activity_cycleId_idx" ON "bot_activity"("cycleId");
