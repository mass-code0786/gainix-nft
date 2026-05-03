import { z } from "zod";

const walletAddressSchema = z
  .string()
  .trim()
  .min(1, "walletAddress is required.")
  .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be a valid EVM wallet address.")
  .transform((value) => value.toLowerCase());

const amountSchema = z
  .number({
    invalid_type_error: "amount must be a number.",
  })
  .finite("amount must be finite.")
  .positive("amount must be greater than 0.");

const nonNegativeAmountSchema = z
  .number({
    invalid_type_error: "value must be a number.",
  })
  .finite("value must be finite.")
  .nonnegative("value must be 0 or greater.");

const payoutDaySchema = z
  .number({
    invalid_type_error: "payout day must be a number.",
  })
  .int("payout day must be an integer.")
  .min(1, "payout day must be between 1 and 28.")
  .max(28, "payout day must be between 1 and 28.");

const optionalStringSchema = z.string().trim().min(1).optional();
const nftIdSchema = z.string().trim().min(1, "nftId is required.");
const planIdSchema = z.enum(["bot_10", "bot_20", "bot_50", "bot_100", "bot_500"]);
const tokenIdSchema = z
  .string()
  .trim()
  .min(1, "tokenId is required.")
  .regex(/^[0-9]+$/, "tokenId must be numeric.");

export const authNonceInputSchema = z.object({
  walletAddress: walletAddressSchema,
});

export const authVerifyInputSchema = z.object({
  walletAddress: walletAddressSchema,
  signature: z.string().trim().regex(/^0x[a-fA-F0-9]+$/, "signature must be a valid hex signature."),
});

export const registerInputSchema = z.object({
  walletAddress: walletAddressSchema,
  sponsorWalletAddress: walletAddressSchema.optional(),
});

export const walletQuerySchema = z
  .object({
    userId: optionalStringSchema,
    walletAddress: walletAddressSchema.optional(),
  })
  .refine((value) => Boolean(value.userId || value.walletAddress), {
    message: "Provide either userId or walletAddress.",
    path: ["walletAddress"],
  });

export const depositInputSchema = z
  .object({
    userId: optionalStringSchema,
    walletAddress: walletAddressSchema.optional(),
    amount: amountSchema,
  })
  .refine((value) => Boolean(value.userId || value.walletAddress), {
    message: "Provide either userId or walletAddress.",
    path: ["walletAddress"],
  });

export const depositVerifyInputSchema = z.object({
  walletAddress: walletAddressSchema,
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "txHash must be a valid transaction hash."),
  expectedAmount: amountSchema,
});

export const walletAmountMutationInputSchema = z.object({
  walletAddress: walletAddressSchema,
  amount: amountSchema,
});

export const walletAddressOnlyInputSchema = z.object({
  walletAddress: walletAddressSchema,
});

export const nftMutationInputSchema = z.object({
  walletAddress: walletAddressSchema,
  nftId: nftIdSchema,
  debugAutoSellInMinutes: nonNegativeAmountSchema.optional(),
});

export const botBuyInputSchema = z.object({
  walletAddress: walletAddressSchema,
  packageId: z.string().trim().min(1).optional(),
  planId: z.string().trim().min(1).optional(),
  amount: amountSchema.optional(),
  price: amountSchema.optional(),
});

