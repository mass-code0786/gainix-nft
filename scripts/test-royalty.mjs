import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const port = Number(process.env.GAINIX_TEST_PORT ?? "3005");
const baseUrl = `http://127.0.0.1:${port}`;
const targetWalletAddress = "0x1000000000000000000000000000000000000001";

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
      // Wait for the dev server to boot.
    }

    await sleep(1500);
  }

  throw new Error(`Timed out waiting for server at ${url}.`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

function walletForIndex(index) {
  return `0x${(index + 2).toString(16).padStart(40, "0")}`;
}

function nonPayoutDaysForToday(day) {
  if (day !== 1 && day !== 2) {
    return { first: 1, second: 2 };
  }

  return { first: 3, second: 4 };
}

async function resetAndSeedRoyaltyFixture() {
  const now = new Date();
  const today = now.getDate();
  const disabledPayoutDays = nonPayoutDaysForToday(today);

  await prisma.$transaction(async (tx) => {
    await tx.botActivity.deleteMany();
    await tx.walletLedger.deleteMany();
    await tx.incomeLedger.deleteMany();
    await tx.nFTTrade.deleteMany();
    await tx.botSubscription.deleteMany();
    await tx.withdrawal.deleteMany();
    await tx.mLMTree.deleteMany();
    await tx.wallet.deleteMany();
    await tx.user.deleteMany();
    await tx.adminSetting.deleteMany();
    await tx.systemReserve.deleteMany();

    await tx.systemReserve.create({
      data: {
        id: "gainix-system-reserve",
        balance: 5000,
        totalMlmPaid: 0,
        totalBotTradingPaid: 0,
        totalBotPurchaseUplinePaid: 0,
      },
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
        vipFirstPayoutDay: disabledPayoutDays.first,
        vipSecondPayoutDay: disabledPayoutDays.second,
        vipRecurringEnabled: true,
      },
    });

    const users = [];
    const wallets = [];
    const mlmRows = [];

    const targetUserId = "royalty-root-user";
    users.push({
      id: targetUserId,
      walletAddress: targetWalletAddress,
      selfPackageAmount: 100,
      currentVipLevel: 0,
      vipAchievedAt: null,
    });
    wallets.push({
      id: "wallet-root",
      userId: targetUserId,
      tradingWallet: 0,
      withdrawalWallet: 0,
      totalDeposited: 0,
      buyCount: 0,
      sellCount: 0,
      isCapitalUnlocked: false,
    });

    let walletIndex = 0;
    for (let directIndex = 0; directIndex < 5; directIndex += 1) {
      const directUserId = `royalty-direct-${directIndex + 1}`;
      users.push({
        id: directUserId,
        walletAddress: walletForIndex(walletIndex),
        selfPackageAmount: 100,
        currentVipLevel: 0,
        vipAchievedAt: null,
      });
      wallets.push({
        id: `wallet-direct-${directIndex + 1}`,
        userId: directUserId,
        tradingWallet: 0,
        withdrawalWallet: 0,
        totalDeposited: 0,
        buyCount: 0,
        sellCount: 0,
        isCapitalUnlocked: false,
      });
      walletIndex += 1;

      mlmRows.push({
        id: `mlm-root-direct-${directIndex + 1}`,
        userId: directUserId,
        ancestorUserId: targetUserId,
        level: 1,
      });

      for (let childIndex = 0; childIndex < 2; childIndex += 1) {
        const level2Ordinal = directIndex * 2 + childIndex + 1;
        const level2UserId = `royalty-level2-${level2Ordinal}`;
        users.push({
          id: level2UserId,
          walletAddress: walletForIndex(walletIndex),
          selfPackageAmount: 100,
          currentVipLevel: 0,
          vipAchievedAt: null,
        });
        wallets.push({
          id: `wallet-level2-${level2Ordinal}`,
          userId: level2UserId,
          tradingWallet: 0,
          withdrawalWallet: 0,
          totalDeposited: 0,
          buyCount: 0,
          sellCount: 0,
          isCapitalUnlocked: false,
        });
        walletIndex += 1;

        mlmRows.push({
          id: `mlm-direct-level2-${level2Ordinal}`,
          userId: level2UserId,
          ancestorUserId: directUserId,
          level: 1,
        });
        mlmRows.push({
          id: `mlm-root-level2-${level2Ordinal}`,
          userId: level2UserId,
          ancestorUserId: targetUserId,
          level: 2,
        });
      }
    }

    await tx.user.createMany({ data: users });
    await tx.wallet.createMany({ data: wallets });
    await tx.mLMTree.createMany({ data: mlmRows });
  });

  return {
    today,
  };
}

