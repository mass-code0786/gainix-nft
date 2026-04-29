import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const port = Number(process.env.GAINIX_TEST_PORT ?? "3006");
const baseUrl = `http://127.0.0.1:${port}`;

const sponsorWallet = "0x2000000000000000000000000000000000000001";
const userWallet = "0x3000000000000000000000000000000000000001";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // wait
    }
    await sleep(1500);
  }

  throw new Error(`Timed out waiting for server at ${url}.`);
}

async function callApi(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    body: payload,
  };
}

async function getApi(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    body: payload,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function resetDatabase() {
  await prisma.$transaction(async (tx) => {
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

    await tx.nFT.createMany({
      data: [
        {
          id: "nft-1",
          tokenId: "1001",
          name: "Gainix Alpha Tiger",
          imageUrl: "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80",
          basePrice: 120,
          currentPrice: 120,
          status: "marketplace",
          totalTrades: 0,
        },
        {
          id: "nft-2",
          tokenId: "1002",
          name: "Gainix Neon Falcon",
          imageUrl: "https://images.unsplash.com/photo-1520808663317-647b476a81b9?auto=format&fit=crop&w=1200&q=80",
          basePrice: 175,
          currentPrice: 175,
          status: "marketplace",
          totalTrades: 0,
        },
        {
          id: "nft-3",
          tokenId: "1003",
          name: "Gainix Solar Panther",
          imageUrl: "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80",
          basePrice: 235,
          currentPrice: 235,
          status: "marketplace",
          totalTrades: 0,
        },
        {
          id: "nft-4",
          tokenId: "1004",
          name: "Gainix Prism Wolf",
          imageUrl: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1200&q=80",
          basePrice: 310,
          currentPrice: 310,
          status: "marketplace",
          totalTrades: 0,
        },
      ],
    });

    await tx.adminSetting.create({
      data: {
        id: "gainix-admin-settings",
        nftPriceIncreaseMinPercent: 0.25,
        nftPriceIncreaseMaxPercent: 0.35,
        autoSellDelayMinMinutes: 10,
        autoSellDelayMaxMinutes: 30,
        botProfitMinPercent: 0.25,
        botProfitMaxPercent: 0.35,
        withdrawalMinimumAmount: 10,
        withdrawalFeePercent: 10,
        vipMinimumTeamPackageAmount: 100,
        vipFirstPayoutDay: 10,
        vipSecondPayoutDay: 20,
        vipRecurringEnabled: true,
        payoutsPaused: false,
      },
    });

    await tx.systemReserve.create({
      data: {
        id: "gainix-system-reserve",
        balance: 5000,
        totalMlmPaid: 0,
        totalBotTradingPaid: 0,
        totalBotPurchaseUplinePaid: 0,
      },
    });
  });
}

function fixtureWallet(index) {
  return `0x${(index + 0x4000).toString(16).padStart(40, "0")}`;
}

async function createSponsorVipFixture() {
  const sponsor = await prisma.user.findFirstOrThrow({
    where: { walletAddress: sponsorWallet.toLowerCase() },
  });

  const users = [];
  const wallets = [];
  const mlmRows = [];

  let cursor = 1;
  for (let directIndex = 0; directIndex < 5; directIndex += 1) {
    const directId = `vip-direct-${directIndex + 1}`;
    users.push({
      id: directId,
      walletAddress: fixtureWallet(cursor),
      selfPackageAmount: 100,
      currentVipLevel: 0,
      vipAchievedAt: null,
    });
    wallets.push({
      id: `wallet-vip-direct-${directIndex + 1}`,
      userId: directId,
      tradingWallet: 0,
      withdrawalWallet: 0,
      totalDeposited: 0,
      buyCount: 0,
      sellCount: 0,
      isCapitalUnlocked: false,
    });
    cursor += 1;

    mlmRows.push({
      id: `mlm-sponsor-direct-${directIndex + 1}`,
      userId: directId,
      ancestorUserId: sponsor.id,
      level: 1,
    });

    for (let childIndex = 0; childIndex < 2; childIndex += 1) {
      const level2Id = `vip-level2-${directIndex * 2 + childIndex + 1}`;
      users.push({
        id: level2Id,
        walletAddress: fixtureWallet(cursor),
        selfPackageAmount: 100,
        currentVipLevel: 0,
        vipAchievedAt: null,
      });
      wallets.push({
        id: `wallet-${level2Id}`,
        userId: level2Id,
        tradingWallet: 0,
        withdrawalWallet: 0,
        totalDeposited: 0,
        buyCount: 0,
        sellCount: 0,
        isCapitalUnlocked: false,
      });
      cursor += 1;

      mlmRows.push({
        id: `mlm-direct-child-${level2Id}`,
        userId: level2Id,
        ancestorUserId: directId,
        level: 1,
      });
      mlmRows.push({
        id: `mlm-sponsor-child-${level2Id}`,
        userId: level2Id,
        ancestorUserId: sponsor.id,
        level: 2,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: sponsor.id },
      data: {
        selfPackageAmount: 100,
      },
    });
    await tx.user.createMany({ data: users });
    await tx.wallet.createMany({ data: wallets });
    await tx.mLMTree.createMany({ data: mlmRows });
  });
}

