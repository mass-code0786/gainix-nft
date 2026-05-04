UPDATE "users"
SET "referralCode" = "walletAddress"
WHERE "referralCode" IS NULL;

ALTER TABLE "users" ALTER COLUMN "referralCode" SET NOT NULL;
