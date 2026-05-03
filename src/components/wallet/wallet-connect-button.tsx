"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown, RotateCcw, Wallet2 } from "lucide-react";
import { useState } from "react";
import { useWalletSessionReset } from "@/hooks/useWalletSessionReset";

interface WalletConnectButtonProps {
  variant?: "default" | "header";
}

export function WalletConnectButton({ variant = "default" }: WalletConnectButtonProps) {
  const isHeader = variant === "header";
  const [connectError, setConnectError] = useState(false);
  const { forceResetWagmiClient, resetWalletSession } = useWalletSessionReset();

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const handleConnect = async () => {
          console.log("[wallet] connect triggered");
          setConnectError(false);

          try {
            await resetWalletSession({ reconnectAfter: true });
            window.setTimeout(() => {
              openConnectModal();
            }, 150);
          } catch (error) {
            console.warn("[wallet] connect failed", error);
            forceResetWagmiClient();
            setConnectError(true);
          }
        };

        if (!mounted) {
          return <div className={`skeleton rounded-full ${isHeader ? "h-9 w-[104px] sm:h-10 sm:w-[120px]" : "h-12 w-[192px]"}`} />;
        }

        if (!account || !chain) {
          return (
            <div className={isHeader ? "flex items-center" : "flex flex-col items-start gap-2"}>
              <button
                type="button"
                onClick={handleConnect}
                className={isHeader ? "header-wallet-pill" : "premium-button rounded-full px-5 py-3 text-sm tracking-wide"}
                data-tone={isHeader ? "primary" : undefined}
              >
                <Wallet2 className={`mr-2 ${isHeader ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                {isHeader ? "Connect" : "Connect Wallet"}
              </button>
              {connectError && !isHeader ? (
                <button type="button" onClick={handleConnect} className="secondary-button rounded-full px-4 py-2 text-xs">
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Retry connection
                </button>
              ) : null}
            </div>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={isHeader ? "header-wallet-pill" : "secondary-button rounded-full px-5 py-3 text-sm text-amber-300"}
              data-tone={isHeader ? "warning" : undefined}
            >
              Wrong network
            </button>
          );
        }

        if (isHeader) {
          return (
            <button type="button" onClick={openAccountModal} className="header-wallet-pill" data-tone="primary">
              <span className="max-w-[104px] truncate sm:max-w-[116px]">{account.displayName}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className="secondary-button rounded-full px-4 py-3 text-xs uppercase tracking-[0.18em]"
            >
              {chain.name}
            </button>
            <button type="button" onClick={openAccountModal} className="premium-button rounded-full px-5 py-3">
              {account.displayName}
              <ChevronDown className="ml-2 h-4 w-4" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
