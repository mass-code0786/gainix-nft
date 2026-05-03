"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { Blocks, LoaderCircle, Rocket, ShieldCheck, Wallet } from "lucide-react";
import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TxFeedbackCard } from "@/components/ui/tx-feedback-card";
import { OwnerDebugPanel } from "@/components/wallet/owner-debug-panel";
import { useAdminMint } from "@/hooks/actions/useAdminMint";
import { useBatchAdminMint } from "@/hooks/actions/useBatchAdminMint";
import { useSetNftBaseUri } from "@/hooks/actions/useSetNftBaseUri";
import { useNftAdminAccess } from "@/hooks/useNftAdminAccess";
import { useWallet } from "@/hooks/useWallet";
import { contractActiveChainId } from "@/contracts/config/chain";
import { buildLiveNftSlug } from "@/lib/web3/live-nft";
import { buildMarketplaceHref } from "@/lib/marketplace/routing";
import { isSameAddress, shortenAddress } from "@/lib/web3/wallet-utils";
import { maskAddress, maskAddressesInText } from "@/utils/format";
import collectionConfig from "../../../../../config/gainix-nft-collection.json";

const metadataBaseUri = `ipfs://${collectionConfig.ipfs.metadataCid}/`;
const DEBUG_DISABLE_OWNER_REDIRECT = true;
const metadataOptions = collectionConfig.assets.map((asset) => ({
  id: asset.id,
  label: asset.name,
  metadataFilename: asset.metadataFilename,
  metadataUri: `ipfs://${collectionConfig.ipfs.metadataCid}/${asset.metadataFilename}`,
}));

