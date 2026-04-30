export type NftStatus = "marketplace" | "owned" | "listed" | "sold";
export type AdminNftStatus = NftStatus | "draft";
export type TradeStatus = "bought" | "listed" | "auto_sold";
export type TradeSource = "manual" | "bot";
export type IncomeLedgerType =
  | "NFT_TRADING_INCOME"
  | "LEVEL_INCOME"
  | "BOT_PURCHASE_UPLINE_INCOME"
  | "BOT_TRADING_INCOME"
  | "ROYALTY_INCOME"
  | "ADMIN_CREDIT";
export type WalletLedgerType =
  | "DEPOSIT_TO_TRADING"
  | "NFT_BUY_DEBIT"
  | "NFT_SELL_PRINCIPAL_RETURN"
  | "NFT_TRADING_PROFIT"
  | "LEVEL_INCOME"
  | "BOT_PURCHASE_UPLINE_INCOME"
  | "BOT_TRADING_PROFIT"
  | "ROYALTY_INCOME"
  | "CAPITAL_TRANSFER_TO_WITHDRAWAL"
  | "CAPITAL_TRANSFER"
  | "WITHDRAWAL_REQUEST"
  | "WITHDRAWAL_FEE"
  | "GXN_TOKEN_REWARD"
  | "GXN_TOKEN_DEDUCTION"
  | "BOT_PURCHASE_DEBIT"
  | "ADMIN_CREDIT";

export interface UserRecord {
  id: string;
  walletAddress: string;
  selfPackageAmount: number;
  currentVipLevel: number;
  vipAchievedAt: string | null;
  totalBuyCount: number;
  totalSellCount: number;
  dailyBuyCount: number;
  dailySellCount: number;
  lastTradeResetAt: string;
  capitalUnlocked: boolean;
  capitalUnlockedAt: string | null;
  capitalTransferredAt: string | null;
  createdAt: string;
}

export interface NftRecord {
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
  status: AdminNftStatus;
  ownerUserId: string | null;
  lastPriceIncreasePercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NftTradeRecord {
  id: string;
  nftId: string;
  userId: string;
  buyPrice: number;
  sellPrice: number | null;
  profit: number | null;
  status: TradeStatus;
  listedAt: string | null;
  autoSellAt: string | null;
  soldAt: string | null;
  saleJobId: string | null;
  source: TradeSource;
  botSubscriptionId: string | null;
  createdAt: string;
}

export interface WalletRecord {
  id: string;
  userId: string;
  tradingWallet: number;
  withdrawalWallet: number;
  gxnTokenBalance: number;
  totalDeposited: number;
  buyCount: number;
  sellCount: number;
  isCapitalUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerRecord {
  id: string;
  userId: string;
  type: WalletLedgerType;
  amount: number;
  referenceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface IncomeLedgerRecord {
  id: string;
  userId: string;
  type: IncomeLedgerType;
  amount: number;
  sourceTradeId: string;
  level: number | null;
  sourceUserId: string | null;
  vipLevel: number | null;
  payoutDate: string | null;
  createdAt: string;
}

export interface MlmTreeRecord {
  id: string;
  userId: string;
  ancestorUserId: string;
  level: number;
  createdAt: string;
}

export interface BotSubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  price: number;
  totalBuyTrades: number;
  totalSellTrades: number;
  completedBuyTrades: number;
  completedSellTrades: number;
  remainingBuyTrades: number;
  remainingSellTrades: number;
  status: "active" | "completed";
  lastExecutedAt: string | null;
  uplineIncomePaidAt: string | null;
  activatedByAdmin: boolean;
  purchasedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotActivityRecord {
  id: string;
  userId: string;
  botSubscriptionId: string;
  nftId: string | null;
  action: "AUTO_BUY" | "AUTO_LIST" | "AUTO_SELL";
  amount: number;
  profit: number | null;
  status: "SUCCESS" | "WAITING" | "COMPLETED" | "SKIPPED";
  createdAt: string;
}

export interface SystemReserveRecord {
  id: string;
  balance: number;
  totalMlmPaid: number;
  totalRoyaltyPaid: number;
  totalNftTradingPaid: number;
  totalBotTradingPaid: number;
  totalBotPurchaseUplinePaid: number;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  grossAmount: number;
  feeAmount: number;
  gxnDeductionAmount: number;
  gxnTokens: number;
  netAmount: number;
  status: "requested" | "approved" | "approved_pending_tx";
  approvedAt: string | null;
  payoutTxHash: string | null;
  payoutStatus: string;
  withdrawalTxHash: string | null;
  onChainStatus: "PENDING" | "CONFIRMED" | "FAILED";
  createdAt: string;
}

export interface DepositRecord {
  id: string;
  userId: string;
  txHash: string;
  chainId: number;
  tokenAddress: string;
  expectedAmount: number;
  creditedAmount: number | null;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
}

export interface AdminSettingsRecord {
  nftPriceIncreaseMinPercent: number;
  nftPriceIncreaseMaxPercent: number;
  autoSellDelayMinMinutes: number;
  autoSellDelayMaxMinutes: number;
  botProfitMinPercent: number;
  botProfitMaxPercent: number;
  withdrawalMinimumAmount: number;
  withdrawalFeePercent: number;
  vipMinimumTeamPackageAmount: number;
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

export interface SafetyLogRecord {
  id: string;
  eventType: string;
  userId: string | null;
  amount: number | null;
  reason: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface NftSimState {
  users: UserRecord[];
  nfts: NftRecord[];
  nft_trades: NftTradeRecord[];
  wallets: WalletRecord[];
  wallet_ledger: WalletLedgerRecord[];
  income_ledger: IncomeLedgerRecord[];
  mlm_tree: MlmTreeRecord[];
  bot_subscriptions: BotSubscriptionRecord[];
  bot_activity: BotActivityRecord[];
  withdrawals: WithdrawalRecord[];
  deposits: DepositRecord[];
  system_reserve: SystemReserveRecord;
  admin_settings: AdminSettingsRecord;
  safety_logs: SafetyLogRecord[];
}
