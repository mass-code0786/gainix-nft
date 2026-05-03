import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { gainixChains, gainixDefaultChain } from "@/lib/web3/chains";
import { GAINIX_RPC_READ_TIMEOUT_MS, GAINIX_RPC_RETRY_LIMIT } from "@/lib/web3/rpc-resilience";

export const supportedChains = gainixChains;
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
export const isWalletConnectConfigured = Boolean(walletConnectProjectId);

const transports = {
  [gainixDefaultChain.id]: http(
    process.env.NEXT_PUBLIC_BSC_MAINNET_RPC_URL ?? gainixDefaultChain.rpcUrls.default.http[0],
    { retryCount: GAINIX_RPC_RETRY_LIMIT, timeout: GAINIX_RPC_READ_TIMEOUT_MS },
  ),
} as const;

const walletConnectParameters = {
  optionalChains: [gainixDefaultChain.id],
  qrModalOptions: {
    themeMode: "dark",
  },
} as const;

if (!walletConnectProjectId) {
  console.warn("[wallet.mobile] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing; WalletConnect mobile options are disabled.");
}

const rainbowKitConnectors = walletConnectProjectId
  ? connectorsForWallets(
      [
        {
          groupName: "Mobile wallets",
          wallets: [metaMaskWallet, trustWallet, injectedWallet, walletConnectWallet],
        },
      ],
      {
        appName: "Gainix NFT",
        projectId: walletConnectProjectId,
        walletConnectParameters,
      },
    )
  : connectorsForWallets(
      [
        {
          groupName: "Browser wallet",
          wallets: [injectedWallet],
        },
      ],
      {
        appName: "Gainix NFT",
        projectId: "missing-walletconnect-project-id",
      },
    );

export const wagmiConfig = walletConnectProjectId
  ? createConfig({
      chains: supportedChains,
      connectors: rainbowKitConnectors,
      transports,
      ssr: true,
    })
  : createConfig({
      chains: supportedChains,
      connectors: rainbowKitConnectors,
      transports,
      ssr: true,
    });
