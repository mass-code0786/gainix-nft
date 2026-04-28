import type { ContractWriteFeedback } from "@/hooks/actions/useContractWriteFlow";

interface TxFeedbackCardProps {
  feedback: ContractWriteFeedback;
}

export function TxFeedbackCard({ feedback }: TxFeedbackCardProps) {
  const tone =
    feedback.status === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : feedback.status === "error"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
        : "border-gainix-400/20 bg-gainix-500/10 text-zinc-100";

  if (feedback.status === "idle") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
        Ready to submit transaction. Confirm in wallet, then wait for testnet confirmation.
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 text-sm ${tone}`}>
      <p className="font-medium capitalize">{feedback.status.replace("_", " ")}</p>
      <p className="mt-2">{feedback.guidance}</p>
      {feedback.error ? <p className="mt-2 text-xs opacity-90">{feedback.error}</p> : null}
      {feedback.txHash ? (
        <div className="mt-3 space-y-1 text-xs">
          <p>Transaction hash</p>
          <p className="break-all">{feedback.txHash}</p>
          {feedback.explorerUrl ? (
            <a href={feedback.explorerUrl} target="_blank" rel="noreferrer" className="underline">
              View on explorer
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
