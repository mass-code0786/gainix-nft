"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  LoaderCircle,
  X,
} from "lucide-react";
import { isAddress, parseUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { ApiRequestError, fetchJson } from "@/lib/api/client";
import { MIN_WITHDRAWAL_AMOUNT } from "@/config/withdrawal";
import { getWalletTransactionStatusDisplay } from "@/lib/wallet/transaction-status";
import {
  erc20TransferAbi,
  USDT_DECIMALS,
  USDT_SYMBOL,
  type UsdtPaymentConfig,
  usdtPaymentConfig,
} from "@/lib/web3/usdt";
import { formatCurrency, maskAddress, maskAddressesInText } from "@/utils/format";

export type WalletAction = "deposit" | "withdraw" | "transfer";
const GXN_TOKEN_VALUE_USD = 0.05;
const GXN_WITHDRAWAL_DEDUCTION_PERCENT = 20;

interface WalletMutationResponse {
  wallet: {
    tradingWallet: number;
    withdrawalWallet: number;
    gxnTokenBalance: number;
    gxnTokenValueUsd: number;
    gxnTokenUsdValue: number;
  };
  withdrawal?: {
    id: string;
    grossAmount: number;
    feeAmount: number;
    gxnDeductionAmount: number;
    gxnTokens: number;
    netAmount: number;
    status: "requested" | "approved_pending_tx" | "approved" | "completed" | "failed" | string;
    payoutStatus: string;
    payoutTxHash: string | null;
    withdrawalTxHash: string | null;
    onChainStatus: "PENDING" | "CONFIRMED" | "FAILED";
  };
}

interface DepositVerifyResponse extends WalletMutationResponse {
  deposit: {
    txHash: string;
    creditedAmount: number;
    status: "confirmed";
  };
}

type DepositConfigResponse = UsdtPaymentConfig;

type WithdrawalFlowState =
  | "IDLE"
  | "CALCULATED"
  | "REQUEST_SUBMITTED"
  | "PROCESSING_PAYMENT"
  | "WITHDRAWN"
  | "FAILED";

interface WalletBalancesResponse {
  withdrawals: NonNullable<WalletMutationResponse["withdrawal"]>[];
}

interface RecentWalletAction {
  id: string;
  type: WalletAction;
  amount: number;
  netAmount?: number;
  createdAt: string;
}

interface WalletActionPanelProps {
  walletAddress: string | null;
  tradingWallet: number;
  withdrawalWallet: number;
  gxnTokenBalance: number;
  gxnTokenValueUsd: number;
  gxnTokenUsdValue: number;
  totalBuyCount?: number;
  totalSellCount?: number;
  dailyBuyCount?: number;
  dailySellCount?: number;
  dailyBuyLimit?: number;
  dailySellLimit?: number;
  currentVipLevel?: number;
  bonusTrades?: number;
  capitalUnlocked?: boolean;
  capitalTransferredAt?: string | null;
  onRefresh: () => Promise<void>;
}

interface WalletActionModalProps extends WalletActionPanelProps {
  action: WalletAction;
  onClose: () => void;
  onRecorded: (item: RecentWalletAction) => void;
}

function WalletBalanceCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_38%),linear-gradient(155deg,rgba(18,7,9,0.92),rgba(8,8,12,0.96))] p-3 shadow-[0_0_22px_rgba(239,68,68,0.10)] sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">
        {label}
      </p>
      <p className="mt-2 truncate font-display text-[1.15rem] font-semibold leading-tight text-white sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function parseAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isValidUsdtPaymentConfig(config: UsdtPaymentConfig) {
  return (
    isAddress(config.tokenAddress) &&
    config.tokenAddress.toLowerCase() !== zeroAddress &&
    isAddress(config.treasuryAddress) &&
    config.treasuryAddress.toLowerCase() !== zeroAddress &&
    Number.isFinite(config.chainId) &&
    config.chainId > 0
  );
}

