DELETE FROM "nfts"
WHERE "status" = 'marketplace'
  AND "ownerUserId" IS NULL
  AND "tokenId" IN ('1001', '1002', '1003', '1004')
  AND "name" IN (
    'Gainix Alpha Tiger',
    'Gainix Neon Falcon',
    'Gainix Prism Wolf',
    'Gainix Solar Panther'
  );
