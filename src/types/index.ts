import type { Address } from "viem";

export interface ChartPoint {
  label: string;
  value: number;
  volume?: number;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export type NFTActivityType = "mint" | "list" | "buy" | "sell" | "cancel";

export interface NFTActivity {
  id: string;
  type: NFTActivityType;
  from: Address;
  to?: Address;
  price?: number;
  time: string;
  txHash: `0x${string}`;
  blockNumber: number;
}

export interface NFTItem {
  id: string;
  tokenId: number;
  slug: string;
  name: string;
  animalType: string;
  collection: string;
  currentPrice: number;
  listedPrice: number | null;
  changePercent: number;
  rarity: "Legendary" | "Epic" | "Rare" | "Uncommon";
  accent: string;
  secondaryAccent: string;
  description: string;
  owner: Address;
  creator: Address;
  seller?: Address;
  floorPrice: number;
  highestBid?: number;
  marketCap?: number;
  totalVolume?: number;
  volumeBnb7d?: number;
  previewSymbol: string;
  supply: number;
  rank: number;
  tags: string[];
  chart?: ChartPoint[];
  activity: NFTActivity[];
  relatedSlugs: string[];
  contractAddress: Address | null;
  listingId?: string;
  tokenUri: string;
  ipfsMetadataUri: string;
  imageUri: string;
  network: "BNB Smart Chain";
}

export interface PortfolioHolding {
  id: string;
  nftSlug: string;
  tokenId: number;
  units: number;
  totalInvested: number;
  currentValue: number;
  purchasedAt: number;
  profit: number;
  status: "Held" | "Listed" | "Recently Sold";
  lastTrade: string;
  contractAddress: Address | null;
}

export type TransactionType =
  | "Buy"
  | "Sell"
  | "List"
  | "Cancel"
  | "Mint"
  | "Bot Subscription"
  | "Bot Buy"
  | "Bot Sell"
  | "Reward"
  | "Withdrawal";

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  nftName?: string;
  amount: number;
  price?: number;
  status: "Completed" | "Pending" | "Processing";
  profit?: number;
  date: string;
  hash: `0x${string}`;
  from: Address;
  to: Address;
  gasFee: number;
  chain: "BNB Smart Chain";
}

export interface BotPlan {
  id: string;
  price: number;
  buyTrades: number;
  sellTrades: number;
  cycles: number;
  badge?: string;
  description: string;
  feature: string;
  highlight?: boolean;
  perks: string[];
}

export interface BotTimelineEvent {
  id: string;
  title: string;
  action: "Subscribe" | "Renew" | "Cycle Complete" | "Queue Ready";
  nftName?: string;
  result?: number;
  time: string;
  status: "Executed" | "Queued" | "Active";
}

export interface BotSubscriptionState {
  activePlanId: string;
  remainingCycles: number;
  totalCycles: number;
  remainingBuyTrades: number;
  totalBuyTrades: number;
  remainingSellTrades: number;
  totalSellTrades: number;
  cycleUtilizationPercent: number;
  queueHealthPercent: number;
  cycleWindowLabel: string;
}

export interface BotAutomationPlan {
  planId: string;
  planName: string;
  price: number;
  buyTrades: number;
  sellTrades: number;
  totalCycles: number;
}

export interface BotAutomationSubscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  price: number;
  totalBuyTrades: number;
  totalSellTrades: number;
  completedBuyTrades: number;
  completedSellTrades: number;
  completedCycles: number;
  remainingBuyTrades: number;
  remainingSellTrades: number;
  totalCycles: number;
  status: "active" | "completed";
  lastExecutedAt: string | null;
  uplineIncomePaidAt: string | null;
  activatedByAdmin: boolean;
  purchasedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotAutomationActivity {
  id: string;
  userId: string;
  botSubscriptionId: string;
  nftId: string | null;
  action: "AUTO_BUY" | "AUTO_LIST" | "AUTO_SELL";
  amount: number;
  profit: number | null;
  status: "SUCCESS" | "WAITING" | "COMPLETED" | "SKIPPED";
  createdAt: string;
  nft?: {
    id: string;
    tokenId: string;
    name: string;
  } | null;
}

export interface WalletSummary {
  totalBalance: number;
  nftValue: number;
  liquidBnb: number;
  gxnTokenUsdValue: number;
  pendingProceeds: number;
  floorExposure: number;
  availableToSpend: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "trade" | "wallet" | "bot" | "team" | "system";
  read: boolean;
}

export interface TeamMember {
  id: string;
  wallet: Address;
  alias: string;
  joined: string;
  status: "Connected" | "Pending" | "Watching";
  walletCount: number;
}

