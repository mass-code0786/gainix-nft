import type { IncomeCategoryKey, IncomeOverview } from "@/types";

export const incomeCategoryOrder = [
  "nftTradingIncome",
  "botTradingIncome",
  "referralIncome",
  "levelIncome",
  "royaltyIncome",
] as const satisfies readonly IncomeCategoryKey[];

export const incomeCategoryMeta: Record<
  IncomeCategoryKey,
  {
    label: string;
  }
> = {
  nftTradingIncome: {
    label: "NFT Trading Income",
  },
  botTradingIncome: {
    label: "Bot Trading Income",
  },
  referralIncome: {
    label: "Referral Income",
  },
  levelIncome: {
    label: "Level Income",
  },
  royaltyIncome: {
    label: "Royalty Income",
  },
};

export const incomeOverview: IncomeOverview = {
  nftTradingIncome: {
    total: 125,
    today: 8.2,
    weekly: 24.6,
    monthly: 73.4,
    pending: 12,
    lastCreditedDate: "22 Apr 2026, 11:42 AM",
    history: [
      {
        id: "income-trade-1",
        title: "Marketplace sale settlement",
        description: "Onyx Hound Zero trade credit settled from marketplace escrow to the Gainix trading ledger.",
        amount: 8.2,
        status: "Credited",
        date: "22 Apr 2026, 11:42 AM",
        reference: "Trade ID GX-402",
      },
      {
        id: "income-trade-2",
        title: "Premium spread release",
        description: "Spread income released after a successful secondary sale closure on BNB Smart Chain.",
        amount: 5.6,
        status: "Credited",
        date: "21 Apr 2026, 06:18 PM",
        reference: "Settlement GX-397",
      },
      {
        id: "income-trade-3",
        title: "Escrow batch pending",
        description: "Marketplace escrow is holding settlement until the buyer confirmation window closes.",
        amount: 12,
        status: "Pending",
        date: "22 Apr 2026, 01:20 PM",
        reference: "Escrow GX-411",
      },
    ],
  },
  botTradingIncome: {
    total: 0,
    today: 0,
    weekly: 0,
    monthly: 0,
    pending: 0,
    lastCreditedDate: "No credits yet",
    history: [],
  },
  referralIncome: {
    total: 86.4,
    today: 5.2,
    weekly: 19.8,
    monthly: 44.1,
    pending: 6.3,
    lastCreditedDate: "22 Apr 2026, 09:18 AM",
    history: [
      {
        id: "income-referral-1",
        title: "Direct referral activation",
        description: "First-level referral commission credited after a new wallet completed a paid marketplace entry.",
        amount: 5.2,
        status: "Credited",
        date: "22 Apr 2026, 09:18 AM",
        reference: "Referral RF-118",
      },
      {
        id: "income-referral-2",
        title: "Invite conversion credit",
        description: "Referral bonus credited for a returning collector who settled a purchase through your code.",
        amount: 4.7,
        status: "Credited",
        date: "21 Apr 2026, 04:36 PM",
        reference: "Referral RF-112",
      },
      {
        id: "income-referral-3",
        title: "Pending referral settlement",
        description: "Qualified invite volume is recorded and queued for the next referral payout batch.",
        amount: 6.3,
        status: "Pending",
        date: "22 Apr 2026, 12:55 PM",
        reference: "Referral RF-121",
      },
    ],
  },
  levelIncome: {
    total: 53.75,
    today: 3.2,
    weekly: 14.25,
    monthly: 29.85,
    pending: 4.1,
    lastCreditedDate: "21 Apr 2026, 08:04 PM",
    history: [
      {
        id: "income-level-1",
        title: "Level team reward",
        description: "Depth reward credited from second-line activity generated during the current reward cycle.",
        amount: 3.2,
        status: "Credited",
        date: "21 Apr 2026, 08:04 PM",
        reference: "Level LV-074",
      },
      {
        id: "income-level-2",
        title: "Cycle reward distribution",
        description: "Weekly level-income distribution processed for qualifying activity across your network tree.",
        amount: 6.45,
        status: "Credited",
        date: "20 Apr 2026, 10:12 AM",
        reference: "Level LV-069",
      },
      {
        id: "income-level-3",
        title: "Pending downline batch",
        description: "Unsettled level rewards are waiting on the current depth-based settlement batch.",
        amount: 4.1,
        status: "Pending",
        date: "22 Apr 2026, 12:08 PM",
        reference: "Level LV-078",
      },
    ],
  },
  royaltyIncome: {
    total: 41.9,
    today: 1.85,
    weekly: 8.75,
    monthly: 18.6,
    pending: 2.7,
    lastCreditedDate: "22 Apr 2026, 07:36 AM",
    history: [
      {
        id: "income-royalty-1",
        title: "Secondary royalty credit",
        description: "Royalty revenue credited after an external secondary sale settled against the collection contract.",
        amount: 1.85,
        status: "Credited",
        date: "22 Apr 2026, 07:36 AM",
        reference: "Royalty RT-054",
      },
      {
        id: "income-royalty-2",
        title: "Collection royalty batch",
        description: "Royalty share received from recent high-volume marketplace activity across Gainix NFTs.",
        amount: 3.4,
        status: "Credited",
        date: "21 Apr 2026, 02:10 PM",
        reference: "Royalty RT-050",
      },
      {
        id: "income-royalty-3",
        title: "Pending royalty release",
        description: "Royalty proceeds are calculated and queued for the next automated credit sweep.",
        amount: 2.7,
        status: "Pending",
        date: "22 Apr 2026, 10:40 AM",
        reference: "Royalty RT-056",
      },
    ],
  },
};

export function isIncomeCategoryKey(value: string | null): value is IncomeCategoryKey {
  return Boolean(value && incomeCategoryOrder.includes(value as IncomeCategoryKey));
}
