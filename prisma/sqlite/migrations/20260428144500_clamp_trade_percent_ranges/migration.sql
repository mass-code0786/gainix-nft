UPDATE "admin_settings"
SET "nftPriceIncreaseMinPercent" = 0.25
WHERE "nftPriceIncreaseMinPercent" > 1;

UPDATE "admin_settings"
SET "nftPriceIncreaseMaxPercent" = 0.35
WHERE "nftPriceIncreaseMaxPercent" > 1;

UPDATE "admin_settings"
SET "botProfitMinPercent" = 0.25
WHERE "botProfitMinPercent" > 1;

UPDATE "admin_settings"
SET "botProfitMaxPercent" = 0.35
WHERE "botProfitMaxPercent" > 1;
