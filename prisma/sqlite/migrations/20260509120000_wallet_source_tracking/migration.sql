ALTER TABLE "nft_trades" ADD COLUMN "tradingWalletUsed" REAL NOT NULL DEFAULT 0;
ALTER TABLE "nft_trades" ADD COLUMN "withdrawalWalletUsed" REAL NOT NULL DEFAULT 0;
ALTER TABLE "nft_trades" ADD COLUMN "totalBuyAmount" REAL NOT NULL DEFAULT 0;

UPDATE "nft_trades"
SET
  "tradingWalletUsed" = CASE
    WHEN "tradingWalletUsed" = 0 AND "withdrawalWalletUsed" = 0 THEN "buyPrice"
    ELSE "tradingWalletUsed"
  END,
  "totalBuyAmount" = CASE
    WHEN "totalBuyAmount" = 0 THEN "buyPrice"
    ELSE "totalBuyAmount"
  END;
