"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Wallet2 } from "lucide-react";
import { useRegistration } from "@/hooks/useRegistration";
import { useWallet } from "@/hooks/useWallet";

interface HeroPrimaryActionsProps {
  imageSrc?: string;
  imageAlt: string;
}

const infoCards = [
  {
    title: "What is NFT?",
    text: "NFT (Non-Fungible Token) is a unique digital asset stored on blockchain. Each NFT has a unique identity and can be bought or sold securely.",
  },
  {
    title: "How Trading Works",
    text: "Users buy NFTs from the marketplace. Each buy increases the NFT price automatically. Users can sell at higher price and earn profit.",
  },
  {
    title: "How You Earn",
    items: [
      "NFT Trading Profit",
      "Auto Trading Bot Profit",
      "Referral Income",
      "Level Income",
      "Royalty Rewards",
    ],
  },
  {
    title: "Smart System Benefits",
    items: [
      "Auto price growth system",
      "Daily trading limits",
      "Secure blockchain transactions",
      "Passive income options",
    ],
  },
] as const;

export function HeroActionButtons() {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const {
    fullAddress: liveWalletAddress,
    hasMounted,
    isConnected: liveIsConnected,
    isWalletHydrating: liveIsWalletHydrating,
  } = useWallet();
  const walletAddress = hasMounted ? liveWalletAddress : null;
  const isConnected = hasMounted ? liveIsConnected : false;
  const isWalletHydrating = hasMounted ? liveIsWalletHydrating : false;
  const {
    isRegistered: liveIsRegistered,
    isCheckingRegistration: liveIsCheckingRegistration,
    registerWallet,
    registrationError,
  } = useRegistration(walletAddress, isConnected);
  const isRegistered = hasMounted ? liveIsRegistered : false;
  const isCheckingRegistration = hasMounted ? liveIsCheckingRegistration : false;
  const [pendingAction, setPendingAction] = useState<"connect" | "register" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"default" | "warning" | "success">("default");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const walletStatusLabel = !hasMounted
    ? "Connect Wallet"
    : isConnected
      ? isCheckingRegistration
        ? "Checking registration..."
        : isRegistered
          ? "Registered"
          : "Not registered"
      : "Not connected";

  async function startRegistrationFlow() {
    if (!walletAddress) {
      setStatusMessage("Connect your wallet before starting registration.");
      setStatusTone("warning");
      return;
    }

    if (isRegistered) {
      setStatusMessage("Wallet already registered. Redirecting to dashboard.");
      setStatusTone("success");
      router.push("/dashboard");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Submitting your registration to the Gainix backend.");
    setStatusTone("default");

    try {
      const result = await registerWallet();
      setStatusMessage(result.message);
      setStatusTone("success");
      router.push("/dashboard");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Registration failed. Please try again.");
      setStatusTone("warning");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!hasMounted || !pendingAction || !isConnected || !walletAddress || isCheckingRegistration || isWalletHydrating || isSubmitting) {
      return;
    }

    if (pendingAction === "connect") {
      if (isRegistered) {
        setStatusMessage("Wallet verified. Redirecting to dashboard.");
        setStatusTone("success");
        router.push("/dashboard");
      } else {
        setStatusMessage("Please register first.");
        setStatusTone("warning");
      }

      setPendingAction(null);
      return;
    }

    if (pendingAction === "register") {
      setPendingAction(null);
      void startRegistrationFlow();
    }
  }, [hasMounted, pendingAction, isConnected, walletAddress, isCheckingRegistration, isWalletHydrating, isSubmitting, isRegistered, router]);

  function handleConnectWallet() {
    if (!hasMounted) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!isConnected) {
      if (!openConnectModal) {
        setStatusMessage("Wallet connection is unavailable right now. Please reload and try again.");
        setStatusTone("warning");
        return;
      }

      setStatusMessage("Open your wallet to connect. We will verify your registration right after connection.");
      setStatusTone("default");
      setPendingAction("connect");
      openConnectModal();
      return;
    }

    if (isCheckingRegistration) {
      setStatusMessage("Checking registration status...");
      setStatusTone("default");
      return;
    }

    if (isRegistered) {
      setStatusMessage("Wallet verified. Redirecting to dashboard.");
      setStatusTone("success");
      router.push("/dashboard");
      return;
    }

    setStatusMessage("Please register first.");
    setStatusTone("warning");
  }

  function handleRegisterNow() {
    if (!hasMounted) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!isConnected) {
      if (!openConnectModal) {
        setStatusMessage("Wallet connection is unavailable right now. Please reload and try again.");
        setStatusTone("warning");
        return;
      }

      setStatusMessage("Connect your wallet first. Registration will start automatically once the wallet is connected.");
      setStatusTone("default");
      setPendingAction("register");
      openConnectModal();
      return;
    }

    void startRegistrationFlow();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleConnectWallet}
        disabled={isSubmitting || isWalletHydrating}
        className={`premium-button w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
          isRegistered ? "ring-1 ring-white/20" : ""
        }`}
      >
        <Wallet2 className="mr-2 h-4 w-4" />
        {isWalletHydrating ? "Opening Wallet..." : "Connect Wallet"}
      </button>

      <button
        type="button"
        onClick={handleRegisterNow}
        disabled={isSubmitting || isCheckingRegistration}
        className={`secondary-button w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${
          !isRegistered ? "border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/15" : ""
        }`}
      >
        <UserPlus className="mr-2 h-4 w-4 text-red-300" />
        {isSubmitting ? "Registering..." : "Register Now"}
      </button>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
          statusTone === "success"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
            : statusTone === "warning"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
              : "border-white/10 bg-white/5 text-zinc-300"
        }`}
      >
        <p className="font-medium text-white">
          Wallet: {walletAddress ?? "--"}
        </p>
        <p className="mt-1">Status: {walletStatusLabel}</p>
        {statusMessage ? <p className="mt-2">{statusMessage}</p> : null}
        {!statusMessage && registrationError ? <p className="mt-2">{registrationError}</p> : null}
      </div>
    </div>
  );
}

export function HeroPrimaryActions({ imageSrc, imageAlt }: HeroPrimaryActionsProps) {
  return (
    <div>
      <div>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={imageAlt}
            className="w-full rounded-2xl object-cover shadow-lg shadow-red-500/20 transition-transform duration-700 hover:scale-[1.02]"
            loading="eager"
          />
        ) : (
          <div className="flex min-h-[18rem] w-full items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(22,8,10,0.98),rgba(8,8,12,0.96))] shadow-lg shadow-red-500/20">
            <span className="font-display text-6xl font-semibold tracking-[0.18em] text-white/90">GX</span>
          </div>
        )}
      </div>

      <section className="mt-6 space-y-4">
        <div className="space-y-2">
          <p className="muted-label">Learn the system</p>
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">How Gainix NFT Works</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {infoCards.map((card) => (
            <article
              key={card.title}
              className="section-shell rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_28%),linear-gradient(160deg,rgba(18,10,12,0.94),rgba(10,10,14,0.98))] text-sm leading-7 text-zinc-300 shadow-[0_18px_45px_rgba(0,0,0,0.32)]"
            >
              <h3 className="font-display text-lg font-semibold text-white">{card.title}</h3>

              {"text" in card ? <p className="mt-3 text-sm leading-7 text-zinc-300">{card.text}</p> : null}

              {"items" in card ? (
                <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-300">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
