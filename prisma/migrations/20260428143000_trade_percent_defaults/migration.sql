UPDATE "admin_settings"
SET "nftPriceIncreaseMinPercent" = 0.25
WHERE "nftPriceIncreaseMinPercent" = 25;

UPDATE "admin_settings"
SET "nftPriceIncreaseMaxPercent" = 0.35
WHERE "nftPriceIncreaseMaxPercent" = 35;

UPDATE "admin_settings"
SET "botProfitMinPercent" = 0.25
WHERE "botProfitMinPercent" = 25;

UPDATE "admin_settings"
SET "botProfitMaxPercent" = 0.35
WHERE "botProfitMaxPercent" = 35;
