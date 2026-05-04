ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCodeUsed" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key" ON "users"("referralCode");
CREATE INDEX IF NOT EXISTS "users_referredBy_idx" ON "users"("referredBy");
CREATE INDEX IF NOT EXISTS "users_referralCodeUsed_idx" ON "users"("referralCodeUsed");