function numberFromPayload(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function capitalLockedMessage(
  payload: Record<string, unknown> | null,
  fallbackBuyCount: number,
  fallbackSellCount: number,
) {
  const requiredBuyCount = numberFromPayload(payload, "requiredBuyCount") ?? 300;
  const requiredSellCount = numberFromPayload(payload, "requiredSellCount") ?? 300;
  const buyCount = Math.min(
    numberFromPayload(payload, "buyCount") ?? fallbackBuyCount,
    requiredBuyCount,
  );
  const sellCount = Math.min(
    numberFromPayload(payload, "sellCount") ?? fallbackSellCount,
    requiredSellCount,
  );
  const remainingBuyCount =
    numberFromPayload(payload, "remainingBuyCount") ?? Math.max(requiredBuyCount - buyCount, 0);
  const remainingSellCount =
    numberFromPayload(payload, "remainingSellCount") ?? Math.max(requiredSellCount - sellCount, 0);

  return `Your capital is still locked. You have completed ${buyCount}/${requiredBuyCount} buys and ${sellCount}/${requiredSellCount} sells. Remaining: ${remainingBuyCount} buys and ${remainingSellCount} sells.`;
}

function transferErrorMessage(error: unknown, buyCount: number, sellCount: number) {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) {
      return capitalLockedMessage(error.payload, buyCount, sellCount);
    }

    if (error.message === "Capital has already been transferred.") {
      return error.message;
    }

    return error.message;
  }

  return error instanceof Error ? error.message : "Transfer capital failed.";
}

function safeWithdrawalErrorMessage(error: unknown) {
  console.error("[withdraw.error] rawError=", error);

  if (error instanceof ApiRequestError) {
    if (error.status < 500 && error.message) {
      return error.message;
    }
  }

  const rawMessage = error instanceof Error ? error.message : "";
  const lowerMessage = rawMessage.toLowerCase();

  if (
    lowerMessage.includes("insufficient balance") ||
    lowerMessage.includes("insufficient funds") ||
    lowerMessage.includes("vault has insufficient")
  ) {
    return "Withdrawal vault has insufficient balance.";
  }

  if (
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("not authorized") ||
    lowerMessage.includes("claimable") ||
    lowerMessage.includes("0x2c5211c6") ||
    lowerMessage.includes("reverted") ||
    lowerMessage.includes("unable to decode")
  ) {
    return "Withdrawal is not authorized yet. Please wait for blockchain verification.";
  }

  return "Withdrawal failed. Please try again later.";
}

function bscScanTxUrl(hash: string) {
  return `https://bscscan.com/tx/${hash}`;
}

