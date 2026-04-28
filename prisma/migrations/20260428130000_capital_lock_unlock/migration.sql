ALTER TABLE "users" ADD COLUMN "totalBuyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "totalSellCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "capitalUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "capitalUnlockedAt" DATETIME;
ALTER TABLE "users" ADD COLUMN "capitalTransferredAt" DATETIME;

UPDATE "users"
SET
  "totalBuyCount" = COALESCE((SELECT "buyCount" FROM "wallets" WHERE "wallets"."userId" = "users"."id"), 0),
  "totalSellCount" = COALESCE((SELECT "sellCount" FROM "wallets" WHERE "wallets"."userId" = "users"."id"), 0),
  "capitalUnlocked" = COALESCE((SELECT "isCapitalUnlocked" FROM "wallets" WHERE "wallets"."userId" = "users"."id"), false),
  "capitalUnlockedAt" = CASE
    WHEN COALESCE((SELECT "isCapitalUnlocked" FROM "wallets" WHERE "wallets"."userId" = "users"."id"), false) THEN CURRENT_TIMESTAMP
    ELSE NULL
  END;
