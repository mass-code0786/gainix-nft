"use client";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";
import { contractTestChain } from "@/contracts/config/chain";
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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={contractTestChain} theme={rainbowTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