async function main() {
  const report = {
    commands: [
      "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm.cmd run dev -- --hostname 127.0.0.1 --port 3006' -WorkingDirectory 'C:\\Gainix\\Gainix NFT' -WindowStyle Hidden -PassThru",
      "node scripts/test-e2e-full.mjs",
      "npm.cmd run build",
      ".\\node_modules\\.bin\\tsc.cmd --noEmit",
    ],
    apiResponses: {},
    walletBalances: {},
    incomeLedgerEntries: {},
    failingStep: null,
    fixesApplied: [],
  };

  try {
    await resetDatabase();
    await waitForServer(`${baseUrl}/api/nft/marketplace`);

    report.apiResponses.registerSponsor = await callApi("POST", "/api/register", {
      walletAddress: sponsorWallet,
    });
    assert(report.apiResponses.registerSponsor.ok, "Sponsor registration failed.");

    report.apiResponses.registerUser = await callApi("POST", "/api/register", {
      walletAddress: userWallet,
      sponsorWalletAddress: sponsorWallet,
    });
    assert(report.apiResponses.registerUser.ok, "User registration failed.");

    await createSponsorVipFixture();

    report.apiResponses.deposit = await callApi("POST", "/api/deposit", {
      walletAddress: userWallet,
      amount: 200,
    });
    assert(report.apiResponses.deposit.ok, "Deposit failed.");

    report.apiResponses.walletAfterDeposit = await getApi(
      `/api/wallet?walletAddress=${userWallet}`,
    );
    assert(report.apiResponses.walletAfterDeposit.ok, "Wallet fetch after deposit failed.");
    report.walletBalances.afterDeposit = report.apiResponses.walletAfterDeposit.body;
    assert(report.walletBalances.afterDeposit.tradingWallet === 200, "Trading wallet should be 200 after deposit.");

    report.apiResponses.marketplace = await getApi("/api/nft/marketplace");
    assert(report.apiResponses.marketplace.ok, "Marketplace fetch failed.");
    const nftId = report.apiResponses.marketplace.body.marketplace[0].id;

    report.apiResponses.buyNft = await callApi("POST", "/api/nft/buy", {
      walletAddress: userWallet,
      nftId,
    });
    assert(report.apiResponses.buyNft.ok, "NFT buy failed.");

    report.apiResponses.walletAfterBuy = await getApi(`/api/wallet?walletAddress=${userWallet}`);
    assert(report.apiResponses.walletAfterBuy.ok, "Wallet fetch after buy failed.");
    report.walletBalances.afterBuy = report.apiResponses.walletAfterBuy.body;

    report.apiResponses.listNft = await callApi("POST", "/api/nft/list", {
      walletAddress: userWallet,
      nftId,
      debugAutoSellInMinutes: 0,
    });
    assert(report.apiResponses.listNft.ok, "NFT list failed.");

    report.apiResponses.engineAfterManualList = await callApi("POST", "/api/bot/run-cycle");
    assert(report.apiResponses.engineAfterManualList.ok, "Engine run after manual list failed.");

    report.apiResponses.walletAfterAutoSell = await getApi(`/api/wallet?walletAddress=${userWallet}`);
    assert(report.apiResponses.walletAfterAutoSell.ok, "Wallet fetch after auto-sell failed.");
    report.walletBalances.afterAutoSell = report.apiResponses.walletAfterAutoSell.body;

    const manualTrade = report.apiResponses.buyNft.body.trade;
    const manualProfit = report.apiResponses.engineAfterManualList.body.settledSales[0]?.profit ?? 0;
    assert(report.walletBalances.afterAutoSell.tradingWallet === 200, "Principal did not return to trading wallet.");
    assert(
      Math.abs(report.walletBalances.afterAutoSell.withdrawalWallet - manualProfit) < 0.000001,
      "Profit did not land in withdrawal wallet.",
    );

    report.apiResponses.sponsorWalletBeforeBotBuy = await getApi(
      `/api/wallet?walletAddress=${sponsorWallet}`,
    );
    assert(report.apiResponses.sponsorWalletBeforeBotBuy.ok, "Sponsor wallet fetch before bot buy failed.");
    report.walletBalances.sponsorBeforeBotBuy = report.apiResponses.sponsorWalletBeforeBotBuy.body;

    report.apiResponses.buyBot = await callApi("POST", "/api/bot/buy", {
      walletAddress: userWallet,
      planId: "bot_10",
    });
    assert(report.apiResponses.buyBot.ok, "Bot subscription purchase failed.");

    report.apiResponses.userWalletAfterBotBuy = await getApi(`/api/wallet?walletAddress=${userWallet}`);
    report.apiResponses.sponsorWalletAfterBotBuy = await getApi(`/api/wallet?walletAddress=${sponsorWallet}`);
    assert(report.apiResponses.userWalletAfterBotBuy.ok, "User wallet fetch after bot buy failed.");
    assert(report.apiResponses.sponsorWalletAfterBotBuy.ok, "Sponsor wallet fetch after bot buy failed.");
    report.walletBalances.userAfterBotBuy = report.apiResponses.userWalletAfterBotBuy.body;
    report.walletBalances.sponsorAfterBotBuy = report.apiResponses.sponsorWalletAfterBotBuy.body;

    const sponsorIncomeDelta =
      report.walletBalances.sponsorAfterBotBuy.withdrawalWallet -
      report.walletBalances.sponsorBeforeBotBuy.withdrawalWallet;
    assert(Math.abs(sponsorIncomeDelta - 2) < 0.000001, "Sponsor did not receive 20% bot income.");

    report.apiResponses.engineAfterBotBuy = await callApi("POST", "/api/bot/run-cycle");
    assert(report.apiResponses.engineAfterBotBuy.ok, "Engine run after bot buy failed.");

    report.apiResponses.botStatus = await getApi(`/api/bot/status?walletAddress=${userWallet}`);
    report.apiResponses.botActivity = await getApi(`/api/bot/activity?walletAddress=${userWallet}`);
    assert(report.apiResponses.botStatus.ok, "Bot status fetch failed.");
    assert(report.apiResponses.botActivity.ok, "Bot activity fetch failed.");
    assert(report.apiResponses.botStatus.body.activeSubscriptions >= 1, "Bot status did not show active subscription.");
    assert(report.apiResponses.botActivity.body.total > 0, "Bot activity did not appear.");

    report.apiResponses.incomeUser = await getApi(`/api/income?walletAddress=${userWallet}`);
    report.apiResponses.incomeSponsor = await getApi(`/api/income?walletAddress=${sponsorWallet}`);
    assert(report.apiResponses.incomeUser.ok, "User income fetch failed.");
    assert(report.apiResponses.incomeSponsor.ok, "Sponsor income fetch failed.");

    report.apiResponses.teamUser = await getApi(`/api/team?walletAddress=${userWallet}`);
    report.apiResponses.teamSponsor = await getApi(`/api/team?walletAddress=${sponsorWallet}`);
    assert(report.apiResponses.teamUser.ok, "User team fetch failed.");
    assert(report.apiResponses.teamSponsor.ok, "Sponsor team fetch failed.");

    report.apiResponses.createWithdrawal = await callApi("POST", "/api/withdraw", {
      walletAddress: userWallet,
      amount: 10,
    });
    assert(report.apiResponses.createWithdrawal.ok, "Withdrawal request failed.");
    const withdrawalId = report.apiResponses.createWithdrawal.body.withdrawal.id;

    const now = new Date();
    const today = now.getDate();
    const alternateDay = today === 20 ? 10 : 20;

    report.apiResponses.pausePayouts = await callApi("POST", "/api/admin/payout-control", {
      paused: true,
    });
    assert(report.apiResponses.pausePayouts.ok, "Pause payouts failed.");

    report.apiResponses.approveWhilePaused = await callApi(
      "POST",
      "/api/admin/withdrawals/approve",
      {
        withdrawalId,
      },
    );
    assert(
      report.apiResponses.approveWhilePaused.status === 409,
      "Withdrawal approval should be blocked while payouts are paused.",
    );

    report.apiResponses.setRoyaltyDatesToday = await callApi("PATCH", "/api/admin/settings", {
      vipFirstPayoutDay: today,
      vipSecondPayoutDay: alternateDay,
      vipRecurringEnabled: true,
    });
    assert(report.apiResponses.setRoyaltyDatesToday.ok, "Updating royalty payout days failed.");

    const sponsorUser = await prisma.user.findFirstOrThrow({
      where: { walletAddress: sponsorWallet.toLowerCase() },
    });
    const royaltyCountBeforePausedTick = await prisma.incomeLedger.count({
      where: {
        userId: sponsorUser.id,
        type: "ROYALTY_INCOME",
      },
    });

    report.apiResponses.royaltyStatusBefore = await getApi(
      `/api/royalty/status?walletAddress=${sponsorWallet}`,
    );
    assert(report.apiResponses.royaltyStatusBefore.ok, "Royalty status fetch before payout failed.");

    report.apiResponses.engineWhilePaused = await callApi("POST", "/api/bot/run-cycle");
    assert(report.apiResponses.engineWhilePaused.ok, "Engine run while paused failed.");

    const royaltyCountAfterPausedTick = await prisma.incomeLedger.count({
      where: {
        userId: sponsorUser.id,
        type: "ROYALTY_INCOME",
      },
    });
    assert(
      royaltyCountAfterPausedTick === royaltyCountBeforePausedTick,
      "Royalty payout should be blocked while payouts are paused.",
    );

    report.apiResponses.resumePayouts = await callApi("POST", "/api/admin/payout-control", {
      paused: false,
    });
    assert(report.apiResponses.resumePayouts.ok, "Resume payouts failed.");

    report.apiResponses.engineAfterResume = await callApi("POST", "/api/bot/run-cycle");
    assert(report.apiResponses.engineAfterResume.ok, "Engine run after payout resume failed.");

    report.apiResponses.approveAfterResume = await callApi(
      "POST",
      "/api/admin/withdrawals/approve",
      {
        withdrawalId,
      },
    );
    assert(report.apiResponses.approveAfterResume.ok, "Withdrawal approval after resume failed.");

    report.apiResponses.royaltyStatusAfter = await getApi(
      `/api/royalty/status?walletAddress=${sponsorWallet}`,
    );
    report.apiResponses.adminWithdrawals = await getApi("/api/admin/withdrawals");
    assert(report.apiResponses.royaltyStatusAfter.ok, "Royalty status fetch after payout failed.");
    assert(report.apiResponses.adminWithdrawals.ok, "Admin withdrawal list fetch failed.");

    const userRecord = await prisma.user.findFirstOrThrow({
      where: { walletAddress: userWallet.toLowerCase() },
    });
    const sponsorIncomeEntries = await prisma.incomeLedger.findMany({
      where: {
        userId: sponsorUser.id,
      },
      orderBy: { createdAt: "asc" },
    });
    const userIncomeEntries = await prisma.incomeLedger.findMany({
      where: {
        userId: userRecord.id,
      },
      orderBy: { createdAt: "asc" },
    });

    report.incomeLedgerEntries.user = userIncomeEntries.map((entry) => ({
      type: entry.type,
      amount: entry.amount,
      sourceTradeId: entry.sourceTradeId,
      createdAt: entry.createdAt.toISOString(),
      vipLevel: entry.vipLevel,
    }));
    report.incomeLedgerEntries.sponsor = sponsorIncomeEntries.map((entry) => ({
      type: entry.type,
      amount: entry.amount,
      sourceTradeId: entry.sourceTradeId,
      createdAt: entry.createdAt.toISOString(),
      vipLevel: entry.vipLevel,
    }));

    const royaltyTotal = report.apiResponses.royaltyStatusAfter.body.payoutHistory.reduce(
      (total, entry) => total + entry.amount,
      0,
    );
    assert(royaltyTotal >= 30, "Royalty payout did not credit after resuming payouts.");

    const approvedWithdrawal = report.apiResponses.adminWithdrawals.body.withdrawals.find(
      (item) => item.id === withdrawalId,
    );
    assert(approvedWithdrawal?.status === "approved", "Withdrawal status did not become approved.");

    report.walletBalances.finalUser = (
      await getApi(`/api/wallet?walletAddress=${userWallet}`)
    ).body;
    report.walletBalances.finalSponsor = (
      await getApi(`/api/wallet?walletAddress=${sponsorWallet}`)
    ).body;

    report.apiResponses.summary = {
      manualTradeId: manualTrade.id,
      manualProfit,
      sponsorBotIncome: sponsorIncomeDelta,
      sponsorRoyaltyTotal: royaltyTotal,
      teamUser: report.apiResponses.teamUser.body,
      teamSponsor: report.apiResponses.teamSponsor.body,
      incomeUser: report.apiResponses.incomeUser.body,
      incomeSponsor: report.apiResponses.incomeSponsor.body,
    };

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.failingStep = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
