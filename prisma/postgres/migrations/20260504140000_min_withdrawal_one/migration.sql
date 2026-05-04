ALTER TABLE "admin_settings"
ALTER COLUMN "withdrawalMinimumAmount" SET DEFAULT 1;

UPDATE "admin_settings"
SET "withdrawalMinimumAmount" = 1
WHERE "withdrawalMinimumAmount" = 10;