export default function DevAdminMintPage() {
  const { address, chainId, chainName, isConnected } = useWallet();
  const { adminMint, feedback } = useAdminMint();
  const { mintBatch, status: batchStatus, summary: batchSummary, results: batchResults, reset: resetBatch } = useBatchAdminMint();
  const { setBaseTokenUri, feedback: baseUriFeedback } = useSetNftBaseUri();
  const {
    contractAddress,
    contractChainId,
    currentChainId,
    connectedWallet,
    connectedWalletComparison,
    owner,
    ownerComparison,
    nextTokenId,
    adminCheckResult,
    isOwner,
    isOwnerCheckReady,
    chainMismatch,
    walletStatus,
    isLoading,
    error,
  } = useNftAdminAccess();
  const [recipient, setRecipient] = useState(address ?? "");
  const [selectedMetadataId, setSelectedMetadataId] = useState(metadataOptions[0]?.id ?? "");
  const [uriMode, setUriMode] = useState<"relative" | "full">("relative");
  const [tokenUri, setTokenUri] = useState(metadataOptions[0]?.metadataFilename ?? "");
  const [baseUri, setBaseUri] = useState(metadataBaseUri);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [pendingTokenId, setPendingTokenId] = useState<number | null>(null);

  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address, recipient]);

  useEffect(() => {
    if (!isOwnerCheckReady) {
      return;
    }

    console.log("[/dev/admin-mint] owner check", {
      contractAddress,
      contractChainId,
      connectedWallet: connectedWallet ?? address ?? null,
      contractOwner: owner ?? null,
      isOwner,
      chainId: chainId ?? null,
      currentChainId,
      isOwnerCheckReady,
    });
  }, [address, chainId, connectedWallet, contractAddress, contractChainId, currentChainId, isOwner, isOwnerCheckReady, owner]);

  useEffect(() => {
    if (
      DEBUG_DISABLE_OWNER_REDIRECT ||
      !isConnected ||
      isLoading ||
      !isOwnerCheckReady ||
      error ||
      isOwner
    ) {
      return;
    }

    // Redirect intentionally disabled while validating owner access diagnostics.
  }, [error, isConnected, isLoading, isOwner, isOwnerCheckReady]);

  useEffect(() => {
    if (feedback.status !== "success") {
      return;
    }

    setFormError(undefined);
  }, [feedback.status]);

  useEffect(() => {
    const selected = metadataOptions.find((item) => item.id === selectedMetadataId);

    if (!selected) {
      return;
    }

    setTokenUri(uriMode === "relative" ? selected.metadataFilename : selected.metadataUri);
  }, [selectedMetadataId, uriMode]);

  const isOnConfiguredChain = !isConnected || chainId === contractActiveChainId;
  const isBusy = feedback.status === "awaiting_wallet" || feedback.status === "pending_chain";
  const isBatchBusy = batchStatus === "running";
  const isBaseUriBusy = baseUriFeedback.status === "awaiting_wallet" || baseUriFeedback.status === "pending_chain";
  const isCheckingOwner = isLoading || (isConnected && !isOwnerCheckReady);
  const canMint = isConnected && isOnConfiguredChain && isOwner && !isBusy && !isBatchBusy;
  const canBatchMint = isConnected && isOnConfiguredChain && isOwner && !isBusy && !isBatchBusy;
  const canSetBaseUri = isConnected && isOnConfiguredChain && isOwner && !isBaseUriBusy;
  const mintedSlug = pendingTokenId !== null ? buildLiveNftSlug(pendingTokenId) : null;
  const mintedToConnectedWallet = isSameAddress(recipient, address);
  const accessLabel = isCheckingOwner ? "Checking" : isOwner ? "Owner" : "No access";

  const submitMint = async () => {
    setFormError(undefined);

    if (!recipient || !isAddress(recipient)) {
      setFormError("Enter a valid recipient wallet address.");
      return;
    }

    if (!tokenUri.trim()) {
      setFormError("Enter a metadata URI.");
      return;
    }

    if (!isOwner) {
      setFormError("Only the owner wallet can mint from this route.");
      return;
    }

    if (!isOnConfiguredChain) {
      setFormError("Switch to BNB Smart Chain Mainnet before minting.");
      return;
    }

    if (nextTokenId !== null) {
      setPendingTokenId(nextTokenId);
    }

    await adminMint({
      recipient: recipient as `0x${string}`,
      tokenUri: tokenUri.trim(),
    });
  };

  const submitBaseUri = async () => {
    setFormError(undefined);

    if (!baseUri.trim()) {
      setFormError("Enter a base URI.");
      return;
    }

    if (!isOwner) {
      setFormError("Only the owner wallet can update base URI.");
      return;
    }

    if (!isOnConfiguredChain) {
      setFormError("Switch to BNB Smart Chain Mainnet before updating base URI.");
      return;
    }

    await setBaseTokenUri(baseUri.trim());
  };

  const submitBatchMint = async () => {
    setFormError(undefined);

    if (!recipient || !isAddress(recipient)) {
      setFormError("Enter a valid recipient wallet address.");
      return;
    }

    if (!isOwner) {
      setFormError("Only the owner wallet can mint from this route.");
      return;
    }

    if (!isOnConfiguredChain) {
      setFormError("Switch to BNB Smart Chain Mainnet before batch minting.");
      return;
    }

    if (nextTokenId !== null) {
      setPendingTokenId(nextTokenId);
    }

    const batchItems = metadataOptions.map((item) => ({
      id: item.id,
      label: item.label,
      tokenUri: uriMode === "relative" ? item.metadataFilename : item.metadataUri,
    }));

    await mintBatch({
      recipient: recipient as `0x${string}`,
      items: batchItems,
    });
  };

  if (!isConnected) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="Dev"
          title="Admin mint"
          description="Connect the contract owner wallet to continue."
        />

        <div className="section-shell max-w-xl">
          <div className="flex items-center gap-3 text-zinc-200">
            <Wallet className="h-4 w-4 text-gainix-300" />
            Wallet required
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            This route is reserved for operational minting.
          </p>
          <Link href="/connect" className="premium-button mt-4 w-fit">
            Connect wallet
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  if (isCheckingOwner) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="Dev"
          title="Admin mint"
          description="Checking contract owner access."
        />

        <div className="section-shell max-w-xl text-sm text-zinc-300">
          Verifying the connected wallet against the NFT contract owner.
        </div>
      </AnimatedPage>
    );
  }

  if (!error && !isOwner) {
    return (
      <AnimatedPage>
        <PageHeader
          eyebrow="Dev"
          title="Admin mint"
          description="Owner access required."
        />

        <div className="section-shell max-w-xl text-sm text-zinc-300">
          This route unlocks only for the current `owner()` wallet from the NFT contract. Redirect is disabled for debugging.
        </div>

        <div className="section-shell max-w-xl text-sm text-zinc-200">
          <p>Connected Wallet: {connectedWallet ? shortenAddress(connectedWallet) : "Unavailable"}</p>
          <p className="mt-2">Contract Owner: {owner ? maskAddress(owner) : "Unavailable"}</p>
          <p className="mt-2">isOwner: {String(isOwner)}</p>
          <p className="mt-2">Chain ID: {chainId ?? "none"}</p>
        </div>

        <OwnerDebugPanel
          contractAddress={contractAddress}
          connectedWallet={connectedWallet}
          connectedWalletComparison={connectedWalletComparison}
          owner={owner}
          ownerComparison={ownerComparison}
          isOwner={isOwner}
          isOwnerCheckReady={isOwnerCheckReady}
          currentChainId={currentChainId}
          contractChainId={contractChainId}
          chainMismatch={chainMismatch}
          walletStatus={walletStatus}
          adminCheckResult={adminCheckResult}
          error={error}
          revealFullAddresses={isOwner}
        />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow="Dev"
        title="Admin mint"
        description="Mint collection items from the hidden owner route."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Access"
          value={accessLabel}
          detail={isOwner ? "Contract owner wallet" : "Owner only route"}
          icon={ShieldCheck}
          tone="positive"
        />
        <StatCard label="Wallet" value={shortenAddress(address)} detail={chainName} icon={Wallet} />
        <StatCard
          label="Next token"
          value={nextTokenId !== null ? `#${nextTokenId}` : "..."}
          detail="Next mint id"
          icon={Blocks}
        />
      </div>

      <OwnerDebugPanel
        contractAddress={contractAddress}
        connectedWallet={connectedWallet}
        connectedWalletComparison={connectedWalletComparison}
        owner={owner}
        ownerComparison={ownerComparison}
        isOwner={isOwner}
        isOwnerCheckReady={isOwnerCheckReady}
        currentChainId={currentChainId}
        contractChainId={contractChainId}
        chainMismatch={chainMismatch}
        walletStatus={walletStatus}
        adminCheckResult={adminCheckResult}
        error={error}
        revealFullAddresses={isOwner}
      />

      <div className="section-shell text-sm text-zinc-300">
        <p>
          Contract owner: <span className="text-zinc-100">{owner ? shortenAddress(owner) : "Unavailable"}</span>
        </p>
        <p className="mt-2 text-zinc-400">
          Connected wallet is {isOwner ? "the owner" : "not the owner"} for mint operations.
        </p>
        <p className="mt-2 text-zinc-500">
          Current chain id: {currentChainId ?? "none"} | Contract chain id: {contractChainId} | Chain mismatch: {chainMismatch ? "true" : "false"}
        </p>
      </div>

      <div className="section-shell text-sm text-zinc-200">
        <p>Connected Wallet: {connectedWallet ?? "Unavailable"}</p>
        <p className="mt-2">Contract Owner: {owner ?? "Unavailable"}</p>
        <p className="mt-2">isOwner: {String(isOwner)}</p>
        <p className="mt-2">Chain ID: {chainId ?? "none"}</p>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="section-shell">
          <p className="muted-label">Mint NFT</p>
          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Recipient address</span>
              <input
                className="input-shell"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="0x..."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Metadata preset</span>
              <select
                className="input-shell"
                value={selectedMetadataId}
                onChange={(event) => setSelectedMetadataId(event.target.value)}
              >
                {metadataOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setUriMode("relative")}
                className={`secondary-button ${uriMode === "relative" ? "border-gainix-300/40 text-gainix-100" : ""}`}
              >
                URI mode: relative
              </button>
              <button
                type="button"
                onClick={() => setUriMode("full")}
                className={`secondary-button ${uriMode === "full" ? "border-gainix-300/40 text-gainix-100" : ""}`}
              >
                URI mode: full IPFS
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Metadata URI</span>
              <textarea
                className="input-shell min-h-28 resize-y"
                value={tokenUri}
                onChange={(event) => setTokenUri(event.target.value)}
                placeholder="cat.json or ipfs://.../cat.json"
              />
            </label>

            <p className="text-xs leading-6 text-zinc-400">
              Use relative URIs when base URI is set on contract (recommended). Use full IPFS URIs only if base URI is empty.
            </p>

            {formError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                {formError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                {maskAddressesInText(error)}
              </div>
            ) : null}

            {!isOnConfiguredChain ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/90">
                Switch to BNB Smart Chain Mainnet before minting.
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void submitMint()}
                disabled={!canMint}
                className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Mint NFT
              </button>
              <Link href="/portfolio" className="secondary-button">
                Open portfolio
              </Link>
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-zinc-200">Batch mint prepared collection</p>
              <p className="mt-2 text-xs leading-6 text-zinc-400">
                Mints all 9 metadata files in order with separate wallet confirmations.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitBatchMint()}
                  disabled={!canBatchMint}
                  className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBatchBusy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                  Mint all 9
                </button>
                <button type="button" onClick={resetBatch} className="secondary-button" disabled={isBatchBusy}>
                  Reset batch log
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="section-shell">
          <p className="muted-label">Status</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">Mint feedback</h3>
          <div className="mt-5">
            <TxFeedbackCard feedback={feedback} />
          </div>

          {feedback.status === "success" && mintedSlug ? (
            <div className="mt-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Mint confirmed.
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href={pendingTokenId !== null ? buildMarketplaceHref(pendingTokenId) : "/marketplace"}
                  className="secondary-button border-emerald-500/20 text-emerald-100"
                >
                  Open NFT
                </Link>
                {mintedToConnectedWallet ? (
                  <Link href={`/list?slug=${mintedSlug}`} className="premium-button">
                    List NFT
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-zinc-100">Batch mint status</p>
            <p className="mt-2 text-xs text-zinc-400">{batchSummary}</p>
            {batchResults.length > 0 ? (
              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                {batchResults.map((result) => (
                  <div key={result.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs">
                    <p className="text-zinc-100">{result.label}</p>
                    <p className="mt-1 text-zinc-400">{result.status.replace("_", " ")}</p>
                    <p className="mt-1 break-all text-zinc-500">{result.tokenUri}</p>
                    {result.txHash ? <p className="mt-1 break-all text-zinc-400">{result.txHash}</p> : null}
                    {result.explorerUrl ? (
                      <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
                        View on explorer
                      </a>
                    ) : null}
                    {result.error ? <p className="mt-1 text-rose-300">{maskAddressesInText(result.error)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isOwner ? (
        <div className="section-shell">
          <p className="muted-label">Owner controls</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">Set base token URI</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Set once for CID-based metadata folders. Current collection target: <span className="text-zinc-200">{metadataBaseUri}</span>
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              className="input-shell"
              value={baseUri}
              onChange={(event) => setBaseUri(event.target.value)}
              placeholder={metadataBaseUri}
            />
            <button
              type="button"
              onClick={() => void submitBaseUri()}
              disabled={!canSetBaseUri}
              className="premium-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBaseUriBusy ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Set base URI
            </button>
          </div>
          <div className="mt-4">
            <TxFeedbackCard feedback={baseUriFeedback} />
          </div>
        </div>
      ) : null}
    </AnimatedPage>
  );
}
