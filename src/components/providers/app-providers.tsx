"use client";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useAccount, WagmiProvider } from "wagmi";
import { contractActiveChain } from "@/contracts/config/chain";
import { useWalletSessionReset } from "@/hooks/useWalletSessionReset";
import { supportedChains, wagmiConfig } from "@/lib/wagmi";

const rainbowTheme = darkTheme({
  accentColor: "#f43f5e",
  accentColorForeground: "#ffffff",
  borderRadius: "large",
  fontStack: "rounded",
  overlayBlur: "small",
});

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 0,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={contractActiveChain} theme={rainbowTheme} modalSize="compact">
          <WalletSessionGuard />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletSessionGuard() {
  const { address, connector, isConnected, status } = useAccount();
  const { resetWalletSession } = useWalletSessionReset();
  const wasConnectedRef = useRef(false);
  const isCleaningRef = useRef(false);

  useEffect(() => {
    if (!connector) {
      return;
    }

    console.info("[wallet.mobile] connector selected", {
      id: connector.id,
      name: connector.name,
      type: connector.type,
    });
  }, [connector]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = isConnected;

    if (isCleaningRef.current) {
      return;
    }

    const isBrokenConnectedState = status === "connected" && !address;
    const disconnectedAfterConnection = wasConnected && status === "disconnected";

    if (!isBrokenConnectedState && !disconnectedAfterConnection) {
      return;
    }

    isCleaningRef.current = true;
    resetWalletSession({ reconnectAfter: true }).finally(() => {
      isCleaningRef.current = false;
    });
  }, [address, isConnected, resetWalletSession, status]);

  return null;
}
