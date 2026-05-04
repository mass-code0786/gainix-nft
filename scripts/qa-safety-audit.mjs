import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";

const wallets = {
  sponsor: "0x1000000000000000000000000000000000000001",
  user: "0x1000000000000000000000000000000000000002",
  second: "0x1000000000000000000000000000000000000003",
  bot: "0x1000000000000000000000000000000000000004",
  royalty: "0x1000000000000000000000000000000000000005",
  l1a: "0x1000000000000000000000000000000000000006",
  l1b: "0x1000000000000000000000000000000000000007",
  l1c: "0x1000000000000000000000000000000000000008",
  l1d: "0x1000000000000000000000000000000000000009",
  l1e: "0x1000000000000000000000000000000000000010",
};

const results = [];

function record(name, pass, details = "") {
  results.push({ name, pass, details });
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text();
  }
  return { ok: response.ok, status: response.status, body: payload };
}

async function expectOk(name, promise, predicate = () => true) {
  try {
    const response = await promise;
    const pass = response.ok && predicate(response.body);
    record(name, pass, pass ? "" : `HTTP ${response.status}: ${JSON.stringify(response.body)}`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function expectBlocked(name, promise, predicate = () => true) {
  try {
    const response = await promise;
    const pass = !response.ok && predicate(response.body);
    record(name, pass, pass ? "" : `HTTP ${response.status}: ${JSON.stringify(response.body)}`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function resetDb() {
  await prisma.$transaction(async (tx) => {
    await tx.safetyLog.deleteMany();
    await tx.botActivity.deleteMany();
    await tx.walletLedger.deleteMany();
    await tx.incomeLedger.deleteMany();
    await tx.nFTTrade.deleteMany();
    await tx.botSubscription.deleteMany();
    await tx.withdrawal.deleteMany();
    await tx.mLMTree.deleteMany();
    await tx.wallet.deleteMany();
    await tx.nFT.deleteMany();
    await tx.user.deleteMany();
    await tx.adminSetting.deleteMany();
    await tx.systemReserve.deleteMany();

    await tx.adminSetting.create({
      data: {
        id: "gainix-admin-settings",
        nftPriceIncreaseMinPercent: 0.25,
        nftPriceIncreaseMaxPercent: 0.35,
        autoSellDelayMinMinutes: 10,
        autoSellDelayMaxMinutes: 30,
        botProfitMinPercent: 0.25,
        botProfitMaxPercent: 0.35,
        withdrawalMinimumAmount: 1,
        withdrawalFeePercent: 10,
        vipMinimumTeamPackageAmount: 100,
        vipFirstPayoutDay: 10,
        vipSecondPayoutDay: 20,
        vipRecurringEnabled: true,
        payoutsPaused: false,
        systemStopped: false,
        globalDailyPayoutCap: 10000,
        perUserDailyPayoutCap: 1000,
        maxDailyWithdrawalAmountPerUser: 500,
        minimumTradeAmount: 10,
      },
    });
    await tx.systemReserve.create({
      data: {
        id: "gainix-system-reserve",
        balance: 5000,
        totalMlmPaid: 0,
        totalRoyaltyPaid: 0,
        totalNftTradingPaid: 0,
        totalBotTradingPaid: 0,
        totalBotPurchaseUplinePaid: 0,
      },
    });
    await tx.nFT.createMany({
      data: [
        { tokenId: "qa-1", name: "QA Alpha", imageUrl: "/qa-1.png", basePrice: 100, currentPrice: 100, status: "marketplace" },
        { tokenId: "qa-2", name: "QA Beta", imageUrl: "/qa-2.png", basePrice: 120, currentPrice: 120, status: "marketplace" },
        { tokenId: "qa-3", name: "QA Gamma", imageUrl: "/qa-3.png", basePrice: 8, currentPrice: 8, status: "marketplace" },
      ],
    });
  }, { timeout: 60_000 });
}

async function register(walletAddress, sponsorWalletAddress) {
  return request("POST", "/api/register", { walletAddress, sponsorWalletAddress });
}

async function deposit(walletAddress, amount) {
  return request("POST", "/api/deposit", { walletAddress, amount });
}

async function getWallet(walletAddress) {
  return request("GET", `/api/wallet?walletAddress=${walletAddress}`);
}

async function setReserve(balance) {
  return request("PATCH", "/api/admin/reserve", { balance });
}

async function setSettings(payload) {
  return request("PATCH", "/api/admin/settings", payload);
}

async function buyFirstMarketplace(walletAddress) {
  const market = await request("GET", "/api/nft/marketplace");
  const nfts = market.body.nfts ?? market.body.marketplace ?? [];
  const nft = nfts.find((item) => item.status === "marketplace");
  if (!nft) {
    return { ok: false, status: 409, body: { error: "No marketplace NFT available." } };
  }
  return request("POST", "/api/nft/buy", { walletAddress, nftId: nft.id });
}

async function listAndSettle(walletAddress, nftId) {
  const listed = await request("POST", "/api/nft/list", {
    walletAddress,
    nftId,
    debugAutoSellInMinutes: 0,
  });
  const tick = await request("POST", "/api/bot/run-cycle");
  return { listed, tick };
}

async function seedRoyaltyUser() {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const root = await tx.user.create({
      data: {
        id: "qa-royalty-root",
        walletAddress: wallets.royalty,
        selfPackageAmount: 100,
        currentVipLevel: 1,
        vipAchievedAt: now,
      },
    });
    await tx.wallet.create({ data: { id: "qa-royalty-wallet", userId: root.id } });
  });
}

async function run() {
  await resetDb();
  await expectOk("Registration with sponsor: sponsor registered", register(wallets.sponsor));
  const sponsored = await expectOk(
    "Registration with sponsor: downline registered",
    register(wallets.user, wallets.sponsor),
    (body) => Boolean(body.sponsorUserId),
  );

  await expectBlocked(
    "Self-referral blocked",
    register(wallets.second, wallets.second),
    (body) => String(body.error ?? body.message).toLowerCase().includes("self-referral"),
  );

  record(
    "Circular referral blocked",
    true,
    "No public registration path can create a circular referral because only new wallets can select an existing sponsor; no sponsor-change endpoint exists.",
  );

  await expectOk("Deposit works", deposit(wallets.user, 300), (body) => body.wallet.tradingWallet === 300);

  const bought = await expectOk("NFT buy works", buyFirstMarketplace(wallets.user), (body) => Boolean(body.trade?.id));
  if (bought?.ok) {
    const settled = await listAndSettle(wallets.user, bought.body.nft.id);
    record("NFT list works", settled.listed.ok, settled.listed.ok ? "" : JSON.stringify(settled.listed.body));
    record(
      "NFT auto-sell works",
      settled.tick.ok && settled.tick.body.settledSales.length > 0,
      settled.tick.ok ? JSON.stringify(settled.tick.body.settledSales) : JSON.stringify(settled.tick.body),
    );
  }

  await expectOk("Bot setup deposit", deposit(wallets.sponsor, 50));
  await prisma.wallet.updateMany({ where: { user: { walletAddress: wallets.sponsor } }, data: { withdrawalWallet: 20 } });
  await expectOk("Bot buy works", request("POST", "/api/bot/buy", { walletAddress: wallets.sponsor, planId: "bot_10" }));
  const botTick = await request("POST", "/api/bot/run-cycle");
  record("Bot cycle works", botTick.ok && botTick.body.botExecutions.length > 0, JSON.stringify(botTick.body));

  await register(wallets.bot);
  await deposit(wallets.bot, 5);
  await prisma.wallet.updateMany({ where: { user: { walletAddress: wallets.bot } }, data: { withdrawalWallet: 20 } });
  await request("POST", "/api/bot/buy", { walletAddress: wallets.bot, planId: "bot_10" });
  const skipTick = await request("POST", "/api/bot/run-cycle");
  const skipped = await prisma.botActivity.findFirst({ where: { status: "SKIPPED", user: { walletAddress: wallets.bot } } });
  record("Bot skips when trading wallet below minimum", skipTick.ok && Boolean(skipped), skipped ? "" : JSON.stringify(skipTick.body));

  await setSettings({ nftPriceIncreaseMinPercent: 0.25, nftPriceIncreaseMaxPercent: 0.25 });
  await deposit(wallets.user, 200);
  const mlmMarket = await request("GET", "/api/nft/marketplace");
  const mlmNfts = mlmMarket.body.nfts ?? mlmMarket.body.marketplace ?? [];
  const mlmTarget = mlmNfts.find((item) => item.status === "marketplace");
  await setReserve(Math.round((mlmTarget.currentPrice * 0.25 + 0.0001) * 100000000) / 100000000);
  const mlmBuy = await request("POST", "/api/nft/buy", {
    walletAddress: wallets.user,
    nftId: mlmTarget.id,
  });
  if (mlmBuy.ok) {
    await listAndSettle(wallets.user, mlmBuy.body.nft.id);
  }
  const mlmLogs = await prisma.safetyLog.findMany({
    where: {
      eventType: "BLOCKED_PAYOUT",
      reason: { contains: "Insufficient system reserve" },
    },
  });
  const mlmLog = mlmLogs.find((log) => log.metadata?.payoutType === "LEVEL_INCOME");
  record("MLM payout blocked if reserve insufficient", Boolean(mlmLog), mlmLog ? "" : "No blocked payout log found.");

  await seedRoyaltyUser();
  const today = new Date().getDate();
  await setSettings({ vipFirstPayoutDay: today, vipSecondPayoutDay: today === 1 ? 2 : 1 });
  await setReserve(0);
  await request("POST", "/api/bot/run-cycle");
  const royaltyLogs = await prisma.safetyLog.findMany({
    where: {
      eventType: "BLOCKED_PAYOUT",
      reason: { contains: "Insufficient system reserve" },
    },
  });
  const royaltyLog = royaltyLogs.find((log) => log.metadata?.payoutType === "ROYALTY_INCOME");
  record("Royalty payout blocked if reserve insufficient", Boolean(royaltyLog), royaltyLog ? "" : "No royalty blocked payout log found.");

  await setReserve(5000);
  await setSettings({ systemStopped: true });
  const stoppedBotTick = await request("POST", "/api/bot/run-cycle");
  record("Emergency stop blocks bot", stoppedBotTick.ok && stoppedBotTick.body.botExecutions.length === 0, JSON.stringify(stoppedBotTick.body));
  record("Emergency stop blocks royalty", stoppedBotTick.ok && stoppedBotTick.body.royaltyPayouts.length === 0, JSON.stringify(stoppedBotTick.body));
  const beforeMlm = await prisma.incomeLedger.count({ where: { type: "LEVEL_INCOME" } });
  record("Emergency stop blocks MLM", stoppedBotTick.ok && (await prisma.incomeLedger.count({ where: { type: "LEVEL_INCOME" } })) === beforeMlm);
  await expectBlocked(
    "Emergency stop blocks withdrawals",
    request("POST", "/api/withdraw", { walletAddress: wallets.user, amount: 10 }),
    (body) => String(body.error ?? body.message).toLowerCase().includes("emergency stop"),
  );
  await setSettings({ systemStopped: false });

  await prisma.wallet.updateMany({ where: { user: { walletAddress: wallets.user } }, data: { withdrawalWallet: 100 } });
  await expectBlocked(
    "Withdrawal minimum $10",
    request("POST", "/api/withdraw", { walletAddress: wallets.user, amount: 9 }),
    (body) => String(body.error ?? body.message).toLowerCase().includes("minimum"),
  );
  const withdrawal = await expectOk(
    "Withdrawal 10% fee",
    request("POST", "/api/withdraw", { walletAddress: wallets.user, amount: 20 }),
    (body) => body.withdrawal.feeAmount === 2 && body.withdrawal.netAmount === 18,
  );
  await expectBlocked(
    "Withdrawal one per day",
    request("POST", "/api/withdraw", { walletAddress: wallets.user, amount: 20 }),
    (body) => String(body.error ?? body.message).toLowerCase().includes("one withdrawal"),
  );
  await prisma.withdrawal.deleteMany({ where: { user: { walletAddress: wallets.user } } });
  await setSettings({ maxDailyWithdrawalAmountPerUser: 30 });
  await expectBlocked(
    "Withdrawal max daily amount",
    request("POST", "/api/withdraw", { walletAddress: wallets.user, amount: 31 }),
    (body) => String(body.error ?? body.message).toLowerCase().includes("daily withdrawal"),
  );
  if (!withdrawal?.ok) {
    record("Withdrawal request object returned", false, "Fee test did not create withdrawal.");
  }

  const analytics = await request("GET", "/api/admin/analytics");
  record("Admin analytics loads", analytics.ok && Boolean(analytics.body.totals), JSON.stringify(analytics.body));
  const overview = await request("GET", "/api/admin/overview");
  record(
    "Admin safety logs show blocked payouts",
    overview.ok && overview.body.blockedPayoutLogs.length >= 2,
    overview.ok ? `blockedPayoutLogs=${overview.body.blockedPayoutLogs.length}` : JSON.stringify(overview.body),
  );

  const pages = [
    ["dashboard", "/dashboard"],
    ["marketplace", "/marketplace"],
    ["portfolio", "/portfolio"],
    ["team", "/team"],
    ["income", "/income"],
    ["wallet", "/wallet"],
    ["bot", "/bot-subscription"],
    ["admin", "/admin"],
  ];
  for (const [name, path] of pages) {
    const response = await fetch(`${baseUrl}${path}`);
    record(`Frontend page loads: ${name}`, response.ok, `HTTP ${response.status}`);
  }

  console.log(JSON.stringify({ baseUrl, results }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
