# Gainix NFT

## Production Deployment

Production uses PostgreSQL with the Prisma schema and migrations in `prisma/postgres`.
SQLite remains available for local development through the root `prisma/schema.prisma`.

### Required Environment

Create `.env` on the server. Do not commit real secrets.

```env
DATABASE_URL="postgresql://gainix_user:CHANGE_ME@127.0.0.1:5432/gainix_nft?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
BSC_CHAIN_ID=56
BSC_RPC_URL="https://bsc-dataseed.binance.org"
USDT_TOKEN_ADDRESS="0x55d398326f99059fF775485246999027B3197955"
PLATFORM_TREASURY_ADDRESS="0x..."
ADMIN_WALLET_ADDRESSES="0xAdmin1,0xAdmin2"
ADMIN_WALLETS="0xAdmin1,0xAdmin2"
OWNER_WALLET_ADDRESS="0xOwner"
NEXT_PUBLIC_ADMIN_WALLETS="0xAdmin1,0xAdmin2,0xOwner"
NEXT_PUBLIC_OWNER_WALLET_ADDRESS="0xOwner"
NEXT_PUBLIC_USDT_TOKEN_ADDRESS="0x55d398326f99059fF775485246999027B3197955"
NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS="0x..."
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_BSC_MAINNET_RPC_URL="https://bsc-dataseed.binance.org"
NEXT_PUBLIC_GAINIX_NFT_ADDRESS="0x..."
NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS="0x..."
NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS="0x..."
NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS="0x..."
NEXT_PUBLIC_USDT_CHAIN_ID=56
NEXT_PUBLIC_USE_MOCK_DATA=false
```

### VPS Commands

```bash
git clone <repo-url> gainix-nft
cd gainix-nft
npm ci
cp .env.example .env
nano .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
npm run start
```

For a process manager:

```bash
pm2 start npm --name gainix-nft -- start
pm2 save
```

### Local SQLite Development

Use the root Prisma schema with `DATABASE_URL="file:./dev.db"`.

```bash
npm install
npm run prisma:generate:local
npm run prisma:migrate
npm run dev
```

### Background Scheduler

The trading scheduler starts in the Node production runtime through `src/instrumentation.ts`
and is also initialized by API routes. Run one application process unless you intentionally
coordinate scheduler execution across multiple instances.

## MAINNET DEPLOYMENT CHECKLIST

1. Fund the deployer wallet with enough BNB on BNB Smart Chain mainnet for all contract deployments.
2. Copy `.env.mainnet.example` to `.env` on the deploy/build machine and fill all mainnet values.
3. Set `DEPLOYER_PRIVATE_KEY` only in a secure local/VPS environment. Never commit it and never expose it through a `NEXT_PUBLIC_` variable.
4. Set deployment wallets:
   - `INITIAL_OWNER`
   - `MARKETPLACE_FEE_RECIPIENT`
   - `BOTPASS_TREASURY`
   - `PLATFORM_TREASURY_WALLET`
   - `OWNER_WALLET_ADDRESS`
   - `ADMIN_WALLETS`
   - `NEXT_PUBLIC_ADMIN_WALLETS`
5. Run the mainnet deployment:

```bash
npm run deploy:bscMainnet
```

6. Copy the printed contract addresses into production `.env`:
   - `NEXT_PUBLIC_CHAIN_ID=56`
   - `NEXT_PUBLIC_GAINIX_NFT_ADDRESS`
   - `NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS`
   - `NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS`
   - `NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS`
7. Generate Prisma client and build:

```bash
npx prisma generate --schema prisma/schema.prisma
npm run build
```

8. Restart the production process with updated env:

```bash
pm2 restart gainix --update-env
```

Production builds with `NEXT_PUBLIC_CHAIN_ID=56` fail if any mainnet contract address is missing, zero, or still set to a placeholder such as `0x4444444444444444444444444444444444444457`.
