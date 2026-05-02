import "@nomicfoundation/hardhat-toolbox";
import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import path from "path";

function requestedNetwork(): string | undefined {
  const networkArg = process.argv.find((arg) => arg.startsWith("--network="));
  if (networkArg) {
    return networkArg.split("=")[1];
  }

  const networkFlagIndex = process.argv.indexOf("--network");
  if (networkFlagIndex >= 0) {
    return process.argv[networkFlagIndex + 1];
  }

  return process.env.HARDHAT_NETWORK;
}

const isBscMainnet = requestedNetwork() === "bscMainnet";
const rootMainnetEnvPath = path.resolve(__dirname, "../.env.mainnet");
let deployerPrivateKey: string | undefined;

if (isBscMainnet) {
  const result = loadEnv({ path: rootMainnetEnvPath, override: true });
  if (result.error) {
    throw new Error(`BSC mainnet deployment requires root .env.mainnet at ${rootMainnetEnvPath}.`);
  }
  deployerPrivateKey = result.parsed?.DEPLOYER_PRIVATE_KEY?.trim();
  if (!result.parsed?.EXPECTED_DEPLOYER_ADDRESS?.trim()) {
    throw new Error("BSC mainnet deployment requires EXPECTED_DEPLOYER_ADDRESS in root .env.mainnet.");
  }
} else {
  loadEnv({ path: path.resolve(__dirname, "../.env") });
  loadEnv({ path: path.resolve(__dirname, "../.env.local"), override: false });
  loadEnv();
  deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
}

const accounts = deployerPrivateKey ? [deployerPrivateKey] : [];

if (isBscMainnet && accounts.length === 0) {
  throw new Error("BSC mainnet deployment requires DEPLOYER_PRIVATE_KEY in root .env.mainnet.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    bscMainnet: {
      chainId: 56,
      url:
        process.env.BSC_MAINNET_RPC_URL ??
        process.env.NEXT_PUBLIC_BSC_MAINNET_RPC_URL ??
        process.env.BSC_RPC_URL ??
        "https://bsc-dataseed.binance.org",
      accounts,
    },
    bscTestnet: {
      chainId: 97,
      url: process.env.BSC_TESTNET_RPC_URL ?? "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts,
    },
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
    tests: "./test",
  },
};

export default config;
