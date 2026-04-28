# Gainix Solidity Contracts (BNB Smart Chain Testnet)

This folder contains deployment-ready smart contracts for Gainix:

- `GainixNFT.sol`: ERC-721 collection with admin mint and token URI controls.
- `GainixMarketplace.sol`: Escrow listing marketplace with list/cancel/buy flows.
- `GainixBotPass.sol`: Utility subscription contract for bot execution cycles.

## Network Target

- BNB Smart Chain Testnet
- Chain ID: `97`

## Contract Highlights

### GainixNFT
- OpenZeppelin ERC-721 + URI storage
- Owner/admin mint support (`adminMint`)
- Token URI updates (`setTokenUri`)
- Base URI updates (`setBaseTokenUri`)
- Admin management (`setAdmin`)
- Events:
  - `AdminMint`
  - `TokenUriUpdated`
  - `BaseTokenUriUpdated`

### GainixMarketplace
- OpenZeppelin Ownable + ReentrancyGuard + Pausable
- Listing creation with escrow transfer (`listItem`)
- Listing cancellation (`cancelListing`)
- Buy listed NFT (`buyItem`)
- Fee recipient + fee bps controls
- Events:
  - `ListingCreated`
  - `ListingCancelled`
  - `ListingFilled`

### GainixBotPass
- Utility plan catalog (price + cycles)
- Purchase / renew subscription (`subscribe`, `renewSubscription`)
- Subscription query (`subscriptionOf`)
- Operator cycle consumption (`consumeCycles`)
- Events:
  - `BotPassPurchased`
  - `SubscriptionUpdated`
  - `CycleConsumed`

## Setup

1. Copy `.env.example` to `.env`.
2. Fill real wallet/RPC values.
3. Install deps:

```bash
cd solidity
npm install
```

4. Compile:

```bash
npm run compile
```

5. Deploy to BSC testnet:

```bash
npm run deploy:bscTestnet
```

## Deployment Order

1. Deploy `GainixNFT`
2. Deploy `GainixMarketplace`
3. Deploy `GainixBotPass`
4. Update frontend env values:
   - `NEXT_PUBLIC_BSC_TESTNET_NFT_CONTRACT`
   - `NEXT_PUBLIC_BSC_TESTNET_MARKETPLACE_CONTRACT`
   - `NEXT_PUBLIC_BSC_TESTNET_BOTPASS_CONTRACT`

## Frontend Integration Points

The current frontend hook/action layer should map directly to these methods:

- `useListNFT` -> `GainixMarketplace.listItem(address nftContract, uint256 tokenId, uint256 price)`
- `useCancelListing` -> `GainixMarketplace.cancelListing(uint256 listingId)`
- `useBuyNFT` -> `GainixMarketplace.buyItem(uint256 listingId)` with `msg.value = listing.price`
- `useBotPassPurchase` -> `GainixBotPass.subscribe(uint256 planId)` with `msg.value = plan.priceWei`
- wallet/bot state reads:
  - `GainixBotPass.subscriptionOf(address user)`
  - `GainixNFT.ownerOf(uint256 tokenId)`
  - `GainixNFT.tokenURI(uint256 tokenId)`

For production reads and activity feeds, index these events:

- `ListingCreated`, `ListingCancelled`, `ListingFilled`
- `Transfer` (ERC-721)
- `AdminMint`
- `BotPassPurchased`, `SubscriptionUpdated`, `CycleConsumed`

## Notes

- Contracts are structured for real read/write integration, while the frontend can keep mock fallbacks until final addresses are deployed.
- No guaranteed-profit logic exists in bot pass flows. Utility only.