export const adminSettingsInputSchema = z
  .object({
    nftPriceIncreaseMinPercent: nonNegativeAmountSchema.optional(),
    nftPriceIncreaseMaxPercent: nonNegativeAmountSchema.optional(),
    autoSellDelayMinMinutes: nonNegativeAmountSchema.optional(),
    autoSellDelayMaxMinutes: nonNegativeAmountSchema.optional(),
    botProfitMinPercent: nonNegativeAmountSchema.optional(),
    botProfitMaxPercent: nonNegativeAmountSchema.optional(),
    withdrawalMinimumAmount: amountSchema.optional(),
    withdrawalFeePercent: nonNegativeAmountSchema.max(100, "withdrawal fee cannot exceed 100.").optional(),
    vipFirstPayoutDay: payoutDaySchema.optional(),
    vipSecondPayoutDay: payoutDaySchema.optional(),
    vipRecurringEnabled: z.boolean().optional(),
    payoutsPaused: z.boolean().optional(),
    systemStopped: z.boolean().optional(),
    globalDailyPayoutCap: amountSchema.optional(),
    perUserDailyPayoutCap: amountSchema.optional(),
    maxDailyWithdrawalAmountPerUser: amountSchema.optional(),
    minimumTradeAmount: amountSchema.optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).length > 0,
    {
      message: "Provide at least one admin setting to update.",
    },
  );

export const adminReserveInputSchema = z.object({
  balance: nonNegativeAmountSchema,
});

export const adminTransferFundInputSchema = z.object({
  userId: z.string().trim().min(1, "userId is required."),
  amount: amountSchema,
});

export const adminActivateBotInputSchema = z.object({
  userId: z.string().trim().min(1, "userId is required."),
});

export const adminCreateNftInputSchema = z.object({
  tokenId: tokenIdSchema,
  name: z.string().trim().min(2, "name must be at least 2 characters."),
  imageUrl: z.string().trim().url("imageUrl must be a valid URL."),
  basePrice: amountSchema,
  category: z.string().trim().min(1, "category is required."),
  description: z.string().trim().min(1, "description is required."),
  status: z.enum(["draft", "live"]).default("live"),
});

export const adminUpdateNftInputSchema = z
  .object({
    nftId: nftIdSchema,
    currentPrice: amountSchema.optional(),
    status: z.enum(["draft", "live"]).optional(),
  })
  .refine((value) => typeof value.currentPrice === "number" || Boolean(value.status), {
    message: "Provide currentPrice or status.",
  });

export const adminDeleteNftInputSchema = z.object({
  nftId: nftIdSchema,
});

export const approveWithdrawalInputSchema = z.object({
  withdrawalId: z.string().trim().min(1, "withdrawalId is required."),
});

export const confirmWithdrawalInputSchema = z.object({
  withdrawalId: z.string().trim().min(1, "withdrawalId is required."),
  walletAddress: walletAddressSchema,
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, "txHash must be a valid transaction hash."),
});

export const payoutControlInputSchema = z.object({
  paused: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type WalletQueryInput = z.infer<typeof walletQuerySchema>;
export type DepositInput = z.infer<typeof depositInputSchema>;
export type DepositVerifyInput = z.infer<typeof depositVerifyInputSchema>;
export type WalletAmountMutationInput = z.infer<typeof walletAmountMutationInputSchema>;
export type WalletAddressOnlyInput = z.infer<typeof walletAddressOnlyInputSchema>;
export type NftMutationInput = z.infer<typeof nftMutationInputSchema>;
export type BotBuyInput = z.infer<typeof botBuyInputSchema>;
export type AdminSettingsInput = z.infer<typeof adminSettingsInputSchema>;
export type AdminReserveInput = z.infer<typeof adminReserveInputSchema>;
export type AdminTransferFundInput = z.infer<typeof adminTransferFundInputSchema>;
export type AdminActivateBotInput = z.infer<typeof adminActivateBotInputSchema>;
export type AdminCreateNftInput = z.infer<typeof adminCreateNftInputSchema>;
export type AdminUpdateNftInput = z.infer<typeof adminUpdateNftInputSchema>;
export type AdminDeleteNftInput = z.infer<typeof adminDeleteNftInputSchema>;
export type ApproveWithdrawalInput = z.infer<typeof approveWithdrawalInputSchema>;
export type ConfirmWithdrawalInput = z.infer<typeof confirmWithdrawalInputSchema>;
export type PayoutControlInput = z.infer<typeof payoutControlInputSchema>;
