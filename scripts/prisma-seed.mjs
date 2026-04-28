import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const nftSeeds = [
  {
    tokenId: "1001",
    name: "Gainix Alpha Tiger",
    imageUrl:
      "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80",
    basePrice: 120,
    currentPrice: 120,
    status: "marketplace",
  },
  {
    tokenId: "1002",
    name: "Gainix Neon Falcon",
    imageUrl:
      "https://images.unsplash.com/photo-1520808663317-647b476a81b9?auto=format&fit=crop&w=1200&q=80",
    basePrice: 175,
    currentPrice: 175,
    status: "marketplace",
  },
  {
    tokenId: "1003",
    name: "Gainix Solar Panther",
    imageUrl:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80",
    basePrice: 235,
    currentPrice: 235,
    status: "marketplace",
  },
  {
    tokenId: "1004",
    name: "Gainix Prism Wolf",
    imageUrl:
      "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1200&q=80",
    basePrice: 310,
    currentPrice: 310,
    status: "marketplace",
  },
];

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
        withdrawalMinimumAmount: 10,
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
        withdrawalMinimumAmount: 10,
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

  for (const nft of nftSeeds) {
    await prisma.nFT.upsert({
      where: { tokenId: nft.tokenId },
      update: {
        name: nft.name,
        imageUrl: nft.imageUrl,
        basePrice: nft.basePrice,
      },
      create: nft,
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