function WalletActionModal({
  action,
  walletAddress,
  tradingWallet,
  withdrawalWallet,
  totalBuyCount = 0,
  totalSellCount = 0,
  onClose,
  onRefresh,
  onRecorded,
}: WalletActionModalProps) {
  const { address: connectedAddress, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [depositConfig, setDepositConfig] = useState<UsdtPaymentConfig>(usdtPaymentConfig);
  const [isDepositConfigLoading, setIsDepositConfigLoading] = useState(action === "deposit");
  const [depositConfigError, setDepositConfigError] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId: depositConfig.chainId });
  const walletAuth = useWalletAuth(walletAddress);
  const [amountInput, setAmountInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<WalletMutationResponse["withdrawal"] | null>(null);
  const [withdrawalFlowState, setWithdrawalFlowState] = useState<WithdrawalFlowState>("IDLE");
  const amount = parseAmount(amountInput);
  const transferAmount = Number(tradingWallet.toFixed(2));
  const feeAmount = action === "withdraw" ? Number((amount * 0.1).toFixed(2)) : 0;
  const gxnDeductionAmount =
    action === "withdraw" ? Number((amount * (GXN_WITHDRAWAL_DEDUCTION_PERCENT / 100)).toFixed(2)) : 0;
  const gxnTokens = action === "withdraw" ? Number((gxnDeductionAmount / GXN_TOKEN_VALUE_USD).toFixed(2)) : 0;
  const netAmount = action === "withdraw" ? Number((amount - feeAmount - gxnDeductionAmount).toFixed(2)) : amount;
  const title = action === "deposit" ? "Deposit" : action === "withdraw" ? "Withdraw" : "Transfer capital";
  const depositConfigReady = isValidUsdtPaymentConfig(depositConfig);
  const withdrawalStatusDisplay = pendingWithdrawal
    ? getWalletTransactionStatusDisplay(pendingWithdrawal)
    : null;

  useEffect(() => {
    if (action !== "withdraw" || !walletAddress || !pendingWithdrawal) {
      return;
    }

    let isMounted = true;
    const requestWalletAddress = walletAddress;
    const trackedWithdrawal = pendingWithdrawal;

    async function refreshWithdrawalState() {
      try {
        const balances = await fetchJson<WalletBalancesResponse>(
          `/api/wallet/balances?walletAddress=${encodeURIComponent(requestWalletAddress)}`,
        );
        if (!isMounted) {
          return;
        }

        const latestWithdrawal =
          balances.withdrawals.find((withdrawal) => withdrawal.id === trackedWithdrawal.id) ??
          trackedWithdrawal;
        setPendingWithdrawal(latestWithdrawal);

        if (
          latestWithdrawal.onChainStatus === "CONFIRMED" ||
          latestWithdrawal.payoutStatus === "PAID" ||
          latestWithdrawal.status === "completed" ||
          latestWithdrawal.status === "approved"
        ) {
          setWithdrawalFlowState("WITHDRAWN");
          setTxHash(latestWithdrawal.withdrawalTxHash ?? latestWithdrawal.payoutTxHash ?? null);
          return;
        }

        if (latestWithdrawal.onChainStatus === "FAILED" || latestWithdrawal.status === "failed") {
          setWithdrawalFlowState("FAILED");
          return;
        }

        if (latestWithdrawal.status === "approved_pending_tx" || latestWithdrawal.payoutStatus === "PENDING_TX") {
          setWithdrawalFlowState("PROCESSING_PAYMENT");
          return;
        }

        setWithdrawalFlowState("REQUEST_SUBMITTED");
      } catch (statusError) {
        if (!isMounted) {
          return;
        }

        console.error("[withdraw.error] rawError=", statusError);
        setWithdrawalFlowState("REQUEST_SUBMITTED");
      }
    }

    void refreshWithdrawalState();
    const interval = window.setInterval(() => void refreshWithdrawalState(), 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [
    action,
    pendingWithdrawal?.id,
    walletAddress,
  ]);

  useEffect(() => {
    if (action !== "deposit") {
      return;
    }

    let isMounted = true;
    setIsDepositConfigLoading(true);
    setDepositConfigError(null);

    fetchJson<DepositConfigResponse>("/api/deposit/config")
      .then((config) => {
        if (!isMounted) {
          return;
        }

        setDepositConfig(config);
        if (process.env.NODE_ENV === "development") {
          console.info("[gainix:deposit-config] Resolved API deposit config:", {
            chainId: config.chainId,
            hasTreasuryAddress: Boolean(config.treasuryAddress),
            hasUsdtAddress: Boolean(config.tokenAddress),
          });
        }
      })
      .catch((configError) => {
        if (!isMounted) {
          return;
        }

        setDepositConfigError(
          maskAddressesInText(configError instanceof Error ? configError.message : "USDT deposit settings are not configured."),
        );
        if (process.env.NODE_ENV === "development") {
          console.warn("[gainix:deposit-config] Unable to load API deposit config:", {
            error: configError instanceof Error ? configError.message : "unknown",
            fallbackChainId: usdtPaymentConfig.chainId,
            fallbackHasTreasuryAddress: Boolean(usdtPaymentConfig.treasuryAddress),
            fallbackHasUsdtAddress: Boolean(usdtPaymentConfig.tokenAddress),
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsDepositConfigLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [action]);

  const validationError = useMemo(() => {
    if (action === "transfer") {
      return null;
    }

    if (amountInput.trim().length === 0) {
      return null;
    }

    if (amount <= 0) {
      return "Amount must be greater than 0.";
    }

    if (action === "deposit" && !/^\d+(\.\d{1,18})?$/.test(amountInput.trim())) {
      return "Enter a valid USDT amount.";
    }

    if (action === "withdraw" && amount < MIN_WITHDRAWAL_AMOUNT) {
      return `Minimum withdrawal is $${MIN_WITHDRAWAL_AMOUNT}.`;
    }

    if (action === "withdraw" && amount > withdrawalWallet) {
      return "Amount exceeds your withdrawal wallet balance.";
    }

    if (action === "deposit" && !walletAddress) {
      return null;
    }

    if (
      action === "withdraw" &&
      walletAddress &&
      connectedAddress &&
      connectedAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      return "Connect the wallet that owns this withdrawal.";
    }

    if (action === "deposit" && isDepositConfigLoading) {
      return null;
    }

    if (action === "deposit" && (!depositConfigReady || depositConfigError)) {
      return depositConfigError ?? "USDT deposit settings are not configured.";
    }

    return null;
  }, [
    action,
    amount,
    amountInput,
    depositConfigReady,
    depositConfigError,
    isDepositConfigLoading,
    withdrawalWallet,
    connectedAddress,
    walletAddress,
  ]);

  async function prepareOnChainWithdrawal() {
    if (!walletAddress) {
      setError("Connect your wallet to continue.");
      return;
    }

    const result = await fetchJson<WalletMutationResponse>("/api/withdraw", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        amount,
      }),
    });

    if (!result.withdrawal) {
      throw new Error("Withdrawal request was not returned.");
    }

    setPendingWithdrawal(result.withdrawal);
    setWithdrawalFlowState("REQUEST_SUBMITTED");
  }

  async function submit() {
    setError(null);
    setSuccess(null);

    if (!walletAddress) {
      setError("Connect your wallet to continue.");
      return;
    }

    if (action !== "transfer" && amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await walletAuth.ensureVerifiedSession();

      if (action === "deposit") {
        if (!depositConfigReady) {
          throw new Error(depositConfigError ?? "USDT deposit settings are not configured.");
        }

        if (!publicClient) {
          throw new Error("BSC RPC client is not available.");
        }

        if (chainId !== depositConfig.chainId && switchChainAsync) {
          await switchChainAsync({ chainId: depositConfig.chainId });
        }

        const hash = await writeContractAsync({
          address: depositConfig.tokenAddress,
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [
            depositConfig.treasuryAddress,
            parseUnits(amountInput.trim(), USDT_DECIMALS),
          ],
          chainId: depositConfig.chainId,
        });
        setTxHash(hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("USDT transfer was not successful.");
        }
        await fetchJson<DepositVerifyResponse>("/api/deposit/verify", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            txHash: hash,
            expectedAmount: amount,
          }),
        });
      } else {
        if (action === "withdraw") {
          if (!pendingWithdrawal) {
            await prepareOnChainWithdrawal();
            await onRefresh();
            onRecorded({
              id: `withdraw-${Date.now()}`,
              type: "withdraw",
              amount,
              netAmount,
              createdAt: new Date().toISOString(),
            });
            setSuccess("Withdrawal request submitted. Waiting for blockchain verification.");
            return;
          }

          setError(
            withdrawalFlowState === "WITHDRAWN"
              ? "Withdrawal is already completed."
              : "Withdrawal request is already submitted.",
          );
          return;
        } else {
          await fetchJson<WalletMutationResponse>("/api/wallet/transfer-capital", {
          method: "POST",
            body: JSON.stringify({
              walletAddress,
            }),
          });
        }
      }
      await onRefresh();
      onRecorded({
        id: `${action}-${Date.now()}`,
        type: action,
        amount: action === "transfer" ? transferAmount : amount,
        createdAt: new Date().toISOString(),
      });
      setSuccess(
        action === "deposit"
          ? "USDT deposit verified and credited to trading wallet."
          : "Capital transferred to withdrawal wallet.",
      );
      setAmountInput("");
      setPendingWithdrawal(null);
    } catch (submitError) {
      setError(
        maskAddressesInText(
          action === "transfer"
            ? transferErrorMessage(submitError, totalBuyCount, totalSellCount)
            : action === "withdraw"
              ? safeWithdrawalErrorMessage(submitError)
              : submitError instanceof Error
                ? submitError.message
                : `${title} failed.`,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start overflow-y-auto bg-black/75 px-3 pb-[calc(7rem_+_env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm sm:items-center sm:justify-center sm:py-6">
      <div className="flex max-h-[calc(100dvh_-_8rem_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(25,8,10,0.98),rgba(8,8,12,0.99))] shadow-2xl shadow-red-950/30 sm:max-h-[calc(100dvh_-_3rem)]">
        <div className="shrink-0 border-b border-white/10 bg-black/10 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="muted-label">Wallet action</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:px-5 sm:pb-5">
          {action === "transfer" ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <span>Capital transfer</span>
                <span className="text-white">Full principal</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Amount</span>
                <span className="text-emerald-200">{formatCurrency(transferAmount)}</span>
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Amount</span>
              <input
                className="input-shell"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(event) => {
                  const nextAmountInput = event.target.value;
                  const nextAmount = parseAmount(nextAmountInput);
                  setAmountInput(nextAmountInput);
                  setError(null);
                  setSuccess(null);
                  setTxHash(null);
                  setPendingWithdrawal(null);
                  setWithdrawalFlowState(nextAmount > 0 ? "CALCULATED" : "IDLE");
                }}
              />
            </label>
          )}

        {action === "deposit" ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-3">
              <span>Asset</span>
              <span className="text-white">{USDT_SYMBOL} BEP20</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-zinc-500">
              <span>Gas</span>
              <span>BNB</span>
            </div>
            {txHash ? (
              <div className="mt-2 flex items-center justify-between gap-3 text-zinc-500">
                <span>Tx hash</span>
                <span className="text-zinc-300">{maskAddress(txHash)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {action === "withdraw" || action === "transfer" ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
            {action === "withdraw" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span>USDT withdrawal</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Withdrawal Amount</span>
                  <span className="text-white">{formatCurrency(amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>10% platform fee</span>
                  <span className="text-rose-200">{formatCurrency(feeAmount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>20% GXN token deduction</span>
                  <span className="text-purple-200">{formatCurrency(gxnDeductionAmount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>User will receive</span>
                  <span className="text-emerald-200">{formatCurrency(Math.max(netAmount, 0))}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>GXN tokens user will get</span>
                  <span className="text-amber-200">{gxnTokens.toLocaleString()} GXN</span>
                </div>
                {pendingWithdrawal ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Status</span>
                      <span className={`rounded-full border px-2 py-0.5 ${withdrawalStatusDisplay?.className ?? "border-amber-400/20 bg-amber-500/10 text-amber-200"}`}>
                        {withdrawalStatusDisplay?.label ??
                          (withdrawalFlowState === "WITHDRAWN"
                            ? "Confirmed"
                            : withdrawalFlowState === "PROCESSING_PAYMENT"
                              ? "Processing"
                              : withdrawalFlowState === "FAILED"
                                ? "Failed"
                                : "Requested")}
                      </span>
                    </div>
                    {withdrawalFlowState === "REQUEST_SUBMITTED" ? (
                      <div className="mt-2 text-amber-100">Blockchain Verification</div>
                    ) : null}
                    {withdrawalFlowState === "PROCESSING_PAYMENT" ? (
                      <div className="mt-2 text-amber-100">Processing Payment</div>
                    ) : null}
                    {withdrawalFlowState === "WITHDRAWN" ? (
                      <div className="mt-2 text-emerald-200">Confirmed</div>
                    ) : null}
                    {txHash ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span>Tx hash</span>
                        <a
                          className="text-emerald-200 underline decoration-emerald-200/40 underline-offset-4"
                          href={bscScanTxUrl(txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {maskAddress(txHash)}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>Capital transfer</span>
                <span className="text-white">Trading to withdrawal</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-zinc-500">
              <span>Available balance</span>
              <span>{formatCurrency(action === "withdraw" ? withdrawalWallet : tradingWallet)}</span>
            </div>
          </div>
        ) : null}
        {validationError ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {validationError}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 whitespace-pre-line rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
        </div>

        <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(12,8,10,0.92),rgba(8,8,12,0.99))] p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:p-5">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              isSubmitting ||
              walletAuth.isSigning ||
              Boolean(validationError) ||
              (action === "withdraw" &&
                (!walletAddress ||
                  amount <= 0 ||
                  Boolean(pendingWithdrawal)))
            }
            className="premium-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || walletAuth.isSigning ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {walletAuth.signPrompt ??
              (action === "deposit"
                ? `Send ${USDT_SYMBOL}`
                : action === "withdraw"
                  ? pendingWithdrawal
                    ? withdrawalFlowState === "WITHDRAWN"
                      ? "Completed"
                      : withdrawalFlowState === "PROCESSING_PAYMENT"
                        ? "Processing Payment"
                        : "Blockchain Verification"
                    : "Submit Withdrawal Request"
                  : title)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WalletActionPanel({
  walletAddress,
  tradingWallet,
  withdrawalWallet,
  gxnTokenBalance,
  gxnTokenValueUsd,
  gxnTokenUsdValue,
  totalBuyCount = 0,
  totalSellCount = 0,
  dailyBuyCount = 0,
  dailySellCount = 0,
  dailyBuyLimit = 6,
  dailySellLimit = 6,
  currentVipLevel = 0,
  bonusTrades = 0,
  capitalUnlocked = false,
  capitalTransferredAt = null,
  onRefresh,
}: WalletActionPanelProps) {
  const [walletAction, setWalletAction] = useState<WalletAction | null>(null);
  const [recentActions, setRecentActions] = useState<RecentWalletAction[]>([]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_30%),linear-gradient(160deg,rgba(18,7,9,0.96),rgba(8,8,12,0.98))] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="muted-label">Wallet Summary</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <WalletBalanceCard label="Trading Wallet" value={formatCurrency(tradingWallet)} />
            <WalletBalanceCard label="Withdrawal Wallet" value={formatCurrency(withdrawalWallet)} />
            <div className="col-span-2 overflow-hidden rounded-2xl border border-purple-400/20 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_40%),linear-gradient(145deg,rgba(14,8,20,0.95),rgba(4,4,7,0.98))] p-3 shadow-[0_0_26px_rgba(168,85,247,0.14)] sm:p-4">
              <div className="flex items-center gap-3">
                <img
                  src="/images/gxn-token.png"
                  alt="GXN TOKEN"
                  className="h-10 w-10 rounded-full border border-amber-300/30 object-cover shadow-lg shadow-purple-500/20 sm:h-12 sm:w-12"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300 sm:text-xs">GXN TOKEN</p>
                  <p className="mt-1 truncate font-display text-lg font-semibold text-white sm:text-xl">
                    {gxnTokenBalance.toLocaleString()} GXN
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
                <span>Token value {formatCurrency(gxnTokenValueUsd)}</span>
                <span className="text-amber-100">{formatCurrency(gxnTokenUsdValue)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
          <button
            type="button"
            onClick={() => setWalletAction("deposit")}
            disabled={!walletAddress}
            className="premium-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setWalletAction("withdraw")}
            disabled={!walletAddress}
            className="secondary-button w-full border-rose-500/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            Withdraw
          </button>
          <button
            type="button"
            onClick={() => setWalletAction("transfer")}
            disabled={!walletAddress}
            className="secondary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer Capital
          </button>
        </div>
      </div>

      {recentActions.length > 0 ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="muted-label">Recent wallet actions</p>
          <div className="mt-3 space-y-2">
            {recentActions.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <span className="text-zinc-300">
                  {item.type === "deposit" ? "Deposit" : item.type === "withdraw" ? "Withdraw" : "Transfer Capital"}
                </span>
                <span className="text-white">
                  {formatCurrency(item.type === "withdraw" ? item.netAmount ?? item.amount : item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {walletAction ? (
        <WalletActionModal
          action={walletAction}
          walletAddress={walletAddress}
          tradingWallet={tradingWallet}
          withdrawalWallet={withdrawalWallet}
          gxnTokenBalance={gxnTokenBalance}
          gxnTokenValueUsd={gxnTokenValueUsd}
          gxnTokenUsdValue={gxnTokenUsdValue}
          totalBuyCount={totalBuyCount}
          totalSellCount={totalSellCount}
          dailyBuyCount={dailyBuyCount}
          dailySellCount={dailySellCount}
          dailyBuyLimit={dailyBuyLimit}
          dailySellLimit={dailySellLimit}
          currentVipLevel={currentVipLevel}
          bonusTrades={bonusTrades}
          capitalUnlocked={capitalUnlocked}
          capitalTransferredAt={capitalTransferredAt}
          onClose={() => setWalletAction(null)}
          onRefresh={onRefresh}
          onRecorded={(item) =>
            setRecentActions((current) => [item, ...current].slice(0, 5))
          }
        />
      ) : null}
    </section>
  );
}
