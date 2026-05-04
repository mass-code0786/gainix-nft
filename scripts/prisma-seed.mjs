import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MIN_WITHDRAWAL_AMOUNT = Number(process.env.MIN_WITHDRAWAL_AMOUNT ?? 1);

async function main() {
  const existingAdminSetting = await prisma.adminSetting.findFirst();
  if (existingAdminSetting) {
    await prisma.adminSetting.update({
      where: { id: existingAdminSetting.id },
      data: {
        nftPriceIncreaseMinPercent: 0.25,
        nftPriceIncreaseMaxPercent: 0.35,
        autoSellDelayMinMinutes: 10,
        autoSellDelayMaxMinutes: 30,
        botProfitMinPercent: 0.25,
        botProfitMaxPercent: 0.35,
        withdrawalMinimumAmount: MIN_WITHDRAWAL_AMOUNT,
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
  } else {
    await prisma.adminSetting.create({
      data: {
        id: "gainix-admin-settings",
        nftPriceIncreaseMinPercent: 0.25,
        nftPriceIncreaseMaxPercent: 0.35,
        autoSellDelayMinMinutes: 10,
        autoSellDelayMaxMinutes: 30,
        botProfitMinPercent: 0.25,
        botProfitMaxPercent: 0.35,
        withdrawalMinimumAmount: MIN_WITHDRAWAL_AMOUNT,
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
  }

  const existingReserve = await prisma.systemReserve.findFirst();
  if (existingReserve) {
    await prisma.systemReserve.update({
      where: { id: existingReserve.id },
      data: {
        balance: 5000,
        totalRoyaltyPaid: existingReserve.totalRoyaltyPaid ?? 0,
        totalNftTradingPaid: existingReserve.totalNftTradingPaid ?? 0,
      },
    });
  } else {
    await prisma.systemReserve.create({
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
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
