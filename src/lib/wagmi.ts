import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { gainixChains, gainixDefaultChain } from "@/lib/web3/chains";
import { GAINIX_RPC_READ_TIMEOUT_MS, GAINIX_RPC_RETRY_LIMIT } from "@/lib/web3/rpc-resilience";

export const supportedChains = gainixChains;
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const transports = {
  [gainixDefaultChain.id]: http(
    process.env.NEXT_PUBLIC_BSC_MAINNET_RPC_URL ?? gainixDefaultChain.rpcUrls.default.http[0],
    { retryCount: GAINIX_RPC_RETRY_LIMIT, timeout: GAINIX_RPC_READ_TIMEOUT_MS },
  ),
};

export const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "Gainix NFT",
      projectId: walletConnectProjectId,
      chains: supportedChains,
      transports,
      ssr: true,
    })
  : createConfig({
      chains: supportedChains,
      connectors: [injected()],
      transports,
      ssr: true,
    });
