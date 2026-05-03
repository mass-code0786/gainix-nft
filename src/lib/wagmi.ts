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
const walletConnectProjectIdForRainbowKit = walletConnectProjectId ?? "";

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

console.info("[wallet.config] projectId loaded", {
  configured: isWalletConnectConfigured,
  source: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
});

if (!walletConnectProjectId) {
  console.error(
    "[wallet.config] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing; MetaMask, Trust Wallet, and WalletConnect mobile deep links require it. Falling back to injected/browser wallet connectors only.",
  );
}

const walletGroups = walletConnectProjectId
  ? [
      {
        groupName: "Mobile wallets",
        wallets: [metaMaskWallet, trustWallet, walletConnectWallet],
      },
      {
        groupName: "Browser wallet",
        wallets: [injectedWallet],
      },
    ]
  : [
      {
        groupName: "Browser wallet",
        wallets: [injectedWallet],
      },
    ];

console.info("[wallet.config] connectors", {
  chains: supportedChains.map((chain) => ({ id: chain.id, name: chain.name })),
  walletGroups: walletConnectProjectId
    ? ["MetaMask", "Trust Wallet", "WalletConnect", "Injected/Browser Wallet"]
    : ["Injected/Browser Wallet"],
});

const rainbowKitConnectors = connectorsForWallets(walletGroups, {
  appName: "Gainix NFT",
  projectId: walletConnectProjectIdForRainbowKit,
  walletConnectParameters,
});

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: rainbowKitConnectors,
  transports,
  ssr: true,
});
