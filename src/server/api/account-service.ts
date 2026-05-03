import { ApiError } from "@/server/api/errors";
import { prisma } from "@/server/api/prisma";
import type { DepositInput, RegisterInput, WalletQueryInput } from "@/server/api/validation";
import {
  calculateRegistrationBonusTokens,
  getCurrentGxnTokenPriceUsd,
  GXN_TOKEN_VALUE_USD,
  REGISTRATION_BONUS_USD,
} from "@/server/services/gxn-token";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toWalletResponse(wallet: {
  tradingWallet: number;
  withdrawalWallet: number;
  gxnTokenBalance: number;
  buyCount: number;
  sellCount: number;
  isCapitalUnlocked: boolean;
  updatedAt: Date;
  user: {
    id: string;
    walletAddress: string;
  };
}) {
  return {
    userId: wallet.user.id,
    walletAddress: wallet.user.walletAddress,
    tradingWallet: wallet.tradingWallet,
    withdrawalWallet: wallet.withdrawalWallet,
    gxnTokenBalance: wallet.gxnTokenBalance,
    gxnTokenValueUsd: GXN_TOKEN_VALUE_USD,
    gxnTokenUsdValue: roundAmount(wallet.gxnTokenBalance * GXN_TOKEN_VALUE_USD),
    buyCount: wallet.buyCount,
    sellCount: wallet.sellCount,
    isCapitalUnlocked: wallet.isCapitalUnlocked,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

async function requireUserWithWallet(tx: TransactionClient, input: WalletQueryInput) {
  const user = input.userId
    ? await tx.user.findUnique({
        where: { id: input.userId },
        include: { wallet: true },
      })
    : await tx.user.findUnique({
        where: { walletAddress: input.walletAddress! },
        include: { wallet: true },
      });

  if (!user || !user.wallet) {
    throw new ApiError(404, "User wallet not found.");
  }

  return user;
}

async function createMlmRelations(
  tx: TransactionClient,
  userId: string,
  sponsorUserId: string | null,
) {
  if (!sponsorUserId) {
    return;
  }

  const sponsorAncestors = await tx.mLMTree.findMany({
    where: { userId: sponsorUserId },
    orderBy: { level: "asc" },
    take: 4,
  });

  const rows = [
    {
      userId,
      ancestorUserId: sponsorUserId,
      level: 1,
    },
    ...sponsorAncestors.map((ancestor) => ({
      userId,
      ancestorUserId: ancestor.ancestorUserId,
      level: ancestor.level + 1,
    })),
  ];

  await tx.mLMTree.createMany({
    data: rows,
  });
}

export async function registerUser(input: RegisterInput) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { walletAddress: input.walletAddress },
      include: { wallet: true },
    });
    if (existingUser) {
      if (!existingUser.wallet) {
        throw new ApiError(404, "User wallet not found.");
      }

      return {
        message: "User already registered.",
        user: {
          id: existingUser.id,
          walletAddress: existingUser.walletAddress,
          createdAt: existingUser.createdAt.toISOString(),
        },
        wallet: toWalletResponse({
          ...existingUser.wallet,
          user: {
            id: existingUser.id,
            walletAddress: existingUser.walletAddress,
          },
        }),
        sponsorUserId: null,
      };
    }

    let sponsorUserId: string | null = null;
    if (input.sponsorWalletAddress) {
      const sponsor = await tx.user.findUnique({
        where: { walletAddress: input.sponsorWalletAddress },
      });
      if (!sponsor) {
        throw new ApiError(404, "Sponsor wallet not found.");
      }
      sponsorUserId = sponsor.id;
    }

    const tokenPriceUsd = getCurrentGxnTokenPriceUsd();
    const registrationBonusTokens = calculateRegistrationBonusTokens(tokenPriceUsd);
    if (!registrationBonusTokens) {
      console.error("[bonus] registration bonus skipped: invalid GXN token price", tokenPriceUsd);
    }

    const user = await tx.user.create({
      data: {
        walletAddress: input.walletAddress,
        registrationBonusGiven: Boolean(registrationBonusTokens),
        wallet: {
          create: {
            gxnTokenBalance: registrationBonusTokens ?? 0,
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    await createMlmRelations(tx, user.id, sponsorUserId);

    if (registrationBonusTokens) {
      await tx.walletLedger.create({
        data: {
          userId: user.id,
          type: "GXN_TOKEN_REWARD",
          amount: registrationBonusTokens,
          referenceId: "registration_bonus",
          metadata: {
            type: "bonus",
            subtype: "registration",
            usd_value: REGISTRATION_BONUS_USD,
            tokenPriceUsd,
            gxnTokenBalanceAfter: registrationBonusTokens,
            registration_bonus_given: true,
          },
        },
      });

      console.log("[bonus] registration bonus given", user.id, registrationBonusTokens);
    }

    return {
      message: "User registered successfully.",
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt.toISOString(),
      },
      wallet: toWalletResponse({
        ...user.wallet!,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
        },
      }),
      sponsorUserId,
    };
  });
}

export async function getWallet(input: WalletQueryInput) {
  const user = await prisma.user.findUnique({
    where: input.userId ? { id: input.userId } : { walletAddress: input.walletAddress! },
    include: { wallet: true },
  });

  if (!user || !user.wallet) {
    throw new ApiError(404, "User wallet not found.");
  }

  return toWalletResponse({
    ...user.wallet,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
    },
  });
}

export async function depositToTradingWallet(input: DepositInput) {
  return prisma.$transaction(async (tx) => {
    const user = await requireUserWithWallet(tx, input);
    const amount = roundAmount(input.amount);
    const nextTradingWallet = roundAmount(user.wallet!.tradingWallet + amount);
    const nextTotalDeposited = roundAmount(user.wallet!.totalDeposited + amount);

    const wallet = await tx.wallet.update({
      where: { userId: user.id },
      data: {
        tradingWallet: nextTradingWallet,
        totalDeposited: nextTotalDeposited,
      },
    });

    const ledgerEntry = await tx.walletLedger.create({
      data: {
        userId: user.id,
        type: "DEPOSIT_TO_TRADING",
        amount,
        metadata: {
          simulated: true,
          tradingWalletAfter: nextTradingWallet,
          totalDepositedAfter: nextTotalDeposited,
        },
      },
    });

    return {
      message: "Deposit credited to trading wallet.",
      wallet: toWalletResponse({
        ...wallet,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
        },
      }),
      ledgerEntry: {
        id: ledgerEntry.id,
        type: ledgerEntry.type,
        amount: ledgerEntry.amount,
        createdAt: ledgerEntry.createdAt.toISOString(),
      },
    };
  });
}