async function setPayoutDayToToday(today) {
  await prisma.adminSetting.updateMany({
    data: {
      vipFirstPayoutDay: today,
      vipSecondPayoutDay: 20,
      vipRecurringEnabled: true,
    },
  });
}

async function run() {
  const fixture = await resetAndSeedRoyaltyFixture();
  let failed = false;

  try {
    await waitForServer(`${baseUrl}/api/nft/marketplace`);

    const initialRoyaltyStatus = await fetchJson(
      `${baseUrl}/api/royalty/status?walletAddress=${targetWalletAddress}`,
    );

    if (initialRoyaltyStatus.currentVipLevel !== 1) {
      throw new Error(`Expected VIP1 qualification, got VIP${initialRoyaltyStatus.currentVipLevel}.`);
    }

    await setPayoutDayToToday(fixture.today);

    const firstTick = await fetchJson(`${baseUrl}/api/bot/run-cycle`, {
      method: "POST",
    });
    const secondTick = await fetchJson(`${baseUrl}/api/bot/run-cycle`, {
      method: "POST",
    });

    const targetWallet = await prisma.wallet.findFirstOrThrow({
      where: {
        user: {
          walletAddress: targetWalletAddress,
        },
      },
    });

    const targetUser = await prisma.user.findFirstOrThrow({
      where: {
        walletAddress: targetWalletAddress,
      },
    });

    const royaltyLedgerEntries = await prisma.incomeLedger.findMany({
      where: {
        userId: targetUser.id,
        type: "ROYALTY_INCOME",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const royaltyWalletLedgerEntries = await prisma.walletLedger.findMany({
      where: {
        userId: targetUser.id,
        type: "ROYALTY_INCOME",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const finalRoyaltyStatus = await fetchJson(
      `${baseUrl}/api/royalty/status?walletAddress=${targetWalletAddress}`,
    );
    const incomeOverview = await fetchJson(
      `${baseUrl}/api/income?walletAddress=${targetWalletAddress}`,
    );

    const report = {
      qualificationCheck: {
        expectedVipLevel: 1,
        actualVipLevel: initialRoyaltyStatus.currentVipLevel,
        nextVipLevel: initialRoyaltyStatus.nextVipLevel,
        requirementProgress: initialRoyaltyStatus.currentRequirementProgress,
      },
      payoutRun: {
        simulatedPayoutDay: fixture.today,
        firstTickRoyaltyPayouts: firstTick.royaltyPayouts,
        secondTickRoyaltyPayouts: secondTick.royaltyPayouts,
      },
      databaseAssertions: {
        withdrawalWallet: targetWallet.withdrawalWallet,
        royaltyIncomeLedgerCount: royaltyLedgerEntries.length,
        royaltyWalletLedgerCount: royaltyWalletLedgerEntries.length,
        royaltyLedgerSample: royaltyLedgerEntries.map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          vipLevel: entry.vipLevel,
          payoutDate: entry.payoutDate?.toISOString() ?? null,
        })),
      },
      apiAssertions: {
        royaltyStatus: {
          currentVipLevel: finalRoyaltyStatus.currentVipLevel,
          nextVipLevel: finalRoyaltyStatus.nextVipLevel,
          payoutAmount: finalRoyaltyStatus.payoutAmount,
          payoutHistoryCount: finalRoyaltyStatus.payoutHistory.length,
        },
        incomeOverview: {
          royaltyIncome: incomeOverview.royaltyIncome,
          botTradingIncome: incomeOverview.botTradingIncome,
        },
      },
    };

    if (targetWallet.withdrawalWallet !== 30) {
      throw new Error(`Expected withdrawal wallet to be 30, got ${targetWallet.withdrawalWallet}.`);
    }

    if (royaltyLedgerEntries.length !== 1) {
      throw new Error(`Expected one ROYALTY_INCOME entry, got ${royaltyLedgerEntries.length}.`);
    }

    if (royaltyWalletLedgerEntries.length !== 1) {
      throw new Error(`Expected one wallet ROYALTY_INCOME entry, got ${royaltyWalletLedgerEntries.length}.`);
    }

    if ((firstTick.royaltyPayouts?.length ?? 0) !== 1) {
      throw new Error(`Expected first payout tick to create one royalty payout, got ${firstTick.royaltyPayouts?.length ?? 0}.`);
    }

    if ((secondTick.royaltyPayouts?.length ?? 0) !== 0) {
      throw new Error(`Expected second payout tick to be idempotent, got ${secondTick.royaltyPayouts?.length ?? 0}.`);
    }

    if (incomeOverview.royaltyIncome?.total !== 30) {
      throw new Error(`Expected /api/income royaltyIncome.total to be 30, got ${incomeOverview.royaltyIncome?.total}.`);
    }

    console.log(JSON.stringify(report, null, 2));
    return report;
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
