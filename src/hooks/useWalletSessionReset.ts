"use client";

import { useCallback } from "react";
import { useConfig, useConnections, useConnectors, useDisconnect, useReconnect } from "wagmi";
import {
  clearWalletAuthSession,
  clearWalletSessionStorage,
  disconnectWalletConnector,
  forceResetWagmiClient,
} from "@/lib/web3/wallet-session";

interface ResetWalletSessionOptions {
  reconnectAfter?: boolean;
}

function uniqueConnectors(connectors: readonly ReturnType<typeof useConnectors>[number][]) {
  return Array.from(new Map(connectors.map((connector) => [connector.uid, connector])).values());
}

export function useWalletSessionReset() {
  const config = useConfig();
  const connections = useConnections();
  const connectors = useConnectors();
  const { disconnectAsync } = useDisconnect();
  const { reconnect } = useReconnect();

  const resetWalletSession = useCallback(
    async ({ reconnectAfter = false }: ResetWalletSessionOptions = {}) => {
      console.log("[wallet] disconnect called");

      const connectionConnectors = connections.map((connection) => connection.connector);
      const resetConnectors = uniqueConnectors([...connectionConnectors, ...connectors]);

      await Promise.allSettled(
        connectionConnectors.map((connector) => disconnectAsync({ connector })),
      );
      await Promise.allSettled(resetConnectors.map(disconnectWalletConnector));
      await clearWalletAuthSession();
      clearWalletSessionStorage();
      forceResetWagmiClient(config);

      console.log("[wallet] connector reset");

      if (reconnectAfter && typeof window !== "undefined") {
        window.setTimeout(() => {
          reconnect();
        }, 100);
      }
    },
    [config, connections, connectors, disconnectAsync, reconnect],
  );

  return { resetWalletSession, forceResetWagmiClient: () => forceResetWagmiClient(config) };
}