export interface TeamSummary {
  referralCode: string;
  totalWallets: number;
  connectedMembers: number;
  pendingInvites: number;
  disclaimer: string;
}

export interface UserProfile {
  name: string;
  username: string;
  tier: string;
  avatar: string;
  referralCode: string;
  walletAddress: Address;
  joinedOn: string;
  primaryChain: "BNB Smart Chain";
  bio: string;
}

export interface DashboardSummary {
  totalPortfolioBalance: number;
  dailyPnl: number;
  liveListings: number;
  ownedNfts: number;
  activePlan: string;
}

export type IncomeCategoryKey =
  | "nftTradingIncome"
  | "botTradingIncome"
  | "referralIncome"
  | "levelIncome"
  | "royaltyIncome";

export interface IncomeHistoryRecord {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: "Credited" | "Pending";
  date: string;
  reference: string;
}

export interface IncomeCategoryData {
  total: number;
  today: number;
  weekly: number;
  monthly: number;
  pending: number;
  lastCreditedDate: string;
  history: IncomeHistoryRecord[];
}

export interface IncomeOverview {
  nftTradingIncome: IncomeCategoryData;
  botTradingIncome: IncomeCategoryData;
  referralIncome: IncomeCategoryData;
  levelIncome: IncomeCategoryData;
  royaltyIncome: IncomeCategoryData;
}

export interface AdminSettingsSnapshot {
  nftPriceIncreaseMinPercent: number;
  nftPriceIncreaseMaxPercent: number;
  autoSellDelayMinMinutes: number;
  autoSellDelayMaxMinutes: number;
  botProfitMinPercent: number;
  botProfitMaxPercent: number;
  withdrawalMinimumAmount: number;
  withdrawalFeePercent: number;
  vipFirstPayoutDay: number;
  vipSecondPayoutDay: number;
  vipRecurringEnabled: boolean;
  payoutsPaused: boolean;
  systemStopped: boolean;
  globalDailyPayoutCap: number;
  perUserDailyPayoutCap: number;
  maxDailyWithdrawalAmountPerUser: number;
  minimumTradeAmount: number;
  updatedAt: string;
}

export interface SystemReserveSnapshot {
  balance: number;
  totalMlmPaid: number;
  totalRoyaltyPaid: number;
  totalNftTradingPaid: number;
  totalBotTradingPaid: number;
  totalBotPurchaseUplinePaid: number;
  updatedAt: string;
}

export interface AdminWithdrawalRecord {
  id: string;
  userId: string;
  grossAmount: number;
  feeAmount: number;
  gxnDeductionAmount: number;
  gxnTokens: number;
  netAmount: number;
  status: "requested" | "approved" | "approved_pending_tx" | "completed";
  approvedAt: string | null;
  payoutTxHash: string | null;
  payoutStatus: string;
  withdrawalTxHash: string | null;
  onChainStatus: "PENDING" | "CONFIRMED" | "FAILED";
  createdAt: string;
  user: {
    id: string;
    walletAddress: Address;
  } | null;
}

export interface AdminNftRecord {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  currentPrice: number;
  lastBuyPrice: number | null;
  totalTrades: number;
  status: "marketplace" | "owned" | "listed" | "sold" | "draft";
  ownerUserId: string | null;
  lastPriceIncreasePercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  settings: AdminSettingsSnapshot;
  systemReserve: SystemReserveSnapshot;
  summary: {
    totalUsers: number;
    totalWithdrawalsPending: number;
    totalPayouts: number;
    approvedWithdrawalTotal: number;
    royaltyPaid: number;
    reserveWarning: boolean;
  };
  withdrawals: AdminWithdrawalRecord[];
  pendingWithdrawals: AdminWithdrawalRecord[];
  blockedPayoutLogs: SafetyLogSnapshot[];
  safetyLogs: SafetyLogSnapshot[];
}

export interface SafetyLogSnapshot {
  id: string;
  eventType: string;
  userId: string | null;
  amount: number | null;
  reason: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface AdminAnalyticsSeriesPoint {
  date: string;
  label: string;
  deposits: number;
  withdrawals: number;
  payouts: number;
  profitLoss: number;
  activeUsers: number;
}

export interface AdminAnalytics {
  totals: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalNftTrades: number;
    totalBotTrades: number;
    totalMlmPayout: number;
    totalRoyaltyPayout: number;
    systemReserveBalance: number;
    activeUsers: number;
    totalPayouts: number;
  };
  today: {
    deposits: number;
    withdrawals: number;
    payouts: number;
    profitLoss: number;
    activeUsers: number;
    nftTrades: number;
    botTrades: number;
  };
  series: AdminAnalyticsSeriesPoint[];
}
