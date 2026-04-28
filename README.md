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
NEXT_PUBLIC_USDT_TOKEN_ADDRESS="0x55d398326f99059fF775485246999027B3197955"
NEXT_PUBLIC_PLATFORM_TREASURY_ADDRESS="0x..."
NEXT_PUBLIC_BSC_RPC_URL="https://bsc-dataseed.binance.org"
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
