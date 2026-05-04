ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "users" ADD COLUMN "referralCodeUsed" TEXT;

CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");
CREATE INDEX "users_referredBy_idx" ON "users"("referredBy");
CREATE INDEX "users_referralCodeUsed_idx" ON "users"("referralCodeUsed");
